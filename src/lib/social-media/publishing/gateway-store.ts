/**
 * Gateway-backed implementations of the social publishing store.
 *
 * Same exported signatures and return types as publishing/store.ts (the
 * Prisma implementation); the thin factory in store.ts selects between the
 * two based on shouldUseSupabaseGateway(). Each function translates its
 * inputs to one gateway action, converts the gateway row shape back through
 * the shared job() row mapper (via reviveJobRow), and maps gateway errors
 * to the current TokMetricError codes — the edge function preserves the
 * RPC's code, so SOCIAL_PUBLISHING_CLAIM_LOST etc. arrive unchanged.
 *
 * Policy stays in Next.js: the claim computes caps/spacing with the
 * existing slots.ts helpers (including the JSON env overrides) and passes
 * them as parameters; the mark-failed state derivation and backoff are
 * computed here exactly as the Prisma path computes them. The RPCs are
 * dumb executors of the same statements.
 *
 * Phase 2 (count, fingerprint, cancel) is NOT implemented here: the
 * autopilot service has its own Prisma surface and stays gateway-blocked,
 * so the factory delegates those three to Prisma unconditionally.
 */
import { randomUUID } from "node:crypto";
import { GatewayRequestError } from "@/lib/supabase-gateway";
import {
  redactSecrets,
  TokMetricError,
} from "@/lib/tokmetric/security";
import type { SocialContentType } from "@/lib/social-media/policy";
import type {
  SharedSocialPublishingProvider,
  SocialPublishingJobRecord,
  SocialPublishingJobState,
} from "./types";
import { sharedSocialPublishingProviders } from "./types";
import {
  providerMinSpacingMinutes,
  providerSlotBatchCap,
} from "./slots";
import { socialPublishingGateway } from "./gateway-client";
import { reviveJobRow } from "./job-row";

// Must match CLAIM_TTL_MS in store.ts (2 minutes). Duplicated, not imported,
// because store.ts imports this module for the factory and an import back
// would be circular.
const CLAIM_TTL_MS = 2 * 60 * 1000;

function gatewayError(error: unknown): never {
  if (error instanceof GatewayRequestError) {
    throw new TokMetricError(error.statusCode, error.code, error.message);
  }
  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jobFromResponse(body: unknown): SocialPublishingJobRecord {
  if (!isRecord(body) || !isRecord(body.job)) {
    throw new TokMetricError(
      500,
      "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
      "The social publishing gateway returned an unexpected response.",
    );
  }
  return reviveJobRow(body.job);
}

function jobsFromResponse(body: unknown): SocialPublishingJobRecord[] {
  if (!isRecord(body) || !Array.isArray(body.jobs)) {
    throw new TokMetricError(
      500,
      "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
      "The social publishing gateway returned an unexpected response.",
    );
  }
  return body.jobs.map((row) => reviveJobRow(row as Record<string, unknown>));
}

export async function createSocialPublishingJobViaGateway(input: {
  workspaceId: string;
  provider: SharedSocialPublishingProvider;
  connectorId: string;
  contentType: SocialContentType;
  contentVersionHash: string;
  approvedVersionHash: string;
  approvalId: string;
  complianceReviewId: string;
  compliancePassed: boolean;
  idempotencyKey: string;
  payload: SocialPublishingJobRecord["payload"];
  localContext?: string;
  requestedById?: string;
  scheduledFor?: Date;
  maxAttempts?: number;
}) {
  const now = new Date();
  const maxAttempts = Math.min(Math.max(input.maxAttempts ?? 3, 1), 5);
  const nextAttemptAt =
    input.scheduledFor && input.scheduledFor > now ? input.scheduledFor : now;
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "create_job",
      {
        workspaceId: input.workspaceId,
        provider: input.provider,
        connectorId: input.connectorId,
        contentType: input.contentType,
        contentVersionHash: input.contentVersionHash,
        approvedVersionHash: input.approvedVersionHash,
        approvalId: input.approvalId,
        complianceReviewId: input.complianceReviewId,
        compliancePassed: input.compliancePassed,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        localContext: input.localContext ?? null,
        maxAttempts,
        nextAttemptAt: nextAttemptAt.toISOString(),
        requestedById: input.requestedById ?? null,
        scheduledFor: input.scheduledFor
          ? input.scheduledFor.toISOString()
          : null,
        now: now.toISOString(),
      },
    );
    return jobFromResponse(body);
  } catch (error) {
    return gatewayError(error);
  }
}

