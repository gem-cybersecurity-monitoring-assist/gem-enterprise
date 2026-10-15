import type { SocialEnvSource } from "@/lib/social-media/autopilot/policy";
import { db } from "@/lib/db";
import { listSocialConnectors } from "@/lib/social-media/oauth/store";
import {
  accountTypeMatches,
  connectorProviderMatches,
  globalSocialPublishingEnabled,
  providerSocialPublishingEnabled,
} from "@/lib/social-media/publishing/gates";
import {
  countSocialPublishingJobsForWindow,
  createSocialPublishingJob,
  hasRecentSocialPublishingFingerprint,
} from "@/lib/social-media/publishing/store";
import {
  sharedSocialPublishingProviders,
  type SharedSocialPublishingProvider,
  type SocialPublishingPayload,
} from "@/lib/social-media/publishing/types";
import {
  socialContentTypes,
  type SocialContentType,
} from "@/lib/social-media/policy";
import type { DailyContentOrchestrationResult } from "@/lib/social-media/orchestration/orchestrator";
import {
  emitTokMetricAudit,
  TokMetricError,
} from "@/lib/tokmetric/security";
import {
  explicitAutopilotConnectorId,
  getSocialAutopilotEgressPolicy,
  getSocialAutopilotProviderPolicy,
  SOCIAL_AUTOPILOT_POLICY_VERSION,
  socialAutopilotAutoApprovalEnabled,
} from "./policy";
import {
  buildSocialAutopilotSlots,
  socialAutopilotDayWindow,
} from "./scheduler";

const RECENT_FINGERPRINT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
}

function sharedProvider(
  value: string,
): SharedSocialPublishingProvider | undefined {
  return sharedSocialPublishingProviders.includes(
    value as SharedSocialPublishingProvider,
  )
    ? (value as SharedSocialPublishingProvider)
    : undefined;
}

function contentTypeFromSettings(
  settings: Record<string, unknown>,
): SocialContentType | undefined {
  const orchestration = object(settings.orchestrator);
  const value =
    typeof orchestration.contentType === "string"
      ? orchestration.contentType
      : undefined;
  return value &&
    socialContentTypes.includes(value as SocialContentType)
    ? (value as SocialContentType)
    : undefined;
}

function approvalModeFromSettings(settings: Record<string, unknown>) {
  const orchestration = object(settings.orchestrator);
  return orchestration.approvalMode === "AUTO_POLICY"
    ? "AUTO_POLICY"
    : "HUMAN";
}

function autopilotFingerprint(settings: Record<string, unknown>) {
  const orchestration = object(settings.orchestrator);
  return typeof orchestration.fingerprint === "string"
    ? orchestration.fingerprint
    : undefined;
}

function isAutoPolicyReason(
  reason: string | null | undefined,
  provider: SharedSocialPublishingProvider,
) {
  return (
    reason ===
    `AUTO_POLICY:${SOCIAL_AUTOPILOT_POLICY_VERSION}:${provider}`
  );
}

export function isSocialAutopilotApprovalDecision(input: {
  provider: SharedSocialPublishingProvider;
  approvalAction?: string | null;
  actorId?: string | null;
  reason?: string | null;
}) {
  return (
    !input.actorId &&
    input.approvalAction ===
      `autopilot_publish_${input.provider.toLowerCase()}` &&
    isAutoPolicyReason(input.reason, input.provider)
  );
}

