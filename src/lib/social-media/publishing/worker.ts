import { db } from "@/lib/db";
import { loadSocialConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
import { evaluateSocialPublishingAuthorization } from "@/lib/social-media/policy";
import {
  getSocialAutopilotEgressPolicy,
  SOCIAL_AUTOPILOT_POLICY_VERSION,
  socialAutopilotAutoApprovalEnabled,
} from "@/lib/social-media/autopilot/policy";
import {
  isSocialAutopilotApprovalDecision,
} from "@/lib/social-media/autopilot/service";
import {
  emitTokMetricAudit,
  enforceEmergencyLocks,
  TokMetricError,
} from "@/lib/tokmetric/security";
import {
  accountTypeMatches,
  connectorProviderMatches,
  globalSocialPublishingEnabled,
  missingPublishingScopes,
  providerSocialPublishingEnabled,
} from "./gates";
import {
  getSocialPublishingAdapter,
  SocialPublishingAdapterError,
} from "./adapters";
import {
  claimSocialPublishingJobs,
  markSocialConnectorForReauthorization,
  markSocialPublishingJobBlocked,
  markSocialPublishingJobFailed,
  markSocialPublishingJobPublished,
} from "./store";
import type { SocialPublishingJobRecord } from "./types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function governanceEvidence(job: SocialPublishingJobRecord) {
  const [approval, complianceReview] = await Promise.all([
    db.approvalRequest.findFirst({
      where: {
        id: job.approvalId,
        workspaceId: job.workspaceId,
        objectHash: job.approvedVersionHash,
        state: "APPROVED",
      },
      include: {
        content: true,
        contentVersion: true,
        decisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.complianceReview.findFirst({
      where: {
        id: job.complianceReviewId,
        workspaceId: job.workspaceId,
        result: { in: ["PASS", "PASS_WITH_DISCLOSURE"] },
      },
    }),
  ]);

  const decision = approval?.decisions[0];
  const versionId = approval?.contentVersionId || null;
  const activeVersionMatches =
    Boolean(versionId) && approval?.content?.currentVersionId === versionId;
  const versionHashMatches =
    approval?.contentVersion?.objectHash === job.contentVersionHash &&
    approval?.objectHash === job.approvedVersionHash &&
    job.contentVersionHash === job.approvedVersionHash;
  const humanApprovalValid =
    Boolean(decision?.actorId) &&
    decision?.actorId !== approval?.requestedById;
  const autoPolicyApprovalValid =
    Boolean(approval && decision) &&
    isSocialAutopilotApprovalDecision({
      provider: job.provider,
      approvalAction: approval?.action,
      actorId: decision?.actorId,
      reason: decision?.reason,
    });
  const approvalValid =
    Boolean(approval) &&
    decision?.decision.toLowerCase() === "approve" &&
    decision.objectHash === job.approvedVersionHash &&
    (humanApprovalValid || autoPolicyApprovalValid) &&
    activeVersionMatches &&
    versionHashMatches;
  const complianceValid =
    Boolean(complianceReview) &&
    Boolean(versionId) &&
    complianceReview?.contentVersionId === versionId &&
    complianceReview?.contentId === approval?.contentId &&
    job.compliancePassed;

  return {
    approvalValid,
    complianceValid,
    approvalDecisionId: decision?.id || null,
    approvalMode: autoPolicyApprovalValid ? "AUTO_POLICY" : "HUMAN",
    contentVersionId: versionId,
  };
}

function connectorPolicyState(state: string) {
  if (state === "CONNECTED") return "CONNECTED" as const;
  if (state === "TOKEN_EXPIRED") return "TOKEN_EXPIRED" as const;
  if (state === "DISCONNECTED" || state === "BLOCKED") {
    return "DISABLED" as const;
  }
  return "AUTHORIZATION_REQUIRED" as const;
}

async function audit(input: Parameters<typeof emitTokMetricAudit>[0]) {
  await emitTokMetricAudit(input).catch(() => undefined);
}

async function block(
  job: SocialPublishingJobRecord,
  code: string,
  message: string,
  metadata?: unknown,
) {
  const updated = await markSocialPublishingJobBlocked({
    job,
    errorCode: code,
    errorMessage: message,
    metadata,
  });
  await audit({
    workspaceId: job.workspaceId,
    actorId: job.requestedById || undefined,
    action: "SOCIAL_PUBLISH_BLOCKED",
    entityType: "SOCIAL_PUBLISHING_JOB",
    entityId: job.id,
    correlationId: job.id,
    outcome: "BLOCKED",
    sourceChannel: "social-publishing-worker",
    metadata: { provider: job.provider, code, ...object(metadata) },
  });
  return updated;
}

async function processJob(job: SocialPublishingJobRecord) {
  const payloadMetadata = object(job.payload.metadata);
  if (payloadMetadata.autopilot === true) {
    if (!socialAutopilotAutoApprovalEnabled()) {
      return block(
        job,
        "SOCIAL_AUTOPILOT_DISABLED",
        "Social Autopilot or automatic approval has been disabled after this job was queued.",
      );
    }
    if (
      payloadMetadata.autopilotPolicyVersion !==
      SOCIAL_AUTOPILOT_POLICY_VERSION
    ) {
      return block(
        job,
        "SOCIAL_AUTOPILOT_POLICY_VERSION_STALE",
        "The queued job was created under a different Social Autopilot policy version.",
        {
          queuedPolicyVersion:
            typeof payloadMetadata.autopilotPolicyVersion === "string"
              ? payloadMetadata.autopilotPolicyVersion
              : null,
          activePolicyVersion: SOCIAL_AUTOPILOT_POLICY_VERSION,
        },
      );
    }
    try {
      getSocialAutopilotEgressPolicy();
    } catch (error) {
      return block(
        job,
        "SOCIAL_AUTOPILOT_EGRESS_POLICY_BLOCKED",
        error instanceof Error
          ? error.message
          : "Social Autopilot egress policy is invalid.",
      );
    }
  }

  try {
    await enforceEmergencyLocks(job.workspaceId, "publish");
  } catch (error) {
    if (error instanceof TokMetricError) {
      return block(job, error.code, error.message);
    }
    throw error;
  }

  const evidence = await governanceEvidence(job);
  const loaded = await loadSocialConnectorCredential({
    workspaceId: job.workspaceId,
    connectorId: job.connectorId,
  });
  const missingScopes = missingPublishingScopes(
    job.provider,
    loaded.connector.grantedScopes,
  );
  const connectorMatches = connectorProviderMatches(
    job.provider,
    loaded.connector.provider,
  );
  const selectedAccountMatches = accountTypeMatches(
    job.provider,
    loaded.connector.safeMetadata,
  );

  const authorization = evaluateSocialPublishingAuthorization({
    provider: job.provider,
    contentType: job.contentType,
    connectorState: connectorPolicyState(loaded.connector.state),
    globalLivePublishingEnabled: globalSocialPublishingEnabled(),
    providerPublishingEnabled: providerSocialPublishingEnabled(job.provider),
    emergencyLockActive: false,
    compliancePassed: evidence.complianceValid,
    approvalId: evidence.approvalValid ? job.approvalId : null,
    approvedVersionHash: job.approvedVersionHash,
    currentVersionHash: job.contentVersionHash,
    idempotencyKey: job.idempotencyKey,
    localContext: job.localContext,
  });

  const reasons = [...authorization.reasons];
  if (!connectorMatches) reasons.push("CONNECTOR_PROVIDER_MISMATCH");
  if (!selectedAccountMatches) reasons.push("EXPLICIT_ACCOUNT_SELECTION_REQUIRED");
  if (missingScopes.length > 0) reasons.push("REQUIRED_PROVIDER_SCOPES_MISSING");
  if (!evidence.approvalValid) reasons.push("APPROVAL_EVIDENCE_INVALID");
  if (!evidence.complianceValid) reasons.push("COMPLIANCE_EVIDENCE_INVALID");

  if (reasons.length > 0) {
    return block(
      job,
      "SOCIAL_PUBLISHING_NOT_AUTHORIZED",
      "Shared governance blocked the external publishing action.",
      {
        reasons,
        missingScopes,
        contentVersionId: evidence.contentVersionId,
        approvalDecisionId: evidence.approvalDecisionId,
        approvalMode: evidence.approvalMode,
      },
    );
  }

  const externalAccountId = loaded.connector.externalAccountId;
  if (!externalAccountId) {
    return block(
      job,
      "SOCIAL_EXTERNAL_ACCOUNT_REQUIRED",
      "The selected connector does not identify an authorized destination account.",
    );
  }

  try {
    const adapter = getSocialPublishingAdapter(job.provider);
    const result = await adapter.publish({
      job,
      accessToken: loaded.credential.accessToken,
      externalAccountId,
      connectorMetadata: loaded.connector.safeMetadata,
    });
    const updated = await markSocialPublishingJobPublished({
      job,
      externalPostId: result.externalPostId,
      externalPostUrl: result.externalPostUrl,
      providerStatusCode: result.providerStatusCode,
      safeMetadata: result.safeMetadata,
    });
    await audit({
      workspaceId: job.workspaceId,
      actorId: job.requestedById || undefined,
      action: "SOCIAL_PUBLISH_COMPLETED",
      entityType: "SOCIAL_PUBLISHING_JOB",
      entityId: job.id,
      correlationId: job.id,
      outcome: "PUBLISHED",
      sourceChannel: "social-publishing-worker",
      metadata: {
        provider: job.provider,
        connectorId: job.connectorId,
        externalPostId: result.externalPostId,
        approvalMode: evidence.approvalMode,
        autopilot: payloadMetadata.autopilot === true,
      },
    });
    return updated;
  } catch (error) {
    const adapterError =
      error instanceof SocialPublishingAdapterError
        ? error
        : new SocialPublishingAdapterError(
            "SOCIAL_PROVIDER_UNEXPECTED_ERROR",
            "The provider publishing request failed.",
          );
    if (adapterError.options.reauthorizationRequired) {
      await markSocialConnectorForReauthorization({
        workspaceId: job.workspaceId,
        connectorId: job.connectorId,
        reasonCode: adapterError.code,
      });
    }
    const updated = await markSocialPublishingJobFailed({
      job,
      errorCode: adapterError.code,
      errorMessage: adapterError.message,
      retryable: Boolean(adapterError.options.retryable),
      providerStatusCode: adapterError.options.providerStatusCode,
      metadata: adapterError.options.safeMetadata,
    });
    await audit({
      workspaceId: job.workspaceId,
      actorId: job.requestedById || undefined,
      action: "SOCIAL_PUBLISH_FAILED",
      entityType: "SOCIAL_PUBLISHING_JOB",
      entityId: job.id,
      correlationId: job.id,
      outcome: updated.state,
      sourceChannel: "social-publishing-worker",
      metadata: {
        provider: job.provider,
        connectorId: job.connectorId,
        errorCode: adapterError.code,
        retryable: Boolean(adapterError.options.retryable),
        reauthorizationRequired: Boolean(
          adapterError.options.reauthorizationRequired,
        ),
      },
    });
    return updated;
  }
}

export async function processSocialPublishingBatch(limit = 10) {
  const claimed = await claimSocialPublishingJobs(limit);
  const completed: SocialPublishingJobRecord[] = [];
  for (const job of claimed) {
    try {
      completed.push(await processJob(job));
    } catch (error) {
      const safe =
        error instanceof TokMetricError
          ? error
          : new TokMetricError(
              500,
              "SOCIAL_PUBLISHING_JOB_FAILED",
              "The publishing job could not be evaluated.",
            );
      try {
        completed.push(
          await markSocialPublishingJobFailed({
            job,
            errorCode: safe.code,
            errorMessage: safe.message,
            retryable: safe.status >= 500,
          }),
        );
      } catch {
        // The claim will expire and become eligible for safe recovery.
      }
    }
  }
  return {
    claimed: claimed.length,
    published: completed.filter((job) => job.state === "PUBLISHED").length,
    retrying: completed.filter((job) => job.state === "RETRYING").length,
    blocked: completed.filter((job) => job.state === "BLOCKED").length,
    failed: completed.filter(
      (job) => job.state === "FAILED" || job.state === "DEAD_LETTER",
    ).length,
    jobs: completed,
  };
}