export async function listSocialPublishingJobsViaGateway(input: {
  workspaceId: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "list_jobs",
      { workspaceId: input.workspaceId, limit },
    );
    return jobsFromResponse(body);
  } catch (error) {
    return gatewayError(error);
  }
}

export async function claimSocialPublishingJobsViaGateway(
  limit = 10,
  options: { slotEnd?: Date | null } = {},
) {
  const claimId = randomUUID();
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + CLAIM_TTL_MS);
  const boundedLimit = Math.min(Math.max(limit, 1), 25);
  const slotEnd = options.slotEnd ?? null;
  // Resolved caps/spacing (including the JSON env overrides) travel as
  // parameters; the RPC must not re-implement the override parsing.
  const spacingMinutes: Record<string, number> = {};
  const slotCaps: Record<string, number> = {};
  for (const provider of sharedSocialPublishingProviders) {
    spacingMinutes[provider] = providerMinSpacingMinutes(provider);
    slotCaps[provider] = providerSlotBatchCap(provider);
  }
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "claim_jobs",
      {
        now: now.toISOString(),
        slotEnd: slotEnd ? slotEnd.toISOString() : null,
        claimId,
        claimExpiresAt: claimExpiresAt.toISOString(),
        limit: boundedLimit,
        spacingMinutes,
        slotCaps,
      },
    );
    return jobsFromResponse(body);
  } catch (error) {
    return gatewayError(error);
  }
}

export async function markSocialPublishingJobPublishedViaGateway(input: {
  job: SocialPublishingJobRecord;
  externalPostId: string;
  externalPostUrl?: string;
  providerStatusCode?: number;
  safeMetadata?: unknown;
}) {
  const now = new Date();
  const metadata = redactSecrets(input.safeMetadata ?? {});
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "mark_published",
      {
        jobId: input.job.id,
        claimId: input.job.claimId,
        externalPostId: input.externalPostId,
        externalPostUrl: input.externalPostUrl ?? null,
        providerStatusCode: input.providerStatusCode ?? null,
        safeMetadata: metadata,
        now: now.toISOString(),
      },
    );
    return jobFromResponse(body);
  } catch (error) {
    return gatewayError(error);
  }
}

export async function markSocialPublishingJobBlockedViaGateway(input: {
  job: SocialPublishingJobRecord;
  errorCode: string;
  errorMessage: string;
  metadata?: unknown;
}) {
  const now = new Date();
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "mark_blocked",
      {
        jobId: input.job.id,
        claimId: input.job.claimId,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        safeMetadata: redactSecrets(input.metadata ?? {}),
        now: now.toISOString(),
      },
    );
    return jobFromResponse(body);
  } catch (error) {
    return gatewayError(error);
  }
}

export async function markSocialPublishingJobFailedViaGateway(input: {
  job: SocialPublishingJobRecord;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  providerStatusCode?: number;
  metadata?: unknown;
}) {
  const retry =
    input.retryable && input.job.attemptCount < input.job.maxAttempts;
  const state: SocialPublishingJobState = retry
    ? "RETRYING"
    : input.retryable
      ? "DEAD_LETTER"
      : "FAILED";
  const outcome = state as "RETRYING" | "FAILED" | "DEAD_LETTER";
  const delayMs = Math.min(
    60_000 * 2 ** Math.max(input.job.attemptCount - 1, 0),
    15 * 60_000,
  );
  const now = new Date();
  const nextAttemptAt = retry ? new Date(now.getTime() + delayMs) : now;
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "mark_failed",
      {
        jobId: input.job.id,
        claimId: input.job.claimId,
        state,
        nextAttemptAt: nextAttemptAt.toISOString(),
        completedAt: retry ? null : now.toISOString(),
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        providerStatusCode: input.providerStatusCode ?? null,
        safeMetadata: redactSecrets(input.metadata ?? {}),
        outcome,
        now: now.toISOString(),
      },
    );
    return jobFromResponse(body);
  } catch (error) {
    return gatewayError(error);
  }
}

export async function markSocialConnectorForReauthorizationViaGateway(input: {
  workspaceId: string;
  connectorId: string;
  reasonCode: string;
}) {
  const metadata = {
    publishingReauthorizationReason: input.reasonCode,
    publishingReauthorizationRecordedAt: new Date().toISOString(),
    externalPublishingEnabled: false,
  };
  try {
    await socialPublishingGateway<Record<string, unknown>>(
      "mark_reauthorization",
      {
        workspaceId: input.workspaceId,
        connectorId: input.connectorId,
        metadata,
      },
    );
  } catch (error) {
    return gatewayError(error);
  }
}