async function autoApproveExactVersion(input: {
  workspaceId: string;
  actorId: string;
  contentId: string;
  contentVersionId: string;
  complianceReviewId: string;
  provider: SharedSocialPublishingProvider;
  correlationId: string;
  env?: SocialEnvSource;
}) {
  const env = input.env ?? process.env;
  if (!socialAutopilotAutoApprovalEnabled(env)) {
    throw new TokMetricError(
      423,
      "SOCIAL_AUTOPILOT_AUTO_APPROVAL_DISABLED",
      "Social Autopilot automatic policy approval is disabled.",
    );
  }
  const policy = getSocialAutopilotProviderPolicy(input.provider, env);
  if (!policy.autoApprovalEligible) {
    throw new TokMetricError(
      409,
      "SOCIAL_AUTOPILOT_PROVIDER_REQUIRES_EXTERNAL_CONTROL",
      "This provider is not eligible for autonomous approval.",
    );
  }

  const [content, version, review] = await Promise.all([
    db.content.findFirst({
      where: { id: input.contentId, workspaceId: input.workspaceId },
    }),
    db.contentVersion.findUnique({
      where: { id: input.contentVersionId },
    }),
    db.complianceReview.findFirst({
      where: {
        id: input.complianceReviewId,
        workspaceId: input.workspaceId,
        contentId: input.contentId,
        contentVersionId: input.contentVersionId,
      },
    }),
  ]);
  if (!content || !version || content.currentVersionId !== version.id) {
    throw new TokMetricError(
      409,
      "SOCIAL_AUTOPILOT_VERSION_MISMATCH",
      "Autopilot can approve only the active exact content version.",
    );
  }
  if (review?.result !== "PASS") {
    throw new TokMetricError(
      409,
      "SOCIAL_AUTOPILOT_POLICY_REVIEW_REQUIRED",
      "Only a clean PASS compliance result can be approved automatically.",
    );
  }

  const settings = object(version.settings);
  if (approvalModeFromSettings(settings) !== "AUTO_POLICY") {
    throw new TokMetricError(
      409,
      "SOCIAL_AUTOPILOT_MODE_MISMATCH",
      "This content was not generated for autonomous policy approval.",
    );
  }

  const action = `autopilot_publish_${input.provider.toLowerCase()}`;
  const existing = await db.approvalRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contentId: content.id,
      contentVersionId: version.id,
      objectHash: version.objectHash,
      action,
      state: "APPROVED",
    },
    include: {
      decisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const existingDecision = existing?.decisions[0];
  if (
    existing &&
    existingDecision?.decision === "approve" &&
    isSocialAutopilotApprovalDecision({
      provider: input.provider,
      approvalAction: existing.action,
      actorId: existingDecision.actorId,
      reason: existingDecision.reason,
    })
  ) {
    return existing;
  }

  const reason =
    `AUTO_POLICY:${SOCIAL_AUTOPILOT_POLICY_VERSION}:${input.provider}`;
  const approval = await db.$transaction(async (transaction) => {
    const created = await transaction.approvalRequest.create({
      data: {
        workspaceId: input.workspaceId,
        contentId: content.id,
        contentVersionId: version.id,
        requestedById: input.actorId,
        requiredRole: "auto_policy",
        action,
        objectHash: version.objectHash,
        state: "APPROVED",
      },
    });
    await transaction.approvalDecision.create({
      data: {
        approvalRequestId: created.id,
        actorId: null,
        decision: "approve",
        objectHash: version.objectHash,
        reason,
      },
    });
    await transaction.content.update({
      where: { id: content.id },
      data: { state: "APPROVED" },
    });
    return created;
  });

  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "SOCIAL_AUTO_POLICY_APPROVED",
    entityType: "CONTENT_VERSION",
    entityId: version.id,
    correlationId: input.correlationId,
    outcome: "APPROVED",
    sourceChannel: "social-autopilot",
    metadata: {
      provider: input.provider,
      contentId: content.id,
      approvalId: approval.id,
      policyVersion: SOCIAL_AUTOPILOT_POLICY_VERSION,
      automaticDecision: true,
    },
  });
  return approval;
}

function derivePayload(input: {
  contentId: string;
  contentVersionId: string;
  version: {
    script: string | null;
    caption: string | null;
    hashtags: string[];
    settings: unknown;
  };
  mediaUrls: string[];
  fingerprint: string;
}) {
  const settings = object(input.version.settings);
  const hashtags = input.version.hashtags.map((tag) =>
    tag.startsWith("#") ? tag : `#${tag}`,
  );
  const caption = [input.version.caption?.trim(), hashtags.join(" ")]
    .filter(Boolean)
    .join("\n\n");
  const configuredMediaUrls = strings(settings.mediaUrls);
  const visibility: SocialPublishingPayload["visibility"] =
    settings.visibility === "PUBLIC" ||
    settings.visibility === "UNLISTED" ||
    settings.visibility === "PRIVATE"
      ? settings.visibility
      : undefined;

  return {
    text: caption || input.version.script?.trim() || undefined,
    title:
      typeof settings.title === "string" ? settings.title.trim() : undefined,
    description:
      typeof settings.description === "string"
        ? settings.description.trim()
        : input.version.script?.trim() || undefined,
    linkUrl:
      typeof settings.linkUrl === "string"
        ? settings.linkUrl.trim()
        : undefined,
    mediaUrls:
      configuredMediaUrls.length > 0
        ? configuredMediaUrls
        : input.mediaUrls,
    altText:
      typeof settings.altText === "string"
        ? settings.altText.trim()
        : undefined,
    thread: strings(settings.thread),
    localContext:
      typeof settings.localContext === "string"
        ? settings.localContext.trim()
        : undefined,
    visibility,
    metadata: {
      contentId: input.contentId,
      contentVersionId: input.contentVersionId,
      autopilot: true,
      autopilotFingerprint: input.fingerprint,
      autopilotPolicyVersion: SOCIAL_AUTOPILOT_POLICY_VERSION,
    },
  } satisfies SocialPublishingPayload;
}


