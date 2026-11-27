import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { contentHash, TokMetricError } from "@/lib/tokmetric/security";

export type VideoRenderJobState =
  | "DISPATCHING"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "FINALIZING"
  | "FINALIZED";

export type VideoRenderJobRecord = {
  id: string;
  workspaceId: string;
  contentId: string;
  contentVersionId: string;
  complianceReviewId: string;
  requestedById: string | null;
  provider: "comfyui-local";
  clientId: string;
  externalPromptId: string | null;
  idempotencyKey: string;
  requestHash: string;
  dispatchPayload: Record<string, unknown>;
  dispatchAttemptCount: number;
  dispatchClaimId: string | null;
  dispatchClaimExpiresAt: Date | null;
  dispatchedAt: Date | null;
  state: VideoRenderJobState;
  errorCode: string | null;
  errorMessage: string | null;
  outputManifest: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  finalizedAt: Date | null;
};

export type VideoRenderUploadRecord = {
  id: string;
  renderJobId: string;
  storageRef: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  safeMetadata: Record<string, unknown>;
  verifiedAt: Date;
};

type VideoRenderJobRow = Omit<
  VideoRenderJobRecord,
  "dispatchPayload" | "outputManifest"
> & {
  dispatchPayload: unknown;
  outputManifest: unknown;
};
type VideoRenderUploadRow = Omit<
  VideoRenderUploadRecord,
  "fileSize" | "safeMetadata"
> & {
  fileSize: bigint | number;
  safeMetadata: unknown;
};

const jobSelection = Prisma.sql`
  id,
  workspace_id AS "workspaceId",
  content_id AS "contentId",
  content_version_id AS "contentVersionId",
  compliance_review_id AS "complianceReviewId",
  requested_by_id AS "requestedById",
  provider,
  client_id AS "clientId",
  external_prompt_id AS "externalPromptId",
  idempotency_key AS "idempotencyKey",
  request_hash AS "requestHash",
  dispatch_payload AS "dispatchPayload",
  dispatch_attempt_count AS "dispatchAttemptCount",
  dispatch_claim_id AS "dispatchClaimId",
  dispatch_claim_expires_at AS "dispatchClaimExpiresAt",
  dispatched_at AS "dispatchedAt",
  state,
  error_code AS "errorCode",
  error_message AS "errorMessage",
  output_manifest AS "outputManifest",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt",
  finalized_at AS "finalizedAt"
`;

const uploadSelection = Prisma.sql`
  id,
  render_job_id AS "renderJobId",
  storage_ref AS "storageRef",
  file_name AS "fileName",
  mime_type AS "mimeType",
  file_size AS "fileSize",
  checksum_sha256 AS "checksumSha256",
  safe_metadata AS "safeMetadata",
  verified_at AS "verifiedAt"
`;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function job(row: VideoRenderJobRow): VideoRenderJobRecord {
  return {
    ...row,
    dispatchPayload: object(row.dispatchPayload),
    outputManifest: object(row.outputManifest),
  };
}

function upload(row: VideoRenderUploadRow): VideoRenderUploadRecord {
  return {
    ...row,
    fileSize: Number(row.fileSize),
    safeMetadata: object(row.safeMetadata),
  };
}

function isMissingStore(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    (text.includes("video_render_jobs") || text.includes("video_render_uploads")) &&
    (text.includes("does not exist") ||
      text.includes("42p01") ||
      text.includes("p2010") ||
      text.includes("dispatch_payload"))
  );
}

function storeUnavailable(error: unknown): never {
  if (isMissingStore(error)) {
    throw new TokMetricError(
      503,
      "VIDEO_RENDER_STORE_NOT_PROVISIONED",
      "The durable video render store has not been provisioned.",
    );
  }
  throw error;
}

