import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enforceEmergencyLocks, TokMetricError } from "@/lib/tokmetric/security";
import type { SharedSocialPublishingProvider } from "../publishing/types";
import {
  getSocialAutopilotProviderPolicy,
  isSocialAutopilotProviderPausedByConfig,
  type SocialEnvSource,
} from "./policy";

/**
 * Social Autopilot governance: emergency kill switch, provider-scoped pause,
 * queue-depth caps, cooldown, and failure/rate-limit backoff.
 *
 * Fail-closed posture:
 * - The global emergency stop (`globalEmergencyLock` / `publishingDisabled`)
 *   is checked before any orchestration or materialization run. When locked,
 *   a 423 TOKMETRIC_LOCKED error is thrown and the run stops.
 * - Provider-scoped pause is resolved defensively from three sources:
 *   1. WS-A's `social_provider_pauses` table (source of truth; mapped from
 *      WS-A's control-plane provider enum to autopilot provider ids).
 *   2. Env pause knobs (`SOCIAL_AUTOPILOT_<PROVIDER>_PAUSED`,
 *      `SOCIAL_AUTOPILOT_PAUSE_ALL`).
 *   3. Connector `disabled_at` (WS-A pause state on the connector record).
 * - Provider-health auto-pause: sustained publishing failures or recent
 *   rate-limit hits pause new scheduling with exponential/fixed backoff.
 */

// ── Emergency kill switch ────────────────────────────────────────────────

export async function assertSocialAutopilotKillSwitchClear(
  workspaceId: string,
): Promise<void> {
  // Covers workspace.globalEmergencyLock and workspace.publishingDisabled.
  await enforceEmergencyLocks(workspaceId, "publish");
}

// ── Provider-scoped pause ────────────────────────────────────────────────

/**
 * WS-A control-plane provider enum (`social_provider_pauses.provider`) to
 * autopilot provider id mapping. META covers both Meta surfaces.
 */
const autopilotToControlPlaneProvider: Record<
  SharedSocialPublishingProvider,
  string
> = {
  FACEBOOK_PAGE: "META",
  INSTAGRAM_PROFESSIONAL: "META",
  X: "X",
  LINKEDIN_COMPANY: "LINKEDIN",
  YOUTUBE: "YOUTUBE",
  NEXTDOOR: "NEXTDOOR",
  TELEGRAM: "TELEGRAM",
};

export interface ProviderPauseState {
  paused: boolean;
  reason?:
    | "AUTOPILOT_PROVIDER_PAUSED_WORKSPACE"
    | "AUTOPILOT_PROVIDER_PAUSED_CONFIG"
    | "AUTOPILOT_PROVIDER_CONNECTOR_DISABLED";
}

export function resolveProviderPauseState(input: {
  provider: SharedSocialPublishingProvider;
  env?: SocialEnvSource;
  connectorDisabledAt?: Date | null;
  workspacePausedProviders?: readonly string[] | null;
}): ProviderPauseState {
  const pausedProviders = (input.workspacePausedProviders ?? [])
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (pausedProviders.includes(input.provider)) {
    return { paused: true, reason: "AUTOPILOT_PROVIDER_PAUSED_WORKSPACE" };
  }
  if (isSocialAutopilotProviderPausedByConfig(input.provider, input.env)) {
    return { paused: true, reason: "AUTOPILOT_PROVIDER_PAUSED_CONFIG" };
  }
  if (input.connectorDisabledAt) {
    return { paused: true, reason: "AUTOPILOT_PROVIDER_CONNECTOR_DISABLED" };
  }
  return { paused: false };
}

/**
 * Reads workspace-level provider pauses from WS-A's source of truth,
 * `social_provider_pauses` (one row per paused provider per workspace;
 * absence of a row means "not paused"). Returns autopilot provider ids.
 * Defensive: when the table/migration is absent the query throws and this
 * returns an empty list (no pauses can exist without the table).
 */
export async function getWorkspacePausedProviders(
  workspaceId: string,
): Promise<readonly string[]> {
  try {
    const rows = await db.$queryRaw<Array<{ provider: string }>>(
      Prisma.sql`
        SELECT provider
        FROM social_provider_pauses
        WHERE workspace_id = ${workspaceId}
      `,
    );
    const pausedControlPlaneProviders = new Set(
      rows
        .map((row) => row.provider)
        .filter(
          (value): value is string =>
            typeof value === "string" && Boolean(value.trim()),
        ),
    );
    return (
      Object.keys(
        autopilotToControlPlaneProvider,
      ) as SharedSocialPublishingProvider[]
    ).filter((provider) =>
      pausedControlPlaneProviders.has(autopilotToControlPlaneProvider[provider]),
    );
  } catch {
    return [];
  }
}