function mediaExecutionBlocker(input: {
  provider: SharedSocialPublishingProvider;
  contentType: SocialContentType;
  mediaAssets: Array<{ mimeType: string }>;
}) {
  if (input.provider === "YOUTUBE") {
    return "YOUTUBE_UPLOAD_PIPELINE_NOT_CERTIFIED";
  }
  if (input.provider !== "INSTAGRAM_PROFESSIONAL") return undefined;

  if (input.contentType === "CAROUSEL") {
    const valid =
      input.mediaAssets.length >= 2 &&
      input.mediaAssets.length <= 10 &&
      input.mediaAssets.every((asset) => asset.mimeType.startsWith("image/"));
    return valid ? undefined : "INSTAGRAM_CAROUSEL_MEDIA_REQUIRED";
  }
  if (input.contentType === "REEL") {
    return input.mediaAssets.length === 1 &&
      input.mediaAssets[0]?.mimeType.startsWith("video/")
      ? undefined
      : "INSTAGRAM_REEL_MEDIA_REQUIRED";
  }
  if (input.contentType === "IMAGE") {
    return input.mediaAssets.length === 1 &&
      input.mediaAssets[0]?.mimeType.startsWith("image/")
      ? undefined
      : "INSTAGRAM_IMAGE_MEDIA_REQUIRED";
  }
  return "INSTAGRAM_CONTENT_TYPE_NOT_EXECUTABLE";
}

