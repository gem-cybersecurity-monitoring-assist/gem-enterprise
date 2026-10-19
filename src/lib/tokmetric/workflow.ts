import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  contentHash,
  emitDomainEvent,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  TokMetricError,
} from "@/lib/tokmetric/security";

export type DraftInput = {
  workspaceId: string;
  title: string;
  campaignId?: string;
  script?: string;
  caption?: string;
  hashtags?: string[];
  settings?: Record<string, unknown>;
  mediaAssetIds?: string[];
};

type ReviewFinding = {
  code: string;
  severity: "info" | "warning" | "block";
  message: string;
};

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function orchestratorRiskFindings(settings: unknown): ReviewFinding[] {
  const riskFlags = object(settings).riskFlags;
  if (!Array.isArray(riskFlags)) return [];
  return riskFlags.flatMap((entry) => {
    const flag = object(entry);
    const code = typeof flag.code === "string" ? flag.code : undefined;
    const message = typeof flag.message === "string" ? flag.message : undefined;
    const severity =
      flag.severity === "BLOCK"
        ? "block"
        : flag.severity === "WARNING"
          ? "warning"
          : flag.severity === "INFO"
            ? "info"
            : undefined;
    return code && message && severity ? [{ code, message, severity }] : [];
  });
}

function dedupeFindings(findings: readonly ReviewFinding[]) {
  const severityRank: Record<ReviewFinding["severity"], number> = {
    info: 0,
    warning: 1,
    block: 2,
  };
  const unique = new Map<string, ReviewFinding>();
  for (const finding of findings) {
    const key = `${finding.code}|${finding.message}`;
    const existing = unique.get(key);
    if (!existing || severityRank[finding.severity] > severityRank[existing.severity]) {
      unique.set(key, finding);
    }
  }
  return [...unique.values()];
}

function normalizeDraftPayload(
  input: Omit<DraftInput, "workspaceId" | "title" | "campaignId">,
) {
  return {
    script: input.script?.trim() || null,
    caption: input.caption?.trim() || null,
    hashtags: [
      ...new Set((input.hashtags ?? []).map((tag) => tag.trim()).filter(Boolean)),
    ],
    settings: input.settings ?? {},
    mediaAssetIds: [...new Set(input.mediaAssetIds ?? [])],
  };
}

export async function createContentDraft(
  input: DraftInput,
  actorId: string,
  correlationId: string,
) {
  const payload = normalizeDraftPayload(input);
  const objectHash = contentHash(payload);

  const result = await db.$transaction(async (tx) => {
    const content = await tx.content.create({
      data: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        ownerId: actorId,
        title: input.title.trim(),
        state: "DRAFT",
      },
    });
    const version = await tx.contentVersion.create({
      data: {
        contentId: content.id,
        version: 1,
        objectHash,
        script: payload.script,
        caption: payload.caption,
        hashtags: payload.hashtags,
        settings: toInputJson(payload.settings),
        mediaAssetIds: payload.mediaAssetIds,
        createdById: actorId,
      },
    });
    const updated = await tx.content.update({
      where: { id: content.id },
      data: { currentVersionId: version.id },
      include: { versions: true },
    });
    return { content: updated, version };
  });

  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId,
    action: "tokmetric.content.created",
    entityType: "content",
    entityId: result.content.id,
    correlationId,
    outcome: "success",
    sourceChannel: "website",
    metadata: { versionId: result.version.id, objectHash },
  });
  await emitDomainEvent({
    workspaceId: input.workspaceId,
    aggregateType: "content",
    aggregateId: result.content.id,
    eventType: "CONTENT_DRAFT_CREATED",
    correlationId,
    metadata: { versionId: result.version.id, objectHash },
  });

  return result;
}