export async function createVideoRenderJob(input: {
  workspaceId: string;
  contentId: string;
  contentVersionId: string;
  complianceReviewId: string;
  requestedById: string;
  idempotencyKey: string;
  request: unknown;
  dispatchPayload?: Record<string, unknown>;
}) {
  const requestHash = contentHash(input.request);
  try {
    return await db.$transaction(async (transaction) => {
      const existing = await transaction.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
        SELECT ${jobSelection}
        FROM video_render_jobs
        WHERE workspace_id = ${input.workspaceId}
          AND idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `);
      if (existing[0]) {
        const current = job(existing[0]);
        if (current.requestHash !== requestHash) {
          throw new TokMetricError(
            409,
            "VIDEO_RENDER_IDEMPOTENCY_CONFLICT",
            "The idempotency key is already bound to a different render request.",
          );
        }
        return { record: current, reused: true };
      }

      const id = randomUUID();
      const rows = await transaction.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
        INSERT INTO video_render_jobs (
          id,
          workspace_id,
          content_id,
          content_version_id,
          compliance_review_id,
          requested_by_id,
          provider,
          client_id,
          idempotency_key,
          request_hash,
          dispatch_payload,
          state
        ) VALUES (
          ${id},
          ${input.workspaceId},
          ${input.contentId},
          ${input.contentVersionId},
          ${input.complianceReviewId},
          ${input.requestedById},
          'comfyui-local',
          ${id},
          ${input.idempotencyKey},
          ${requestHash},
          CAST(${JSON.stringify(input.dispatchPayload ?? {})} AS jsonb),
          'DISPATCHING'
        )
        RETURNING ${jobSelection}
      `);
      if (!rows[0]) throw new Error("Video render job was not returned after creation.");

      await transaction.approvalRequest.updateMany({
        where: {
          workspaceId: input.workspaceId,
          contentId: input.contentId,
          contentVersionId: input.contentVersionId,
          state: "APPROVAL_REQUIRED",
        },
        data: { state: "REVOKED" },
      });
      await transaction.content.update({
        where: { id: input.contentId },
        data: { state: "REVIEW_READY" },
      });

      return { record: job(rows[0]), reused: false };
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function getVideoRenderJobById(id: string) {
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      SELECT ${jobSelection}
      FROM video_render_jobs
      WHERE id = ${id}
      LIMIT 1
    `);
    return rows[0] ? job(rows[0]) : null;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function getVideoRenderJobByIdempotencyKey(input: {
  workspaceId: string;
  idempotencyKey: string;
}) {
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      SELECT ${jobSelection}
      FROM video_render_jobs
      WHERE workspace_id = ${input.workspaceId}
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `);
    return rows[0] ? job(rows[0]) : null;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function getVideoRenderJobByPromptId(promptId: string) {
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      SELECT ${jobSelection}
      FROM video_render_jobs
      WHERE external_prompt_id = ${promptId}
      LIMIT 1
    `);
    return rows[0] ? job(rows[0]) : null;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function latestVideoRenderJobForContent(input: {
  workspaceId: string;
  contentId: string;
}) {
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      SELECT ${jobSelection}
      FROM video_render_jobs
      WHERE workspace_id = ${input.workspaceId}
        AND content_id = ${input.contentId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return rows[0] ? job(rows[0]) : null;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function bindVideoRenderPrompt(input: {
  id: string;
  claimId: string;
  promptId: string;
}) {
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      UPDATE video_render_jobs
      SET external_prompt_id = ${input.promptId},
          state = 'QUEUED',
          dispatch_attempt_count = dispatch_attempt_count + 1,
          dispatch_claim_id = NULL,
          dispatch_claim_expires_at = NULL,
          dispatched_at = COALESCE(dispatched_at, CURRENT_TIMESTAMP),
          error_code = NULL,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
        AND state = 'DISPATCHING'
        AND external_prompt_id IS NULL
        AND dispatch_claim_id = ${input.claimId}
        AND dispatch_claim_expires_at > CURRENT_TIMESTAMP
      RETURNING ${jobSelection}
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        409,
        "VIDEO_RENDER_DISPATCH_CLAIM_INVALID",
        "The video render dispatch claim is missing, expired, or already completed.",
      );
    }
    return job(rows[0]);
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function releaseVideoRenderDispatchClaim(input: {
  id: string;
  claimId: string;
  retryable: boolean;
  errorCode: string;
  errorMessage: string;
  maximumAttempts?: number;
}) {
  const maximumAttempts = Math.min(Math.max(input.maximumAttempts ?? 5, 1), 20);
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      UPDATE video_render_jobs
      SET dispatch_attempt_count = dispatch_attempt_count + 1,
          state = CASE
            WHEN ${input.retryable}
              AND dispatch_attempt_count + 1 < ${maximumAttempts}
            THEN 'DISPATCHING'
            ELSE 'FAILED'
          END,
          dispatch_claim_id = NULL,
          dispatch_claim_expires_at = NULL,
          error_code = ${input.errorCode.slice(0, 100)},
          error_message = ${input.errorMessage.slice(0, 500)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
        AND state = 'DISPATCHING'
        AND dispatch_claim_id = ${input.claimId}
      RETURNING ${jobSelection}
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        409,
        "VIDEO_RENDER_DISPATCH_CLAIM_INVALID",
        "The video render dispatch claim is missing or already completed.",
      );
    }
    return job(rows[0]);
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function markVideoRenderQueued(input: {
  id: string;
  promptId: string;
}) {
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      UPDATE video_render_jobs
      SET external_prompt_id = ${input.promptId},
          state = 'QUEUED',
          dispatch_attempt_count = dispatch_attempt_count + 1,
          dispatched_at = COALESCE(dispatched_at, CURRENT_TIMESTAMP),
          dispatch_claim_id = NULL,
          dispatch_claim_expires_at = NULL,
          error_code = NULL,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
      RETURNING ${jobSelection}
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        404,
        "VIDEO_RENDER_JOB_NOT_FOUND",
        "The video render job was not found.",
      );
    }
    return job(rows[0]);
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function updateVideoRenderState(input: {
  id: string;
  state: VideoRenderJobState;
  outputManifest?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}) {
  const completedAt = input.state === "COMPLETED" ? new Date() : null;
  try {
    const rows = await db.$queryRaw<VideoRenderJobRow[]>(Prisma.sql`
      UPDATE video_render_jobs
      SET state = ${input.state},
          output_manifest = CAST(${JSON.stringify(input.outputManifest ?? {})} AS jsonb),
          error_code = ${input.errorCode ?? null},
          error_message = ${input.errorMessage?.slice(0, 500) ?? null},
          completed_at = COALESCE(${completedAt}, completed_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
      RETURNING ${jobSelection}
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        404,
        "VIDEO_RENDER_JOB_NOT_FOUND",
        "The video render job was not found.",
      );
    }
    return job(rows[0]);
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function recordVerifiedVideoUpload(input: {
  renderJobId: string;
  storageRef: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  safeMetadata?: Record<string, unknown>;
}) {
  try {
    return await db.$transaction(async (transaction) => {
      const existing = await transaction.$queryRaw<VideoRenderUploadRow[]>(Prisma.sql`
        SELECT ${uploadSelection}
        FROM video_render_uploads
        WHERE render_job_id = ${input.renderJobId}
        LIMIT 1
      `);
      if (existing[0]) {
        const current = upload(existing[0]);
        const same =
          current.storageRef === input.storageRef &&
          current.fileName === input.fileName &&
          current.mimeType === input.mimeType &&
          current.fileSize === input.fileSize &&
          current.checksumSha256 === input.checksumSha256;
        if (!same) {
          throw new TokMetricError(
            409,
            "VIDEO_UPLOAD_VERIFICATION_CONFLICT",
            "The render job is already bound to different uploaded media.",
          );
        }
        return current;
      }

      const rows = await transaction.$queryRaw<VideoRenderUploadRow[]>(Prisma.sql`
        INSERT INTO video_render_uploads (
          id,
          render_job_id,
          storage_ref,
          file_name,
          mime_type,
          file_size,
          checksum_sha256,
          safe_metadata
        ) VALUES (
          ${randomUUID()},
          ${input.renderJobId},
          ${input.storageRef},
          ${input.fileName},
          ${input.mimeType},
          ${input.fileSize},
          ${input.checksumSha256.toLowerCase()},
          CAST(${JSON.stringify(input.safeMetadata ?? {})} AS jsonb)
        )
        RETURNING ${uploadSelection}
      `);
      if (!rows[0]) throw new Error("Verified video upload was not returned after creation.");
      return upload(rows[0]);
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function getVerifiedVideoUpload(renderJobId: string) {
  try {
    const rows = await db.$queryRaw<VideoRenderUploadRow[]>(Prisma.sql`
      SELECT ${uploadSelection}
      FROM video_render_uploads
      WHERE render_job_id = ${renderJobId}
      LIMIT 1
    `);
    return rows[0] ? upload(rows[0]) : null;
  } catch (error) {
    return storeUnavailable(error);
  }
}
