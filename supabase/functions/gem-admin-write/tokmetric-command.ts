type DatabaseClient = any;

export type TokMetricOperator = {
  id: string;
  role: string;
};

export class TokMetricCommandError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function requiredText(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
) {
  if (typeof value !== "string") {
    throw new TokMetricCommandError(400, "INVALID_REQUEST", `${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new TokMetricCommandError(400, "INVALID_REQUEST", `${field} is invalid`);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new TokMetricCommandError(400, "INVALID_REQUEST", "Text value is invalid");
  }
  return value.trim() || null;
}

function uniqueStrings(value: unknown, maxItems: number, maxLength: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new TokMetricCommandError(400, "INVALID_REQUEST", "List value is invalid");
  }
  return [...new Set(
    value
      .map((item) => {
        if (typeof item !== "string" || item.length > maxLength) {
          throw new TokMetricCommandError(
            400,
            "INVALID_REQUEST",
            "List item is invalid",
          );
        }
        return item.trim();
      })
      .filter(Boolean),
  )];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

async function objectHash(value: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical(value))),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function recordId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function requireWorkspace(db: DatabaseClient, workspaceId: string) {
  const { data, error } = await db
    .from("tokmetric_workspaces")
    .select(
      "id,name,slug,globalEmergencyLock,publishingDisabled,advertisingDisabled,shopWriteDisabled,connectorDisabled,createdAt,updatedAt",
    )
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", error.message);
  }
  if (!data) {
    throw new TokMetricCommandError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  return data;
}

async function audit(
  db: DatabaseClient,
  workspaceId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  outcome: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await db.from("tokmetric_audit_events").insert({
    id: recordId("audit"),
    workspaceId,
    actorId,
    action,
    entityType,
    entityId,
    correlationId: crypto.randomUUID(),
    outcome,
    sourceChannel: "command_center",
    safeMetadata: metadata,
    createdAt: new Date().toISOString(),
  });
  if (error) console.error("tokmetric_activation_audit_failed", error.message);
}

async function domainEvent(
  db: DatabaseClient,
  workspaceId: string,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await db.from("tokmetric_domain_events").insert({
    id: recordId("event"),
    workspaceId,
    aggregateType,
    aggregateId,
    eventType,
    correlationId: crypto.randomUUID(),
    safeMetadata: metadata,
    createdAt: new Date().toISOString(),
  });
  if (error) console.error("tokmetric_domain_event_failed", error.message);
}

async function snapshot(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
) {
  const workspace = await requireWorkspace(db, workspaceId);
  const [
    connectorsResult,
    contentsResult,
    reviewsResult,
    approvalsResult,
    jobsResult,
    analyticsResult,
    auditsResult,
    credentialsResult,
  ] = await Promise.all([
    db.from("tokmetric_connectors")
      .select(
        "id,provider,state,displayName,externalAccountId,grantedScopes,lastHealthAt,updatedAt,disabledAt",
      )
      .eq("workspaceId", workspaceId)
      .order("updatedAt", { ascending: false }),
    db.from("tokmetric_contents")
      .select("id,title,state,currentVersionId,campaignId,createdAt,updatedAt")
      .eq("workspaceId", workspaceId)
      .order("updatedAt", { ascending: false })
      .limit(50),
    db.from("tokmetric_compliance_reviews")
      .select("id,contentId,contentVersionId,result,findings,createdAt")
      .eq("workspaceId", workspaceId)
      .order("createdAt", { ascending: false })
      .limit(50),
    db.from("tokmetric_approval_requests")
      .select(
        "id,contentId,contentVersionId,requestedById,requiredRole,action,objectHash,state,expiresAt,createdAt,updatedAt",
      )
      .eq("workspaceId", workspaceId)
      .order("updatedAt", { ascending: false })
      .limit(50),
    db.from("tokmetric_publish_jobs")
      .select(
        "id,connectorId,contentId,contentVersionId,internalState,externalState,scheduledFor,createdAt,updatedAt",
      )
      .eq("workspaceId", workspaceId)
      .order("updatedAt", { ascending: false })
      .limit(50),
    db.from("tokmetric_analytics_snapshots")
      .select("id,source,metric,value,dimensions,capturedAt")
      .eq("workspaceId", workspaceId)
      .order("capturedAt", { ascending: false })
      .limit(100),
    db.from("tokmetric_audit_events")
      .select(
        "id,action,entityType,entityId,outcome,sourceChannel,safeMetadata,createdAt",
      )
      .eq("workspaceId", workspaceId)
      .order("createdAt", { ascending: false })
      .limit(50),
    db.from("tokmetric_gpt_credentials")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);

  const queryResults = [
    connectorsResult,
    contentsResult,
    reviewsResult,
    approvalsResult,
    jobsResult,
    analyticsResult,
    auditsResult,
  ];
  const failed = queryResults.find((result) => result.error);
  if (failed?.error) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", failed.error.message);
  }
  if (credentialsResult.error) {
    throw new TokMetricCommandError(
      503,
      "DATABASE_ERROR",
      credentialsResult.error.message,
    );
  }

  const connectors = connectorsResult.data ?? [];
  const contents = contentsResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const approvals = approvalsResult.data ?? [];
  const publishJobs = jobsResult.data ?? [];
  const analytics = analyticsResult.data ?? [];
  const audits = auditsResult.data ?? [];
  const oauthEnabled =
    Deno.env.get("TOKMETRIC_TIKTOK_OAUTH_ENABLED") === "true";
  const livePublishingEnabled =
    Deno.env.get("TOKMETRIC_LIVE_PUBLISHING_ENABLED") === "true";
  const configurationMissing = [
    !Deno.env.get("TIKTOK_CLIENT_KEY") ? "TIKTOK_CLIENT_KEY" : null,
    !Deno.env.get("TIKTOK_CLIENT_SECRET") ? "TIKTOK_CLIENT_SECRET" : null,
    !Deno.env.get("TIKTOK_REDIRECT_URI") ? "TIKTOK_REDIRECT_URI" : null,
    !Deno.env.get("TOKMETRIC_TOKEN_ENCRYPTION_KEY")
      ? "TOKMETRIC_TOKEN_ENCRYPTION_KEY"
      : null,
  ].filter((value): value is string => Boolean(value));
  const postingConnector = connectors.find(
    (connector: Record<string, unknown>) =>
      connector.provider === "TIKTOK_CONTENT_POSTING_API" &&
      connector.state === "CONNECTED" &&
      !connector.disabledAt,
  );
  const postingScopes = new Set(
    (postingConnector?.grantedScopes as string[] | undefined) ?? [],
  );
  const publishingScopeReady =
    postingScopes.has("video.publish") || postingScopes.has("video.upload");
  const approvedContentCount = contents.filter(
    (content: Record<string, unknown>) => content.state === "APPROVED",
  ).length;
  const pendingApprovalCount = approvals.filter(
    (approval: Record<string, unknown>) =>
      approval.state === "APPROVAL_REQUIRED",
  ).length;

  const blockers: string[] = [];
  if (workspace.globalEmergencyLock) blockers.push("GLOBAL_EMERGENCY_LOCK");
  if (workspace.connectorDisabled) blockers.push("CONNECTORS_DISABLED");
  if (workspace.publishingDisabled) blockers.push("WORKSPACE_PUBLISHING_DISABLED");
  if (configurationMissing.length > 0) {
    blockers.push("TIKTOK_CONFIGURATION_MISSING");
  }
  if (!oauthEnabled) blockers.push("TIKTOK_OAUTH_DISABLED");
  if (!postingConnector) {
    blockers.push("CONTENT_POSTING_CONNECTOR_NOT_CONNECTED");
  }
  if (postingConnector && !publishingScopeReady) {
    blockers.push("CONTENT_POSTING_SCOPE_NOT_AUTHORIZED");
  }
  if (approvedContentCount === 0) {
    blockers.push("NO_APPROVED_CONTENT_VERSION");
  }
  if (!livePublishingEnabled) blockers.push("LIVE_PUBLISHING_GATE_DISABLED");

  return {
    ok: true,
    viewer: { id: actor.id, role: actor.role },
    workspace,
    counts: {
      connectors: connectors.length,
      connectedConnectors: connectors.filter(
        (connector: Record<string, unknown>) => connector.state === "CONNECTED",
      ).length,
      contents: contents.length,
      approvedContents: approvedContentCount,
      pendingApprovals: pendingApprovalCount,
      publishJobs: publishJobs.length,
      analyticsSnapshots: analytics.length,
      activeGptCredentials: credentialsResult.count ?? 0,
    },
    activation: {
      productionActivation: blockers.length === 0 ? "READY" : "BLOCKED",
      controlledWriteMode: "COMMAND_CENTER_ONLY",
      oauthEnabled,
      livePublishingEnabled,
      connectedPublishingConnector: Boolean(postingConnector),
      publishingScopeReady,
      configMissing: configurationMissing,
      blockers,
    },
    connectors,
    contents,
    complianceReviews: reviews,
    approvals,
    publishJobs,
    analytics,
    auditEvents: audits,
    externalActionTaken: false,
  };
}

async function createDraft(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  await requireWorkspace(db, workspaceId);
  const title = requiredText(body.title, "title", 1, 200);
  const script = optionalText(body.script, 10_000);
  const caption = optionalText(body.caption, 2_200);
  const hashtags = uniqueStrings(body.hashtags, 50, 100);
  const settings =
    body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
      ? body.settings as Record<string, unknown>
      : {};
  const contentId = recordId("content");
  const versionId = recordId("contentver");
  const payload = { script, caption, hashtags, settings, mediaAssetIds: [] };
  const hash = await objectHash(payload);
  const now = new Date().toISOString();

  const contentInsert = await db.from("tokmetric_contents").insert({
    id: contentId,
    workspaceId,
    campaignId: null,
    ownerId: actor.id,
    title,
    state: "DRAFT",
    currentVersionId: null,
    createdAt: now,
    updatedAt: now,
  });
  if (contentInsert.error) {
    throw new TokMetricCommandError(
      503,
      "CONTENT_CREATE_FAILED",
      contentInsert.error.message,
    );
  }

  const versionInsert = await db.from("tokmetric_content_versions").insert({
    id: versionId,
    contentId,
    version: 1,
    objectHash: hash,
    script,
    caption,
    hashtags,
    settings,
    mediaAssetIds: [],
    createdById: actor.id,
    createdAt: now,
  });
  if (versionInsert.error) {
    await db.from("tokmetric_contents").delete().eq("id", contentId);
    throw new TokMetricCommandError(
      503,
      "CONTENT_VERSION_CREATE_FAILED",
      versionInsert.error.message,
    );
  }

  const contentUpdate = await db.from("tokmetric_contents")
    .update({ currentVersionId: versionId, updatedAt: now })
    .eq("id", contentId);
  if (contentUpdate.error) {
    await db.from("tokmetric_content_versions").delete().eq("id", versionId);
    await db.from("tokmetric_contents").delete().eq("id", contentId);
    throw new TokMetricCommandError(
      503,
      "CONTENT_UPDATE_FAILED",
      contentUpdate.error.message,
    );
  }

  await Promise.all([
    audit(
      db,
      workspaceId,
      actor.id,
      "tokmetric.content.created",
      "content",
      contentId,
      "success",
      { versionId, objectHash: hash },
    ),
    domainEvent(db, workspaceId, "content", contentId, "CONTENT_DRAFT_CREATED", {
      versionId,
      objectHash: hash,
    }),
  ]);
  return {
    ok: true,
    content: {
      id: contentId,
      title,
      state: "DRAFT",
      currentVersionId: versionId,
    },
    version: { id: versionId, version: 1, objectHash: hash },
    externalActionTaken: false,
  };
}

async function createVersion(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const contentId = requiredText(body.contentId, "contentId", 3, 200);
  const { data: content, error: contentError } = await db
    .from("tokmetric_contents")
    .select("id,state,currentVersionId")
    .eq("workspaceId", workspaceId)
    .eq("id", contentId)
    .maybeSingle();
  if (contentError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", contentError.message);
  }
  if (!content) {
    throw new TokMetricCommandError(404, "CONTENT_NOT_FOUND", "Content not found");
  }
  if (["APPROVED", "ARCHIVED"].includes(content.state)) {
    throw new TokMetricCommandError(
      409,
      "CONTENT_IMMUTABLE",
      "Approved or archived content cannot be edited directly",
    );
  }

  const script = optionalText(body.script, 10_000);
  const caption = optionalText(body.caption, 2_200);
  const hashtags = uniqueStrings(body.hashtags, 50, 100);
  const settings =
    body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
      ? body.settings as Record<string, unknown>
      : {};
  const payload = { script, caption, hashtags, settings, mediaAssetIds: [] };
  const hash = await objectHash(payload);
  const { data: existing, error: existingError } = await db
    .from("tokmetric_content_versions")
    .select("id,version,objectHash")
    .eq("contentId", contentId)
    .eq("objectHash", hash)
    .maybeSingle();
  if (existingError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", existingError.message);
  }
  if (existing) {
    return { ok: true, reused: true, version: existing, externalActionTaken: false };
  }

  const { data: latest, error: latestError } = await db
    .from("tokmetric_content_versions")
    .select("version")
    .eq("contentId", contentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", latestError.message);
  }
  const version = (latest?.version ?? 0) + 1;
  const versionId = recordId("contentver");
  const now = new Date().toISOString();
  const insert = await db.from("tokmetric_content_versions").insert({
    id: versionId,
    contentId,
    version,
    objectHash: hash,
    script,
    caption,
    hashtags,
    settings,
    mediaAssetIds: [],
    createdById: actor.id,
    createdAt: now,
  });
  if (insert.error) {
    throw new TokMetricCommandError(
      503,
      "CONTENT_VERSION_CREATE_FAILED",
      insert.error.message,
    );
  }
  const update = await db.from("tokmetric_contents")
    .update({ currentVersionId: versionId, state: "DRAFT", updatedAt: now })
    .eq("id", contentId);
  if (update.error) {
    await db.from("tokmetric_content_versions").delete().eq("id", versionId);
    throw new TokMetricCommandError(
      503,
      "CONTENT_UPDATE_FAILED",
      update.error.message,
    );
  }
  await db.from("tokmetric_approval_requests")
    .update({ state: "REVOKED", updatedAt: now })
    .eq("contentId", contentId)
    .in("state", ["APPROVAL_REQUIRED", "APPROVED"]);
  await domainEvent(db, workspaceId, "content", contentId, "CONTENT_VERSION_CREATED", {
    versionId,
    objectHash: hash,
    version,
  });
  return {
    ok: true,
    reused: false,
    version: { id: versionId, version, objectHash: hash },
    externalActionTaken: false,
  };
}

async function runReview(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const contentId = requiredText(body.contentId, "contentId", 3, 200);
  const { data: content, error: contentError } = await db
    .from("tokmetric_contents")
    .select("id,currentVersionId")
    .eq("workspaceId", workspaceId)
    .eq("id", contentId)
    .maybeSingle();
  if (contentError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", contentError.message);
  }
  if (!content?.currentVersionId) {
    throw new TokMetricCommandError(
      404,
      "CONTENT_NOT_FOUND",
      "Content or active version not found",
    );
  }
  const { data: version, error: versionError } = await db
    .from("tokmetric_content_versions")
    .select("id,script,caption,hashtags")
    .eq("id", content.currentVersionId)
    .maybeSingle();
  if (versionError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", versionError.message);
  }
  if (!version) {
    throw new TokMetricCommandError(
      409,
      "CONTENT_VERSION_MISSING",
      "Content version not found",
    );
  }

  const findings: Array<{ code: string; severity: string; message: string }> = [];
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
      message: "Absolute cybersecurity claims require substantiation or revision.",
    });
  }
  if ((version.hashtags ?? []).length > 30) {
    findings.push({
      code: "HASHTAG_LIMIT",
      severity: "warning",
      message: "Hashtag count exceeds the review threshold.",
    });
  }

  const hasBlock = findings.some((finding) => finding.severity === "block");
  const hasWarning = findings.some((finding) => finding.severity === "warning");
  const result = hasBlock
    ? "BLOCKED"
    : hasWarning
      ? "HUMAN_REVIEW_REQUIRED"
      : "PASS";
  const nextState = hasBlock
    ? "BLOCKED"
    : hasWarning
      ? "REVIEW_READY"
      : "APPROVAL_REQUIRED";
  const reviewId = recordId("review");
  const now = new Date().toISOString();
  const insert = await db.from("tokmetric_compliance_reviews").insert({
    id: reviewId,
    workspaceId,
    contentId,
    contentVersionId: version.id,
    policyVersionId: null,
    result,
    findings,
    reviewerId: actor.id,
    createdAt: now,
  });
  if (insert.error) {
    throw new TokMetricCommandError(
      503,
      "COMPLIANCE_REVIEW_FAILED",
      insert.error.message,
    );
  }
  const update = await db.from("tokmetric_contents")
    .update({ state: nextState, updatedAt: now })
    .eq("id", contentId);
  if (update.error) {
    throw new TokMetricCommandError(
      503,
      "CONTENT_UPDATE_FAILED",
      update.error.message,
    );
  }
  await audit(
    db,
    workspaceId,
    actor.id,
    "tokmetric.compliance.reviewed",
    "compliance_review",
    reviewId,
    hasBlock ? "blocked" : "success",
    { contentId, contentVersionId: version.id, result, findings },
  );
  return {
    ok: true,
    review: {
      id: reviewId,
      contentId,
      contentVersionId: version.id,
      result,
      findings,
    },
    contentState: nextState,
    externalActionTaken: false,
  };
}

async function requestApproval(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const contentId = requiredText(body.contentId, "contentId", 3, 200);
  const requiredRole =
    typeof body.requiredRole === "string" && body.requiredRole.trim()
      ? body.requiredRole.trim().slice(0, 100)
      : "approver";
  const expiresAt = typeof body.expiresAt === "string"
    ? new Date(body.expiresAt)
    : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
    throw new TokMetricCommandError(
      400,
      "INVALID_EXPIRY",
      "Approval expiry is invalid",
    );
  }

  const { data: content, error: contentError } = await db
    .from("tokmetric_contents")
    .select("id,currentVersionId")
    .eq("workspaceId", workspaceId)
    .eq("id", contentId)
    .maybeSingle();
  if (contentError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", contentError.message);
  }
  if (!content?.currentVersionId) {
    throw new TokMetricCommandError(
      404,
      "CONTENT_NOT_FOUND",
      "Content or active version not found",
    );
  }
  const { data: version, error: versionError } = await db
    .from("tokmetric_content_versions")
    .select("id,objectHash")
    .eq("id", content.currentVersionId)
    .maybeSingle();
  if (versionError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", versionError.message);
  }
  if (!version) {
    throw new TokMetricCommandError(
      409,
      "CONTENT_VERSION_MISSING",
      "Content version not found",
    );
  }

  const { data: review, error: reviewError } = await db
    .from("tokmetric_compliance_reviews")
    .select("id,result,findings,createdAt")
    .eq("workspaceId", workspaceId)
    .eq("contentVersionId", version.id)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reviewError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", reviewError.message);
  }
  if (!review) {
    throw new TokMetricCommandError(
      409,
      "COMPLIANCE_REVIEW_REQUIRED",
      "Run compliance review for the exact content version first",
    );
  }
  if (!["PASS", "HUMAN_REVIEW_REQUIRED"].includes(review.result)) {
    throw new TokMetricCommandError(
      409,
      "COMPLIANCE_BLOCKED",
      "Resolve blocking compliance findings first",
    );
  }

  const { data: existing, error: existingError } = await db
    .from("tokmetric_approval_requests")
    .select("id,state,contentId,contentVersionId,requiredRole,objectHash,expiresAt")
    .eq("workspaceId", workspaceId)
    .eq("contentVersionId", version.id)
    .eq("objectHash", version.objectHash)
    .in("state", ["APPROVAL_REQUIRED", "APPROVED"])
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", existingError.message);
  }
  if (existing) {
    return { ok: true, reused: true, approval: existing, externalActionTaken: false };
  }

  const approvalId = recordId("approval");
  const now = new Date().toISOString();
  const insert = await db.from("tokmetric_approval_requests").insert({
    id: approvalId,
    workspaceId,
    contentId,
    contentVersionId: version.id,
    requestedById: actor.id,
    requiredRole,
    action: "publish_tiktok_content",
    objectHash: version.objectHash,
    state: "APPROVAL_REQUIRED",
    expiresAt: expiresAt?.toISOString() ?? null,
    createdAt: now,
    updatedAt: now,
  });
  if (insert.error) {
    throw new TokMetricCommandError(
      503,
      "APPROVAL_CREATE_FAILED",
      insert.error.message,
    );
  }
  const update = await db.from("tokmetric_contents")
    .update({ state: "APPROVAL_REQUIRED", updatedAt: now })
    .eq("id", contentId);
  if (update.error) {
    throw new TokMetricCommandError(
      503,
      "CONTENT_UPDATE_FAILED",
      update.error.message,
    );
  }
  await audit(
    db,
    workspaceId,
    actor.id,
    "tokmetric.approval.requested",
    "approval",
    approvalId,
    "success",
    {
      contentId,
      contentVersionId: version.id,
      requiredRole,
      complianceReviewId: review.id,
    },
  );
  return {
    ok: true,
    reused: false,
    approval: {
      id: approvalId,
      contentId,
      contentVersionId: version.id,
      state: "APPROVAL_REQUIRED",
      requiredRole,
    },
    externalActionTaken: false,
  };
}

function roleCanDecide(actorRole: string, requiredRole: string) {
  if (requiredRole === "super_admin") {
    return actorRole === "super_admin" || actorRole === "internal";
  }
  return ["admin", "super_admin", "internal"].includes(actorRole);
}

async function decideApproval(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const approvalId = requiredText(body.approvalId, "approvalId", 3, 200);
  const decision = requiredText(body.decision, "decision", 3, 20).toLowerCase();
  if (!["approve", "reject", "revoke"].includes(decision)) {
    throw new TokMetricCommandError(
      400,
      "INVALID_DECISION",
      "Approval decision is invalid",
    );
  }
  const reason = requiredText(body.reason, "reason", 10, 2_000);

  const { data: approval, error: approvalError } = await db
    .from("tokmetric_approval_requests")
    .select(
      "id,contentId,contentVersionId,requestedById,requiredRole,objectHash,state,expiresAt",
    )
    .eq("workspaceId", workspaceId)
    .eq("id", approvalId)
    .maybeSingle();
  if (approvalError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", approvalError.message);
  }
  if (!approval?.contentId || !approval.contentVersionId) {
    throw new TokMetricCommandError(
      404,
      "APPROVAL_NOT_FOUND",
      "Approval request not found",
    );
  }
  if (approval.state !== "APPROVAL_REQUIRED") {
    throw new TokMetricCommandError(
      409,
      "APPROVAL_STATE_INVALID",
      "Approval is not awaiting a decision",
    );
  }
  if (approval.requestedById === actor.id) {
    throw new TokMetricCommandError(
      403,
      "APPROVAL_SEPARATION_REQUIRED",
      "The requester cannot decide the same approval",
    );
  }
  if (!roleCanDecide(actor.role, approval.requiredRole)) {
    throw new TokMetricCommandError(
      403,
      "APPROVER_ROLE_REQUIRED",
      "Required approver role is missing",
    );
  }
  if (approval.expiresAt && new Date(approval.expiresAt).getTime() <= Date.now()) {
    await db.from("tokmetric_approval_requests")
      .update({ state: "EXPIRED", updatedAt: new Date().toISOString() })
      .eq("id", approvalId);
    throw new TokMetricCommandError(
      409,
      "APPROVAL_EXPIRED",
      "Approval request has expired",
    );
  }

  const [{ data: content, error: contentError }, { data: version, error: versionError }] =
    await Promise.all([
      db.from("tokmetric_contents")
        .select("id,currentVersionId,state")
        .eq("workspaceId", workspaceId)
        .eq("id", approval.contentId)
        .maybeSingle(),
      db.from("tokmetric_content_versions")
        .select("id,objectHash")
        .eq("id", approval.contentVersionId)
        .maybeSingle(),
    ]);
  if (contentError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", contentError.message);
  }
  if (versionError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", versionError.message);
  }
  if (!content || content.currentVersionId !== approval.contentVersionId) {
    await db.from("tokmetric_approval_requests")
      .update({ state: "REVOKED", updatedAt: new Date().toISOString() })
      .eq("id", approvalId);
    throw new TokMetricCommandError(
      409,
      "APPROVAL_VERSION_MISMATCH",
      "Approval no longer matches the current content version",
    );
  }
  if (!version || version.objectHash !== approval.objectHash) {
    await db.from("tokmetric_approval_requests")
      .update({ state: "REVOKED", updatedAt: new Date().toISOString() })
      .eq("id", approvalId);
    throw new TokMetricCommandError(
      409,
      "APPROVAL_HASH_MISMATCH",
      "Approval object hash no longer matches",
    );
  }

  const nextState = decision === "approve"
    ? "APPROVED"
    : decision === "reject"
      ? "REJECTED"
      : "REVOKED";
  const now = new Date().toISOString();
  const decisionInsert = await db.from("tokmetric_approval_decisions").insert({
    id: recordId("decision"),
    approvalRequestId: approvalId,
    actorId: actor.id,
    decision,
    objectHash: approval.objectHash,
    reason,
    createdAt: now,
  });
  if (decisionInsert.error) {
    throw new TokMetricCommandError(
      503,
      "APPROVAL_DECISION_FAILED",
      decisionInsert.error.message,
    );
  }
  const approvalUpdate = await db.from("tokmetric_approval_requests")
    .update({ state: nextState, updatedAt: now })
    .eq("id", approvalId)
    .eq("state", "APPROVAL_REQUIRED");
  if (approvalUpdate.error) {
    throw new TokMetricCommandError(
      503,
      "APPROVAL_UPDATE_FAILED",
      approvalUpdate.error.message,
    );
  }
  const contentUpdate = await db.from("tokmetric_contents")
    .update({ state: nextState, updatedAt: now })
    .eq("id", approval.contentId)
    .eq("currentVersionId", approval.contentVersionId);
  if (contentUpdate.error) {
    throw new TokMetricCommandError(
      503,
      "CONTENT_UPDATE_FAILED",
      contentUpdate.error.message,
    );
  }

  await Promise.all([
    audit(
      db,
      workspaceId,
      actor.id,
      `tokmetric.approval.${decision}`,
      "approval",
      approvalId,
      "success",
      {
        contentId: approval.contentId,
        contentVersionId: approval.contentVersionId,
        nextState,
      },
    ),
    domainEvent(
      db,
      workspaceId,
      "approval",
      approvalId,
      `APPROVAL_${decision.toUpperCase()}`,
      {
        contentId: approval.contentId,
        contentVersionId: approval.contentVersionId,
      },
    ),
  ]);
  return { ok: true, approvalId, state: nextState, externalActionTaken: false };
}

async function publishPreflight(
  db: DatabaseClient,
  actor: TokMetricOperator,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const contentId = requiredText(body.contentId, "contentId", 3, 200);
  const connectorId =
    typeof body.connectorId === "string" ? body.connectorId.trim() : "";
  const workspace = await requireWorkspace(db, workspaceId);
  const { data: content, error: contentError } = await db
    .from("tokmetric_contents")
    .select("id,title,state,currentVersionId")
    .eq("workspaceId", workspaceId)
    .eq("id", contentId)
    .maybeSingle();
  if (contentError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", contentError.message);
  }
  if (!content?.currentVersionId) {
    throw new TokMetricCommandError(
      404,
      "CONTENT_NOT_FOUND",
      "Content or active version not found",
    );
  }
  const { data: version, error: versionError } = await db
    .from("tokmetric_content_versions")
    .select("id,objectHash")
    .eq("id", content.currentVersionId)
    .maybeSingle();
  if (versionError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", versionError.message);
  }
  if (!version) {
    throw new TokMetricCommandError(
      409,
      "CONTENT_VERSION_MISSING",
      "Content version not found",
    );
  }

  let connectorQuery = db.from("tokmetric_connectors")
    .select("id,provider,state,grantedScopes,disabledAt")
    .eq("workspaceId", workspaceId)
    .eq("provider", "TIKTOK_CONTENT_POSTING_API");
  if (connectorId) connectorQuery = connectorQuery.eq("id", connectorId);
  const { data: connector, error: connectorError } = await connectorQuery
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connectorError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", connectorError.message);
  }
  const { data: approval, error: approvalError } = await db
    .from("tokmetric_approval_requests")
    .select("id,state,objectHash,expiresAt")
    .eq("workspaceId", workspaceId)
    .eq("contentId", contentId)
    .eq("contentVersionId", version.id)
    .eq("objectHash", version.objectHash)
    .eq("state", "APPROVED")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (approvalError) {
    throw new TokMetricCommandError(503, "DATABASE_ERROR", approvalError.message);
  }

  const scopes = new Set((connector?.grantedScopes as string[] | undefined) ?? []);
  const blockers: string[] = [];
  if (workspace.globalEmergencyLock) blockers.push("GLOBAL_EMERGENCY_LOCK");
  if (workspace.connectorDisabled) blockers.push("CONNECTORS_DISABLED");
  if (workspace.publishingDisabled) blockers.push("WORKSPACE_PUBLISHING_DISABLED");
  if (content.state !== "APPROVED") blockers.push("CONTENT_NOT_APPROVED");
  if (!approval) blockers.push("EXACT_VERSION_APPROVAL_MISSING");
  if (approval?.expiresAt && new Date(approval.expiresAt).getTime() <= Date.now()) {
    blockers.push("APPROVAL_EXPIRED");
  }
  if (!connector) blockers.push("CONTENT_POSTING_CONNECTOR_MISSING");
  if (connector && connector.state !== "CONNECTED") {
    blockers.push("CONTENT_POSTING_CONNECTOR_NOT_CONNECTED");
  }
  if (connector?.disabledAt) blockers.push("CONTENT_POSTING_CONNECTOR_DISABLED");
  if (
    connector &&
    !scopes.has("video.publish") &&
    !scopes.has("video.upload")
  ) {
    blockers.push("CONTENT_POSTING_SCOPE_NOT_AUTHORIZED");
  }
  if (Deno.env.get("TOKMETRIC_LIVE_PUBLISHING_ENABLED") !== "true") {
    blockers.push("LIVE_PUBLISHING_GATE_DISABLED");
  }

  await audit(
    db,
    workspaceId,
    actor.id,
    "tokmetric.publish.preflight",
    "content",
    contentId,
    blockers.length === 0 ? "pass" : "blocked",
    {
      connectorId: connector?.id ?? null,
      contentVersionId: version.id,
      blockers,
    },
  );
  return {
    ok: true,
    preflight: {
      ready: blockers.length === 0,
      blockers,
      content: { id: content.id, title: content.title, state: content.state },
      contentVersionId: version.id,
      connector: connector ?? null,
      approval: approval ?? null,
      livePublishingEnabled:
        Deno.env.get("TOKMETRIC_LIVE_PUBLISHING_ENABLED") === "true",
    },
    externalActionTaken: false,
  };
}

export async function dispatchTokMetricCommand(input: {
  db: DatabaseClient;
  actor: TokMetricOperator;
  workspaceId: string;
  body: Record<string, unknown>;
}) {
  const operation = requiredText(input.body.operation, "operation", 3, 100);
  if (operation === "snapshot") {
    return snapshot(input.db, input.actor, input.workspaceId);
  }
  if (operation === "create_draft") {
    return createDraft(input.db, input.actor, input.workspaceId, input.body);
  }
  if (operation === "create_version") {
    return createVersion(input.db, input.actor, input.workspaceId, input.body);
  }
  if (operation === "run_review") {
    return runReview(input.db, input.actor, input.workspaceId, input.body);
  }
  if (operation === "request_approval") {
    return requestApproval(input.db, input.actor, input.workspaceId, input.body);
  }
  if (operation === "decide_approval") {
    return decideApproval(input.db, input.actor, input.workspaceId, input.body);
  }
  if (operation === "publish_preflight") {
    return publishPreflight(input.db, input.actor, input.workspaceId, input.body);
  }
  throw new TokMetricCommandError(
    400,
    "INVALID_OPERATION",
    "Unknown TokMetric operation",
  );
}