export async function createContentVersion(
  contentId: string,
  workspaceId: string,
  actorId: string,
  correlationId: string,
  payload: Omit<DraftInput, "workspaceId" | "title" | "campaignId">,
) {
  const content = await db.content.findFirst({
    where: { id: contentId, workspaceId },
  });
  if (!content) {
    throw new TokMetricError(404, "CONTENT_NOT_FOUND", "Content was not found.");
  }
  if (["APPROVED", "ARCHIVED"].includes(content.state)) {
    throw new TokMetricError(
      409,
      "CONTENT_IMMUTABLE",
      "Approved or archived content cannot be edited directly.",
    );
  }

  const normalized = normalizeDraftPayload(payload);
  const objectHash = contentHash(normalized);

  const existing = await db.contentVersion.findFirst({
    where: { contentId, objectHash },
  });
  if (existing) return { content, version: existing, reused: true };

  const latest = await db.contentVersion.aggregate({
    where: { contentId },
    _max: { version: true },
  });
  const version = await db.contentVersion.create({
    data: {
      contentId,
      version: (latest._max.version ?? 0) + 1,
      objectHash,
      script: normalized.script,
      caption: normalized.caption,
      hashtags: normalized.hashtags,
      settings: toInputJson(normalized.settings),
      mediaAssetIds: normalized.mediaAssetIds,
      createdById: actorId,
    },
  });
  const updated = await db.content.update({
    where: { id: contentId },
    data: { currentVersionId: version.id, state: "DRAFT" },
  });

  await emitDomainEvent({
    workspaceId,
    aggregateType: "content",
    aggregateId: contentId,
    eventType: "CONTENT_VERSION_CREATED",
    correlationId,
    metadata: { versionId: version.id, objectHash },
  });
  return { content: updated, version, reused: false };
}

export async function runComplianceReview(input: {
  workspaceId: string;
  contentId: string;
  policyVersionId?: string;
  actorId: string;
  correlationId: string;
}) {
  const content = await db.content.findFirst({
    where: { id: input.contentId, workspaceId: input.workspaceId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!content || !content.currentVersionId) {
    throw new TokMetricError(
      404,
      "CONTENT_NOT_FOUND",
      "Content or its active version was not found.",
    );
  }
  const version = content.versions[0];
  if (!version) {
    throw new TokMetricError(
      409,
      "CONTENT_VERSION_MISSING",
      "Content has no reviewable version.",
    );
  }

  const findings: ReviewFinding[] = [
    ...orchestratorRiskFindings(version.settings),
  ];
  const combined = `${version.script ?? ""}\n${version.caption ?? ""}`.toLowerCase();
  if (!combined.trim()) {
    findings.push({
      code: "EMPTY_CONTENT",
      severity: "block",
      message: "Content script and caption are empty.",
    });
  }
  if (
    combined.includes("guaranteed profit") ||
    combined.includes("risk-free return")
  ) {
    findings.push({
      code: "MISLEADING_FINANCIAL_CLAIM",
      severity: "block",
      message: "Unsupported guaranteed or risk-free financial claim detected.",
    });
  }
  if (combined.includes("100% secure") || combined.includes("unhackable")) {
    findings.push({
      code: "ABSOLUTE_SECURITY_CLAIM",
      severity: "warning",
      message:
        "Absolute cybersecurity claims require substantiation or revision.",
    });
  }
  if ((version.hashtags ?? []).length > 30) {
    findings.push({
      code: "HASHTAG_LIMIT",
      severity: "warning",
      message: "Hashtag count exceeds the configured review threshold.",
    });
  }

  const uniqueFindings = dedupeFindings(findings);
  const hasBlock = uniqueFindings.some(
    (finding) => finding.severity === "block",
  );
  const hasWarning = uniqueFindings.some(
    (finding) => finding.severity === "warning",
  );
  const result = hasBlock
    ? "BLOCKED"
    : hasWarning
      ? "HUMAN_REVIEW_REQUIRED"
      : "PASS";

  const review = await db.complianceReview.create({
    data: {
      workspaceId: input.workspaceId,
      contentId: content.id,
      contentVersionId: version.id,
      policyVersionId: input.policyVersionId,
      result,
      findings: toInputJson(uniqueFindings),
      reviewerId: input.actorId,
    },
  });
  await db.content.update({
    where: { id: content.id },
    data: {
      state: hasBlock
        ? "BLOCKED"
        : hasWarning
          ? "REVIEW_READY"
          : "APPROVAL_REQUIRED",
    },
  });
  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "tokmetric.compliance.reviewed",
    entityType: "compliance_review",
    entityId: review.id,
    correlationId: input.correlationId,
    outcome: hasBlock ? "blocked" : "success",
    sourceChannel: "website",
    metadata: {
      contentId: content.id,
      contentVersionId: version.id,
      result,
      findings: uniqueFindings,
    },
  });
  return review;
}