export async function materializeSocialAutopilotJobs(input: {
  workspaceId: string;
  actorId: string;
  planDate: Date;
  result: DailyContentOrchestrationResult;
  correlationId: string;
  now?: Date;
  env?: SocialEnvSource;
}) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const egress = getSocialAutopilotEgressPolicy(env);
  if (!socialAutopilotAutoApprovalEnabled(env)) {
    return {
      queued: 0,
      skipped: input.result.materialized.length,
      blockedReasons: ["SOCIAL_AUTOPILOT_AUTO_APPROVAL_DISABLED"],
      egress,
    };
  }

  const connectors = await listSocialConnectors(input.workspaceId);
  const draftByFingerprint = new Map(
    input.result.plan.drafts.map((draft) => [draft.fingerprint, draft]),
  );
  const { start, end } = socialAutopilotDayWindow(input.planDate);
  const blockedReasons: string[] = [];
  let queued = 0;
  let skipped = 0;

  for (const providerId of [
    ...new Set(input.result.materialized.map((item) => item.provider)),
  ]) {
    const provider = sharedProvider(providerId);
    if (!provider) {
      blockedReasons.push(`${providerId}_AUTOPILOT_NOT_SUPPORTED`);
      skipped += input.result.materialized.filter(
        (item) => item.provider === providerId,
      ).length;
      continue;
    }

    if (!globalSocialPublishingEnabled(env)) {
      blockedReasons.push("GLOBAL_LIVE_PUBLISHING_DISABLED");
      skipped += input.result.materialized.filter(
        (item) => item.provider === provider,
      ).length;
      continue;
    }
    if (!providerSocialPublishingEnabled(provider, env)) {
      blockedReasons.push(`${provider}_LIVE_PUBLISHING_DISABLED`);
      skipped += input.result.materialized.filter(
        (item) => item.provider === provider,
      ).length;
      continue;
    }

    const policy = getSocialAutopilotProviderPolicy(provider, env);
    const existingCount = await countSocialPublishingJobsForWindow({
      workspaceId: input.workspaceId,
      provider,
      start,
      end,
    });
    const remaining = Math.max(
      0,
      Math.min(policy.dailyTarget, policy.hardDailyCap) - existingCount,
    );
    if (remaining <= 0) continue;

    const explicitConnector = explicitAutopilotConnectorId(provider, env);
    const candidates = connectors.filter(
      (connector) =>
        connector.state === "CONNECTED" &&
        connectorProviderMatches(provider, connector.provider) &&
        accountTypeMatches(provider, connector.safeMetadata),
    );
    const selected = explicitConnector
      ? candidates.find((connector) => connector.id === explicitConnector)
      : candidates.length === 1
        ? candidates[0]
        : undefined;
    if (!selected) {
      blockedReasons.push(
        explicitConnector
          ? `${provider}_CONFIGURED_CONNECTOR_NOT_READY`
          : candidates.length > 1
            ? `${provider}_EXPLICIT_CONNECTOR_REQUIRED`
            : `${provider}_CONNECTED_ACCOUNT_REQUIRED`,
      );
      skipped += input.result.materialized.filter(
        (item) => item.provider === provider,
      ).length;
      continue;
    }

    const providerItems = input.result.materialized
      .filter(
        (item) =>
          item.provider === provider &&
          item.state === "AUTO_POLICY_READY" &&
          item.complianceResult === "PASS",
      )
      .slice(0, remaining);
    const slots = buildSocialAutopilotSlots({
      provider,
      planDate: input.planDate,
      count: providerItems.length,
      now,
      env,
    });

    for (let index = 0; index < providerItems.length; index += 1) {
      const item = providerItems[index];
      const scheduledFor = slots[index];
      if (!scheduledFor) {
        skipped += 1;
        blockedReasons.push(`${provider}_NO_SAFE_SLOT_AVAILABLE`);
        continue;
      }
      const draft = draftByFingerprint.get(item.fingerprint);
      if (!draft) {
        skipped += 1;
        blockedReasons.push(`${provider}_DRAFT_EVIDENCE_MISSING`);
        continue;
      }
      const duplicate = await hasRecentSocialPublishingFingerprint({
        workspaceId: input.workspaceId,
        provider,
        fingerprint: item.fingerprint,
        since: new Date(now.getTime() - RECENT_FINGERPRINT_LOOKBACK_MS),
      });
      if (duplicate) {
        skipped += 1;
        blockedReasons.push(`${provider}_DUPLICATE_FINGERPRINT_BLOCKED`);
        continue;
      }

      const [content, version] = await Promise.all([
        db.content.findFirst({
          where: { id: item.contentId, workspaceId: input.workspaceId },
        }),
        db.contentVersion.findUnique({
          where: { id: item.contentVersionId },
        }),
      ]);
      if (
        !content ||
        !version ||
        content.currentVersionId !== version.id
      ) {
        skipped += 1;
        blockedReasons.push(`${provider}_ACTIVE_VERSION_REQUIRED`);
        continue;
      }
      const settings = object(version.settings);
      if (
        approvalModeFromSettings(settings) !== "AUTO_POLICY" ||
        autopilotFingerprint(settings) !== item.fingerprint
      ) {
        skipped += 1;
        blockedReasons.push(`${provider}_AUTO_POLICY_EVIDENCE_MISMATCH`);
        continue;
      }
      const contentType = contentTypeFromSettings(settings);
      if (!contentType) {
        skipped += 1;
        blockedReasons.push(`${provider}_CONTENT_TYPE_REQUIRED`);
        continue;
      }

      const mediaAssets =
        version.mediaAssetIds.length > 0
          ? await db.mediaAsset.findMany({
              where: {
                workspaceId: input.workspaceId,
                id: { in: version.mediaAssetIds },
              },
            })
          : [];
      if (mediaAssets.length !== version.mediaAssetIds.length) {
        skipped += 1;
        blockedReasons.push(`${provider}_MEDIA_ASSET_MISSING`);
        continue;
      }
      const mediaBlocker = mediaExecutionBlocker({
        provider,
        contentType,
        mediaAssets,
      });
      if (mediaBlocker) {
        skipped += 1;
        blockedReasons.push(mediaBlocker);
        continue;
      }

      const approval = await autoApproveExactVersion({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        contentId: content.id,
        contentVersionId: version.id,
        complianceReviewId: item.complianceReviewId,
        provider,
        correlationId: input.correlationId,
        env,
      });
      const payload = derivePayload({
        contentId: content.id,
        contentVersionId: version.id,
        version,
        mediaUrls: mediaAssets.map((asset) => asset.storageRef),
        fingerprint: item.fingerprint,
      });
      await createSocialPublishingJob({
        workspaceId: input.workspaceId,
        provider,
        connectorId: selected.id,
        contentType,
        contentVersionHash: version.objectHash,
        approvedVersionHash: version.objectHash,
        approvalId: approval.id,
        complianceReviewId: item.complianceReviewId,
        compliancePassed: true,
        idempotencyKey:
          `social-autopilot:${provider}:${input.result.plan.planDate}:${item.fingerprint}`,
        payload,
        localContext: payload.localContext,
        requestedById: input.actorId,
        scheduledFor,
        maxAttempts: 3,
      });
      queued += 1;
    }
  }

  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "SOCIAL_AUTOPILOT_MATERIALIZED",
    entityType: "CAMPAIGN",
    entityId: input.result.campaignId,
    correlationId: input.correlationId,
    outcome: "QUEUED",
    sourceChannel: "social-autopilot",
    metadata: {
      planDate: input.result.plan.planDate,
      queued,
      skipped,
      blockedReasons: [...new Set(blockedReasons)],
      egressMode: egress.mode,
      egressRegion: egress.region,
      rotatingProxyAllowed: false,
      externalActionTaken: false,
    },
  });

  return {
    queued,
    skipped,
    blockedReasons: [...new Set(blockedReasons)],
    egress,
  };
}