// ── Scheduling health: queue depth, cooldown, failure & rate-limit backoff ──

export type ProviderSchedulingBlockReason =
  | "PROVIDER_QUEUE_DEPTH_LIMIT"
  | "PROVIDER_COOLDOWN_ACTIVE"
  | "PROVIDER_FAILURE_BACKOFF_ACTIVE"
  | "PROVIDER_RATE_LIMIT_BACKOFF_ACTIVE";

export interface ProviderSchedulingHealth {
  allowed: boolean;
  blockedReason?: ProviderSchedulingBlockReason;
  pendingJobCount: number;
  recentFailureCount: number;
  recentRateLimitCount: number;
  lastMaterializedAt: Date | null;
  backoffResumeAt?: Date;
}

interface ProviderJobTelemetry {
  pendingCount: number;
  lastMaterializedAt: Date | null;
  failureCount: number;
  lastFailureAt: Date | null;
  rateLimitCount: number;
  lastRateLimitAt: Date | null;
}

async function loadProviderJobTelemetry(input: {
  workspaceId: string;
  provider: SharedSocialPublishingProvider;
  failureSince: Date;
  rateLimitSince: Date;
}): Promise<ProviderJobTelemetry> {
  try {
    const [pending, failures, rateLimits] = await Promise.all([
      db.$queryRaw<Array<{ pending: number; lastCreated: Date | null }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS pending,
                 MAX(created_at) AS "lastCreated"
          FROM social_publishing_jobs
          WHERE workspace_id = ${input.workspaceId}
            AND provider = ${input.provider}
            AND state IN ('PENDING', 'CLAIMED', 'RETRYING')
        `,
      ),
      db.$queryRaw<Array<{ failures: number; lastFailure: Date | null }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS failures,
                 MAX(updated_at) AS "lastFailure"
          FROM social_publishing_jobs
          WHERE workspace_id = ${input.workspaceId}
            AND provider = ${input.provider}
            AND state IN ('FAILED', 'DEAD_LETTER')
            AND updated_at >= ${input.failureSince}
        `,
      ),
      db.$queryRaw<Array<{ hits: number; lastHit: Date | null }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS hits,
                 MAX(updated_at) AS "lastHit"
          FROM social_publishing_jobs
          WHERE workspace_id = ${input.workspaceId}
            AND provider = ${input.provider}
            AND updated_at >= ${input.rateLimitSince}
            AND (
              last_error_code ILIKE '%rate_limit%'
              OR last_error_message ILIKE '%rate limit%'
            )
        `,
      ),
    ]);
    return {
      pendingCount: pending[0]?.pending ?? 0,
      lastMaterializedAt: pending[0]?.lastCreated ?? null,
      failureCount: failures[0]?.failures ?? 0,
      lastFailureAt: failures[0]?.lastFailure ?? null,
      rateLimitCount: rateLimits[0]?.hits ?? 0,
      lastRateLimitAt: rateLimits[0]?.lastHit ?? null,
    };
  } catch {
    // Fail closed on telemetry errors: block scheduling rather than
    // scheduling blind when the health picture is unknown.
    return {
      pendingCount: Number.MAX_SAFE_INTEGER,
      lastMaterializedAt: null,
      failureCount: Number.MAX_SAFE_INTEGER,
      lastFailureAt: null,
      rateLimitCount: Number.MAX_SAFE_INTEGER,
      lastRateLimitAt: null,
    };
  }
}

/**
 * Pure backoff core. Once `failureCount` reaches `threshold`, scheduling
 * pauses until `lastFailureAt + backoffMinutes`, where the backoff grows
 * exponentially with each failure beyond the threshold (capped at 24h).
 */
export function failureBackoffStatus(input: {
  failureCount: number;
  threshold: number;
  baseMinutes: number;
  multiplier: number;
  lastFailureAt: Date | null;
  now: Date;
}): { active: boolean; resumeAt?: Date } {
  if (input.failureCount < input.threshold || !input.lastFailureAt) {
    return { active: false };
  }
  const steps = Math.max(0, input.failureCount - input.threshold);
  const minutes = Math.min(
    1440,
    input.baseMinutes * Math.pow(input.multiplier, steps),
  );
  const resumeAt = new Date(
    input.lastFailureAt.getTime() + minutes * 60 * 1000,
  );
  return input.now < resumeAt ? { active: true, resumeAt } : { active: false };
}

/**
 * Pure rate-limit backoff core: any rate-limit hit inside the window pauses
 * new scheduling for a fixed cooldown from the most recent hit.
 */
export function rateLimitBackoffStatus(input: {
  rateLimitCount: number;
  backoffMinutes: number;
  lastRateLimitAt: Date | null;
  now: Date;
}): { active: boolean; resumeAt?: Date } {
  if (input.rateLimitCount < 1 || !input.lastRateLimitAt) {
    return { active: false };
  }
  const resumeAt = new Date(
    input.lastRateLimitAt.getTime() + input.backoffMinutes * 60 * 1000,
  );
  return input.now < resumeAt ? { active: true, resumeAt } : { active: false };
}

/**
 * Pure cooldown core: blocks when a previous materialization created jobs
 * more recently than `cooldownMinutes` ago.
 */
export function cooldownAllowsScheduling(input: {
  lastMaterializedAt: Date | null;
  cooldownMinutes: number;
  now: Date;
}): boolean {
  if (!input.lastMaterializedAt || input.cooldownMinutes <= 0) return true;
  return (
    input.now.getTime() - input.lastMaterializedAt.getTime() >=
    input.cooldownMinutes * 60 * 1000
  );
}

export async function evaluateProviderSchedulingHealth(input: {
  workspaceId: string;
  provider: SharedSocialPublishingProvider;
  now?: Date;
  env?: SocialEnvSource;
}): Promise<ProviderSchedulingHealth> {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const policy = getSocialAutopilotProviderPolicy(input.provider, env);
  const telemetry = await loadProviderJobTelemetry({
    workspaceId: input.workspaceId,
    provider: input.provider,
    failureSince: new Date(
      now.getTime() - policy.failureWindowMinutes * 60 * 1000,
    ),
    rateLimitSince: new Date(
      now.getTime() - policy.rateLimitWindowMinutes * 60 * 1000,
    ),
  });

  const base: Omit<ProviderSchedulingHealth, "allowed" | "blockedReason"> = {
    pendingJobCount: telemetry.pendingCount,
    recentFailureCount: telemetry.failureCount,
    recentRateLimitCount: telemetry.rateLimitCount,
    lastMaterializedAt: telemetry.lastMaterializedAt,
  };

  if (telemetry.pendingCount >= policy.maxQueueDepth) {
    return {
      ...base,
      allowed: false,
      blockedReason: "PROVIDER_QUEUE_DEPTH_LIMIT",
    };
  }
  if (
    !cooldownAllowsScheduling({
      lastMaterializedAt: telemetry.lastMaterializedAt,
      cooldownMinutes: policy.cooldownMinutes,
      now,
    })
  ) {
    return { ...base, allowed: false, blockedReason: "PROVIDER_COOLDOWN_ACTIVE" };
  }
  const rateLimit = rateLimitBackoffStatus({
    rateLimitCount: telemetry.rateLimitCount,
    backoffMinutes: policy.rateLimitBackoffMinutes,
    lastRateLimitAt: telemetry.lastRateLimitAt,
    now,
  });
  if (rateLimit.active) {
    return {
      ...base,
      allowed: false,
      blockedReason: "PROVIDER_RATE_LIMIT_BACKOFF_ACTIVE",
      backoffResumeAt: rateLimit.resumeAt,
    };
  }
  const failure = failureBackoffStatus({
    failureCount: telemetry.failureCount,
    threshold: policy.failurePauseThreshold,
    baseMinutes: policy.failureBackoffBaseMinutes,
    multiplier: policy.failureBackoffMultiplier,
    lastFailureAt: telemetry.lastFailureAt,
    now,
  });
  if (failure.active) {
    return {
      ...base,
      allowed: false,
      blockedReason: "PROVIDER_FAILURE_BACKOFF_ACTIVE",
      backoffResumeAt: failure.resumeAt,
    };
  }
  return { ...base, allowed: true };
}

export function isKillSwitchError(error: unknown): error is TokMetricError {
  return error instanceof TokMetricError && error.code === "TOKMETRIC_LOCKED";
}
