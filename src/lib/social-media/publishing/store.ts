import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  redactSecrets,
  TokMetricError,
} from "@/lib/tokmetric/security";
import type { SocialContentType } from "@/lib/social-media/policy";
import type {
  SharedSocialPublishingProvider,
  SocialPublishingJobRecord,
  SocialPublishingJobState,
  SocialPublishingPayload,
} from "./types";

const CLAIM_TTL_MS = 2 * 60 * 1000;

interface SocialPublishingJobRow {
  id: string;
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
  payload: unknown;
  localContext: string | null;
  state: SocialPublishingJobState;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  claimId: string | null;
  claimExpiresAt: Date | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  safeProviderMetadata: unknown;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  requestedById: string | null;
  scheduledFor: Date | null;
  claimedAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobSelection = Prisma.sql`
  id,
  workspace_id AS "workspaceId",
  provider,
  connector_id AS "connectorId",
  content_type AS "contentType",
  content_version_hash AS "contentVersionHash",
  approved_version_hash AS "approvedVersionHash",
  approval_id AS "approvalId",
  compliance_review_id AS "complianceReviewId",
  compliance_passed AS "compliancePassed",
  idempotency_key AS "idempotencyKey",
  payload,
  local_context AS "localContext",
  state,
  attempt_count AS "attemptCount",
  max_attempts AS "maxAttempts",
  next_attempt_at AS "nextAttemptAt",
  claim_id AS "claimId",
  claim_expires_at AS "claimExpiresAt",
  external_post_id AS "externalPostId",
  external_post_url AS "externalPostUrl",
  safe_provider_metadata AS "safeProviderMetadata",
  last_error_code AS "lastErrorCode",
  last_error_message AS "lastErrorMessage",
  requested_by_id AS "requestedById",
  scheduled_for AS "scheduledFor",
  claimed_at AS "claimedAt",
  submitted_at AS "submittedAt",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function job(row: SocialPublishingJobRow): SocialPublishingJobRecord {
  return {
    ...row,
    payload: object(row.payload) as SocialPublishingPayload,
    safeProviderMetadata: object(row.safeProviderMetadata),
  };
}

function isMissingStore(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    text.includes("social_publishing_jobs") &&
    (text.includes("does not exist") ||
      text.includes("42p01") ||
      text.includes("p2010"))
  );
}

function storeUnavailable(error: unknown): never {
  if (isMissingStore(error)) {
    throw new TokMetricError(
      503,
      "SOCIAL_PUBLISHING_STORE_NOT_PROVISIONED",
      "The governed social publishing queue has not been provisioned.",
    );
  }
  throw error;
}

export async function createSocialPublishingJob(input: {
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
  payload: SocialPublishingPayload;
  localContext?: string;
  requestedById?: string;
  scheduledFor?: Date;
  maxAttempts?: number;
}) {
  const now = new Date();
  const id = randomUUID();
  const maxAttempts = Math.min(Math.max(input.maxAttempts ?? 3, 1), 5);
  const nextAttemptAt = input.scheduledFor && input.scheduledFor > now
    ? input.scheduledFor
    : now;

  try {
    return await db.$transaction(async (transaction) => {
      const connector = await transaction.$queryRaw<Array<{
        id: string;
        workspaceId: string;
      }>>(Prisma.sql`
        SELECT id, workspace_id AS "workspaceId"
        FROM social_connectors
        WHERE id = ${input.connectorId}
          AND workspace_id = ${input.workspaceId}
          AND disabled_at IS NULL
        LIMIT 1
      `);
      if (!connector[0]) {
        throw new TokMetricError(
          404,
          "SOCIAL_CONNECTOR_NOT_FOUND",
          "The selected social connector was not found in this workspace.",
        );
      }

      const existing = await transaction.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
        SELECT ${jobSelection}
        FROM social_publishing_jobs
        WHERE workspace_id = ${input.workspaceId}
          AND idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `);
      if (existing[0]) {
        const current = job(existing[0]);
        const sameRequest =
          current.provider === input.provider &&
          current.connectorId === input.connectorId &&
          current.contentVersionHash === input.contentVersionHash &&
          current.approvedVersionHash === input.approvedVersionHash;
        if (!sameRequest) {
          throw new TokMetricError(
            409,
            "SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT",
            "The idempotency key is already bound to a different publishing request.",
          );
        }
        return current;
      }

      const rows = await transaction.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
        INSERT INTO social_publishing_jobs (
          id,
          workspace_id,
          provider,
          connector_id,
          content_type,
          content_version_hash,
          approved_version_hash,
          approval_id,
          compliance_review_id,
          compliance_passed,
          idempotency_key,
          payload,
          local_context,
          state,
          max_attempts,
          next_attempt_at,
          requested_by_id,
          scheduled_for,
          created_at,
          updated_at
        ) VALUES (
          ${id},
          ${input.workspaceId},
          ${input.provider},
          ${input.connectorId},
          ${input.contentType},
          ${input.contentVersionHash},
          ${input.approvedVersionHash},
          ${input.approvalId},
          ${input.complianceReviewId},
          ${input.compliancePassed},
          ${input.idempotencyKey},
          CAST(${JSON.stringify(input.payload)} AS jsonb),
          ${input.localContext ?? null},
          'PENDING',
          ${maxAttempts},
          ${nextAttemptAt},
          ${input.requestedById ?? null},
          ${input.scheduledFor ?? null},
          ${now},
          ${now}
        )
        RETURNING ${jobSelection}
      `);
      if (!rows[0]) throw new Error("Publishing job was not returned after creation.");
      return job(rows[0]);
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function listSocialPublishingJobs(input: {
  workspaceId: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  try {
    const rows = await db.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
      SELECT ${jobSelection}
      FROM social_publishing_jobs
      WHERE workspace_id = ${input.workspaceId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return rows.map(job);
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function countSocialPublishingJobsForWindow(input: {
  workspaceId: string;
  provider: SharedSocialPublishingProvider;
  start: Date;
  end: Date;
}) {
  try {
    const rows = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM social_publishing_jobs
      WHERE workspace_id = ${input.workspaceId}
        AND provider = ${input.provider}
        AND COALESCE(scheduled_for, created_at) >= ${input.start}
        AND COALESCE(scheduled_for, created_at) < ${input.end}
        AND state <> 'CANCELLED'
    `);
    return rows[0]?.count ?? 0;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function hasRecentSocialPublishingFingerprint(input: {
  workspaceId: string;
  provider: SharedSocialPublishingProvider;
  fingerprint: string;
  since: Date;
}) {
  try {
    const rows = await db.$queryRaw<Array<{ found: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM social_publishing_jobs
        WHERE workspace_id = ${input.workspaceId}
          AND provider = ${input.provider}
          AND state <> 'CANCELLED'
          AND created_at >= ${input.since}
          AND payload -> 'metadata' ->> 'autopilotFingerprint' = ${input.fingerprint}
      ) AS found
    `);
    return Boolean(rows[0]?.found);
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function cancelPendingSocialAutopilotJobs(input: {
  workspaceId: string;
  policyVersion?: string;
}) {
  const now = new Date();
  try {
    const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE social_publishing_jobs
      SET
        state = 'CANCELLED',
        claim_id = NULL,
        claim_expires_at = NULL,
        completed_at = ${now},
        updated_at = ${now},
        last_error_code = 'SOCIAL_AUTOPILOT_CANCELLED',
        last_error_message = 'Cancelled by the Social Autopilot rollback control.'
      WHERE workspace_id = ${input.workspaceId}
        AND state IN ('PENDING', 'RETRYING')
        AND payload -> 'metadata' ->> 'autopilot' = 'true'
        AND (
          ${input.policyVersion ?? null}::text IS NULL
          OR payload -> 'metadata' ->> 'autopilotPolicyVersion' = ${input.policyVersion ?? null}
        )
      RETURNING id
    `);
    return { cancelled: rows.length, jobIds: rows.map((row) => row.id) };
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function claimSocialPublishingJobs(limit = 10) {
  const claimId = randomUUID();
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + CLAIM_TTL_MS);
  const boundedLimit = Math.min(Math.max(limit, 1), 25);
  try {
    const rows = await db.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM social_publishing_jobs
        WHERE (
          state IN ('PENDING', 'RETRYING')
          AND next_attempt_at <= ${now}
          AND (scheduled_for IS NULL OR scheduled_for <= ${now})
        ) OR (
          state = 'CLAIMED'
          AND claim_expires_at IS NOT NULL
          AND claim_expires_at <= ${now}
        )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${boundedLimit}
      )
      UPDATE social_publishing_jobs jobs
      SET
        state = 'CLAIMED',
        attempt_count = jobs.attempt_count + 1,
        claim_id = ${claimId},
        claim_expires_at = ${claimExpiresAt},
        claimed_at = ${now},
        updated_at = ${now}
      FROM candidates
      WHERE jobs.id = candidates.id
      RETURNING ${jobSelection}
    `);
    return rows.map(job);
  } catch (error) {
    return storeUnavailable(error);
  }
}

async function recordAttempt(input: {
  transaction: Prisma.TransactionClient;
  job: SocialPublishingJobRecord;
  outcome: "PUBLISHED" | "RETRYING" | "FAILED" | "DEAD_LETTER" | "BLOCKED";
  errorCode?: string;
  errorMessage?: string;
  providerStatusCode?: number;
  metadata?: unknown;
}) {
  await input.transaction.$executeRaw(Prisma.sql`
    INSERT INTO social_publishing_attempts (
      id,
      job_id,
      attempt_number,
      outcome,
      error_code,
      error_message,
      provider_status_code,
      safe_metadata,
      started_at,
      completed_at
    ) VALUES (
      ${randomUUID()},
      ${input.job.id},
      ${input.job.attemptCount},
      ${input.outcome},
      ${input.errorCode ?? null},
      ${input.errorMessage ?? null},
      ${input.providerStatusCode ?? null},
      CAST(${JSON.stringify(redactSecrets(input.metadata ?? {}))} AS jsonb),
      ${input.job.claimedAt ?? new Date()},
      ${new Date()}
    )
    ON CONFLICT (job_id, attempt_number) DO NOTHING
  `);
}

export async function markSocialPublishingJobPublished(input: {
  job: SocialPublishingJobRecord;
  externalPostId: string;
  externalPostUrl?: string;
  providerStatusCode?: number;
  safeMetadata?: unknown;
}) {
  const now = new Date();
  const metadata = redactSecrets(input.safeMetadata ?? {});
  try {
    return await db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
        UPDATE social_publishing_jobs
        SET
          state = 'PUBLISHED',
          external_post_id = ${input.externalPostId},
          external_post_url = ${input.externalPostUrl ?? null},
          provider_status_code = ${input.providerStatusCode ?? null},
          safe_provider_metadata = CAST(${JSON.stringify(metadata)} AS jsonb),
          claim_id = NULL,
          claim_expires_at = NULL,
          submitted_at = ${now},
          completed_at = ${now},
          updated_at = ${now}
        WHERE id = ${input.job.id}
          AND claim_id = ${input.job.claimId}
          AND state = 'CLAIMED'
        RETURNING ${jobSelection}
      `);
      if (!rows[0]) {
        throw new TokMetricError(
          409,
          "SOCIAL_PUBLISHING_CLAIM_LOST",
          "The publishing job claim expired before completion.",
        );
      }
      await recordAttempt({
        transaction,
        job: input.job,
        outcome: "PUBLISHED",
        providerStatusCode: input.providerStatusCode,
        metadata,
      });
      return job(rows[0]);
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function markSocialPublishingJobBlocked(input: {
  job: SocialPublishingJobRecord;
  errorCode: string;
  errorMessage: string;
  metadata?: unknown;
}) {
  const now = new Date();
  try {
    return await db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
        UPDATE social_publishing_jobs
        SET
          state = 'BLOCKED',
          last_error_code = ${input.errorCode},
          last_error_message = ${input.errorMessage},
          safe_provider_metadata = CAST(${JSON.stringify(redactSecrets(input.metadata ?? {}))} AS jsonb),
          claim_id = NULL,
          claim_expires_at = NULL,
          completed_at = ${now},
          updated_at = ${now}
        WHERE id = ${input.job.id}
          AND claim_id = ${input.job.claimId}
          AND state = 'CLAIMED'
        RETURNING ${jobSelection}
      `);
      if (!rows[0]) {
        throw new TokMetricError(
          409,
          "SOCIAL_PUBLISHING_CLAIM_LOST",
          "The publishing job claim expired before it could be blocked.",
        );
      }
      await recordAttempt({
        transaction,
        job: input.job,
        outcome: "BLOCKED",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
      });
      return job(rows[0]);
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function markSocialPublishingJobFailed(input: {
  job: SocialPublishingJobRecord;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  providerStatusCode?: number;
  metadata?: unknown;
}) {
  const retry = input.retryable && input.job.attemptCount < input.job.maxAttempts;
  const state: SocialPublishingJobState = retry
    ? "RETRYING"
    : input.retryable
      ? "DEAD_LETTER"
      : "FAILED";
  const outcome = state as "RETRYING" | "FAILED" | "DEAD_LETTER";
  const delayMs = Math.min(60_000 * 2 ** Math.max(input.job.attemptCount - 1, 0), 15 * 60_000);
  const now = new Date();
  const nextAttemptAt = retry ? new Date(now.getTime() + delayMs) : now;

  try {
    return await db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<SocialPublishingJobRow[]>(Prisma.sql`
        UPDATE social_publishing_jobs
        SET
          state = ${state},
          next_attempt_at = ${nextAttemptAt},
          provider_status_code = ${input.providerStatusCode ?? null},
          safe_provider_metadata = CAST(${JSON.stringify(redactSecrets(input.metadata ?? {}))} AS jsonb),
          last_error_code = ${input.errorCode},
          last_error_message = ${input.errorMessage},
          claim_id = NULL,
          claim_expires_at = NULL,
          completed_at = ${retry ? null : now},
          updated_at = ${now}
        WHERE id = ${input.job.id}
          AND claim_id = ${input.job.claimId}
          AND state = 'CLAIMED'
        RETURNING ${jobSelection}
      `);
      if (!rows[0]) {
        throw new TokMetricError(
          409,
          "SOCIAL_PUBLISHING_CLAIM_LOST",
          "The publishing job claim expired before failure handling completed.",
        );
      }
      await recordAttempt({
        transaction,
        job: input.job,
        outcome,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        providerStatusCode: input.providerStatusCode,
        metadata: input.metadata,
      });
      return job(rows[0]);
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function markSocialConnectorForReauthorization(input: {
  workspaceId: string;
  connectorId: string;
  reasonCode: string;
}) {
  const metadata = JSON.stringify({
    publishingReauthorizationReason: input.reasonCode,
    publishingReauthorizationRecordedAt: new Date().toISOString(),
    externalPublishingEnabled: false,
  });
  try {
    await db.$executeRaw(Prisma.sql`
      UPDATE social_connectors
      SET
        state = 'REAUTHORIZATION_REQUIRED',
        safe_metadata = safe_metadata || CAST(${metadata} AS jsonb),
        last_health_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.connectorId}
        AND workspace_id = ${input.workspaceId}
        AND disabled_at IS NULL
    `);
  } catch (error) {
    return storeUnavailable(error);
  }
}