export async function requestContentApproval(input: {
  workspaceId: string;
  contentId: string;
  actorId: string;
  requiredRole?: string;
  action?: string;
  expiresAt?: Date;
  correlationId: string;
}) {
  const content = await db.content.findFirst({
    where: { id: input.contentId, workspaceId: input.workspaceId },
  });
  if (!content?.currentVersionId) {
    throw new TokMetricError(
      404,
      "CONTENT_NOT_FOUND",
      "Content or its active version was not found.",
    );
  }
  const version = await db.contentVersion.findUnique({
    where: { id: content.currentVersionId },
  });
  if (!version) {
    throw new TokMetricError(
      409,
      "CONTENT_VERSION_MISSING",
      "Content has no active version.",
    );
  }
  const latestReview = await db.complianceReview.findFirst({
    where: { contentVersionId: version.id },
    orderBy: { createdAt: "desc" },
  });
  if (!latestReview || !["PASS", "PASS_WITH_DISCLOSURE"].includes(latestReview.result)) {
    throw new TokMetricError(
      409,
      "COMPLIANCE_APPROVAL_NOT_READY",
      "A passing compliance review for the exact content version is required before requesting approval.",
    );
  }

  const existing = await db.approvalRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contentId: content.id,
      contentVersionId: version.id,
      objectHash: version.objectHash,
      action: input.action?.trim() || "publish_content",
      state: { in: ["APPROVAL_REQUIRED", "APPROVED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const approval = await db.approvalRequest.create({
    data: {
      workspaceId: input.workspaceId,
      contentId: content.id,
      contentVersionId: version.id,
      requestedById: input.actorId,
      requiredRole: input.requiredRole ?? "approver",
      action: input.action?.trim() || "publish_content",
      objectHash: version.objectHash,
      state: "APPROVAL_REQUIRED",
      expiresAt: input.expiresAt,
    },
  });
  await db.content.update({
    where: { id: content.id },
    data: { state: "APPROVAL_REQUIRED" },
  });
  return approval;
}

export async function decideApproval(input: {
  workspaceId: string;
  approvalId: string;
  actorId: string;
  decision: "approve" | "reject" | "revoke";
  reason?: string;
  correlationId: string;
}) {
  const approval = await db.approvalRequest.findFirst({
    where: { id: input.approvalId, workspaceId: input.workspaceId },
    include: { contentVersion: true },
  });
  if (!approval || !approval.contentVersion) {
    throw new TokMetricError(
      404,
      "APPROVAL_NOT_FOUND",
      "Approval request was not found.",
    );
  }
  if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: { state: "EXPIRED" },
    });
    throw new TokMetricError(
      409,
      "APPROVAL_EXPIRED",
      "Approval request has expired.",
    );
  }
  if (approval.objectHash !== approval.contentVersion.objectHash) {
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: { state: "REVOKED" },
    });
    throw new TokMetricError(
      409,
      "APPROVAL_VERSION_MISMATCH",
      "Approval no longer matches the active content version.",
    );
  }
  if (input.decision === "approve" && approval.requestedById === input.actorId) {
    throw new TokMetricError(
      409,
      "SEPARATE_APPROVER_REQUIRED",
      "The operator who requested publication cannot approve the same content version.",
    );
  }

  const nextState =
    input.decision === "approve"
      ? "APPROVED"
      : input.decision === "reject"
        ? "REJECTED"
        : "REVOKED";
  await db.$transaction([
    db.approvalDecision.create({
      data: {
        approvalRequestId: approval.id,
        actorId: input.actorId,
        decision: input.decision,
        objectHash: approval.objectHash,
        reason: input.reason,
      },
    }),
    db.approvalRequest.update({
      where: { id: approval.id },
      data: { state: nextState },
    }),
    ...(approval.contentId
      ? [
          db.content.update({
            where: { id: approval.contentId },
            data: { state: nextState },
          }),
        ]
      : []),
  ]);

  await emitDomainEvent({
    workspaceId: input.workspaceId,
    aggregateType: "approval",
    aggregateId: approval.id,
    eventType: `APPROVAL_${input.decision.toUpperCase()}`,
    correlationId: input.correlationId,
    metadata: {
      contentId: approval.contentId,
      contentVersionId: approval.contentVersionId,
    },
  });
  return { approvalId: approval.id, state: nextState };
}

export async function registerMediaAsset(input: {
  workspaceId: string;
  actorId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  storageRef: string;
  metadata?: Record<string, unknown>;
}) {
  if (!/^(video|image)\//.test(input.mimeType)) {
    throw new TokMetricError(
      400,
      "UNSUPPORTED_MEDIA_TYPE",
      "Only image and video assets are supported.",
    );
  }
  if (input.fileSize <= 0 || input.fileSize > 1024 * 1024 * 1024) {
    throw new TokMetricError(
      400,
      "INVALID_MEDIA_SIZE",
      "Media size is outside the accepted range.",
    );
  }
  return db.mediaAsset.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.actorId,
      objectHash: contentHash({
        checksum: input.checksum,
        storageRef: input.storageRef,
      }),
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      checksum: input.checksum,
      storageRef: input.storageRef,
      metadata: toInputJson(input.metadata ?? {}),
    },
  });
}

export async function queuePublishJob(input: {
  workspaceId: string;
  contentId: string;
  connectorId: string;
  actorId: string;
  idempotencyKey: string;
  scheduledFor?: Date;
  correlationId: string;
}) {
  await enforceEmergencyLocks(input.workspaceId, "publish");
  if (process.env.TOKMETRIC_LIVE_PUBLISHING_ENABLED !== "true") {
    throw new TokMetricError(
      423,
      "LIVE_PUBLISHING_DISABLED",
      "Live TikTok publishing is disabled by the production activation gate.",
    );
  }
  const content = await db.content.findFirst({
    where: { id: input.contentId, workspaceId: input.workspaceId },
  });
  if (!content?.currentVersionId || content.state !== "APPROVED") {
    throw new TokMetricError(
      409,
      "CONTENT_NOT_APPROVED",
      "Only an approved active content version can be queued.",
    );
  }
  const version = await db.contentVersion.findUnique({
    where: { id: content.currentVersionId },
  });
  if (!version) {
    throw new TokMetricError(
      409,
      "CONTENT_VERSION_MISSING",
      "Approved content version was not found.",
    );
  }
  const connector = await db.connector.findFirst({
    where: {
      id: input.connectorId,
      workspaceId: input.workspaceId,
      state: "CONNECTED",
    },
  });
  if (!connector) {
    throw new TokMetricError(
      409,
      "CONNECTOR_NOT_READY",
      "A connected TikTok publishing connector is required.",
    );
  }
  const approval = await db.approvalRequest.findFirst({
    where: {
      contentVersionId: version.id,
      objectHash: version.objectHash,
      state: "APPROVED",
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!approval) {
    throw new TokMetricError(
      409,
      "APPROVAL_REQUIRED",
      "A valid approval bound to this exact content version is required.",
    );
  }

  return db.publishJob.create({
    data: {
      workspaceId: input.workspaceId,
      connectorId: connector.id,
      contentId: content.id,
      contentVersionId: version.id,
      requestedById: input.actorId,
      idempotencyKey: input.idempotencyKey,
      internalState: "QUEUED",
      externalState: "NOT_SUBMITTED",
      objectHash: version.objectHash,
      scheduledFor: input.scheduledFor,
    },
  });
}
