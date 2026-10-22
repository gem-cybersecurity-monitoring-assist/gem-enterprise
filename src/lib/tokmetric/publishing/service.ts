import { Prisma, type TokMetricPublishState } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import {
  contentHash,
  emitDomainEvent,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  TokMetricError,
} from "@/lib/tokmetric/security";
import { getAuthorizedTikTokCredential } from "@/lib/tokmetric/oauth/connectors";
import { getTikTokOAuthConfig } from "@/lib/tokmetric/oauth/config";
import { enforceTokMetricPublishingGate, getTokMetricPublishingGate } from "./gates";
import {
  cancelTikTokPublish,
  fetchTikTokPublishStatus,
  initializeTikTokDirectPost,
  queryTikTokCreatorInfo,
  type TikTokDirectPostInput,
} from "./tiktok";
import {
  TIKTOK_VIDEO_MIME_TYPES,
  calculateTikTokChunkPlan,
  type TikTokApprovedVideoAsset,
  type TikTokPrivacyLevel,
  type TikTokVideoMimeType,
  type TikTokVideoSource,
} from "./types";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

async function addJobAttempt(publishJobId: string, state: TokMetricPublishState, metadata: unknown) {
  const attempt = await db.jobAttempt.count({ where: { publishJobId } }) + 1;
  await db.jobAttempt.create({
    data: {
      publishJobId,
      attempt,
      state,
      safeMetadata: toInputJson(metadata),
    },
  });
}

export function validateVerifiedMediaUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TokMetricError(400, "INVALID_VIDEO_URL", "Video URL must be a valid absolute URL.");
  }

  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new TokMetricError(400, "INVALID_VIDEO_URL", "Video URL must use HTTPS without credentials or fragments.");
  }

  const allowedHosts = (process.env.TOKMETRIC_VERIFIED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length === 0) {
    throw new TokMetricError(423, "VERIFIED_MEDIA_HOSTS_NOT_CONFIGURED", "PULL_FROM_URL is disabled until a verified media domain is configured.");
  }

  const hostname = url.hostname.toLowerCase();
  const allowed = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (!allowed) {
    throw new TokMetricError(403, "VIDEO_URL_NOT_VERIFIED", "Video URL is not hosted on an approved TikTok URL property.");
  }

  return url;
}

export async function getVideoPublishingContext(session: SessionPayload) {
  const privileged = ["admin", "super_admin", "internal"].includes(session.role);
  const workspaces = await db.workspace.findMany({
    where: privileged ? {} : { members: { some: { userId: session.userId, status: "active" } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      slug: true,
      globalEmergencyLock: true,
      publishingDisabled: true,
      connectors: {
        where: { provider: "TIKTOK_CONTENT_POSTING_API", state: "CONNECTED", disabledAt: null },
        select: { id: true, displayName: true, externalAccountId: true, grantedScopes: true, state: true },
      },
      contents: {
        where: { state: "APPROVED", currentVersionId: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { id: true, title: true, currentVersionId: true, state: true },
      },
      publishJobs: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          contentId: true,
          connectorId: true,
          internalState: true,
          externalState: true,
          externalRequestId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const currentVersionIds = workspaces.flatMap((workspace) =>
    workspace.contents.flatMap((content) =>
      content.currentVersionId ? [content.currentVersionId] : [],
    ),
  );
  const versions = currentVersionIds.length
    ? await db.contentVersion.findMany({
        where: { id: { in: currentVersionIds } },
        select: {
          id: true,
          caption: true,
          script: true,
          hashtags: true,
          mediaAssetIds: true,
        },
      })
    : [];
  const mediaAssetIds = [...new Set(versions.flatMap((version) => version.mediaAssetIds))];
  const mediaAssets = mediaAssetIds.length
    ? await db.mediaAsset.findMany({
        where: {
          id: { in: mediaAssetIds },
          mimeType: { in: [...TIKTOK_VIDEO_MIME_TYPES] },
        },
        select: {
          id: true,
          workspaceId: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          checksum: true,
          storageRef: true,
        },
      })
    : [];
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const mediaAssetById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

  const publishingWorkspaces = workspaces.map((workspace) => ({
    ...workspace,
    contents: workspace.contents.flatMap((content) => {
      const version = content.currentVersionId
        ? versionById.get(content.currentVersionId)
        : undefined;
      if (!version) return [];

      const approvedVideoAssets = version.mediaAssetIds.flatMap((assetId) => {
        const asset = mediaAssetById.get(assetId);
        if (!asset || asset.workspaceId !== workspace.id) return [];
        return [{
          id: asset.id,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          checksum: asset.checksum,
          storageRef: asset.storageRef,
        }];
      });
      if (approvedVideoAssets.length === 0) return [];

      return [{
        ...content,
        caption: version.caption,
        script: version.script,
        hashtags: version.hashtags,
        mediaAssets: approvedVideoAssets,
      }];
    }),
  }));

  return {
    gate: getTokMetricPublishingGate(),
    verifiedMediaHosts: (process.env.TOKMETRIC_VERIFIED_MEDIA_HOSTS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    workspaces: publishingWorkspaces,
  };
}

export async function getCreatorInfoForPublishing(input: {
  workspaceId: string;
  connectorId: string;
  actorId: string;
  correlationId: string;
}) {
  const credential = await getAuthorizedTikTokCredential({
    ...input,
    requiredScope: "video.publish",
  });
  const creator = await queryTikTokCreatorInfo(credential.accessToken);
  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "tokmetric.tiktok.creator_info",
    entityType: "connector",
    entityId: input.connectorId,
    correlationId: input.correlationId,
    outcome: "success",
    sourceChannel: "website",
    metadata: { creatorUsername: creator.creatorUsername, privacyLevelOptions: creator.privacyLevelOptions },
  });
  return creator;
}

export type InitializeVideoPublishInput = {
  workspaceId: string;
  contentId: string;
  mediaAssetId: string;
  connectorId: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  title: string;
  privacyLevel: TikTokPrivacyLevel;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  videoCoverTimestampMs?: number;
  brandContentToggle: boolean;
  brandOrganicToggle: boolean;
  isAigc: boolean;
  source: TikTokVideoSource;
  file?: {
    name: string;
    mimeType: TikTokVideoMimeType;
    size: number;
    checksumSha256: string;
    durationSec?: number;
  };
  videoUrl?: string;
  consentToUpload: boolean;
  rightsConfirmed: boolean;
  musicRightsConfirmed: boolean;
  processingNoticeAccepted: boolean;
};

async function assertApprovedContent(
  workspaceId: string,
  contentId: string,
  mediaAssetId: string,
) {
  const content = await db.content.findFirst({ where: { id: contentId, workspaceId } });
  if (!content?.currentVersionId || content.state !== "APPROVED") {
    throw new TokMetricError(409, "CONTENT_NOT_APPROVED", "Select an approved content version before publishing.");
  }
  const version = await db.contentVersion.findUnique({ where: { id: content.currentVersionId } });
  if (!version) throw new TokMetricError(409, "CONTENT_VERSION_MISSING", "The approved content version was not found.");
  const approval = await db.approvalRequest.findFirst({
    where: { contentVersionId: version.id, objectHash: version.objectHash, state: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    include: { decisions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const decision = approval?.decisions[0];
  if (
    !approval ||
    decision?.decision !== "approve" ||
    decision.objectHash !== version.objectHash ||
    !decision.actorId ||
    decision.actorId === approval.requestedById
  ) {
    throw new TokMetricError(
      409,
      "APPROVAL_EVIDENCE_INVALID",
      "A different authorized operator must approve this exact content and media version.",
    );
  }
  assertMediaAssetAttachedToApprovedVersion(version.mediaAssetIds, mediaAssetId);
  const mediaAsset = await db.mediaAsset.findFirst({
    where: {
      id: mediaAssetId,
      workspaceId,
      mimeType: { in: [...TIKTOK_VIDEO_MIME_TYPES] },
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      checksum: true,
      storageRef: true,
    },
  });
  if (!mediaAsset) {
    throw new TokMetricError(
      409,
      "VIDEO_ASSET_MISSING",
      "The approved video asset is unavailable in this workspace.",
    );
  }
  return {
    content,
    version,
    approval,
    mediaAsset: mediaAsset as TikTokApprovedVideoAsset,
  };
}

export function assertMediaAssetAttachedToApprovedVersion(
  approvedMediaAssetIds: string[],
  mediaAssetId: string,
) {
  if (!approvedMediaAssetIds.includes(mediaAssetId)) {
    throw new TokMetricError(
      409,
      "MEDIA_ASSET_NOT_APPROVED",
      "Select a video asset attached to the exact approved content version.",
    );
  }
}

export function assertSelectedVideoMatchesApprovedAsset(input: {
  asset: TikTokApprovedVideoAsset;
  source: TikTokVideoSource;
  file?: InitializeVideoPublishInput["file"];
  videoUrl?: string;
}) {
  if (input.source === "FILE_UPLOAD") {
    const file = input.file;
    if (!file || !TIKTOK_VIDEO_MIME_TYPES.includes(file.mimeType)) {
      throw new TokMetricError(400, "UNSUPPORTED_VIDEO_TYPE", "Select an MP4, MOV, or WebM video.");
    }
    if (
      file.size !== input.asset.fileSize ||
      file.mimeType !== input.asset.mimeType ||
      file.checksumSha256.toLowerCase() !== input.asset.checksum.toLowerCase()
    ) {
      throw new TokMetricError(
        409,
        "VIDEO_FILE_VERSION_MISMATCH",
        "The selected file does not match the exact approved video asset.",
      );
    }
    return { file, verifiedUrl: undefined };
  }

  if (input.videoUrl && input.videoUrl !== input.asset.storageRef) {
    throw new TokMetricError(
      409,
      "VIDEO_URL_VERSION_MISMATCH",
      "The video URL does not match the exact approved video asset.",
    );
  }
  return {
    file: undefined,
    verifiedUrl: validateVerifiedMediaUrl(input.asset.storageRef),
  };
}

export async function initializeVideoPublish(input: InitializeVideoPublishInput) {
  await enforceEmergencyLocks(input.workspaceId, "publish");
  const gate = enforceTokMetricPublishingGate();
  if (!input.consentToUpload || !input.rightsConfirmed || !input.musicRightsConfirmed || !input.processingNoticeAccepted) {
    throw new TokMetricError(400, "PUBLISHING_CONSENT_REQUIRED", "All publishing consent and rights confirmations are required.");
  }

  const { content, version, mediaAsset } = await assertApprovedContent(
    input.workspaceId,
    input.contentId,
    input.mediaAssetId,
  );
  const credential = await getAuthorizedTikTokCredential({
    workspaceId: input.workspaceId,
    connectorId: input.connectorId,
    requiredScope: "video.publish",
    actorId: input.actorId,
    correlationId: input.correlationId,
  });
  const creator = await queryTikTokCreatorInfo(credential.accessToken);
  if (!creator.privacyLevelOptions.includes(input.privacyLevel)) {
    throw new TokMetricError(400, "PRIVACY_LEVEL_NOT_AVAILABLE", "Select one of the privacy options currently available for this TikTok account.");
  }
  if (gate.mode === "sandbox" && input.privacyLevel !== "SELF_ONLY") {
    throw new TokMetricError(400, "SANDBOX_REQUIRES_SELF_ONLY", "Sandbox and unaudited posting must use SELF_ONLY privacy.");
  }

  const selectedMedia = assertSelectedVideoMatchesApprovedAsset({
    asset: mediaAsset,
    source: input.source,
    file: input.file,
    videoUrl: input.videoUrl,
  });
  let chunkPlan: ReturnType<typeof calculateTikTokChunkPlan> | undefined;
  const verifiedUrl = selectedMedia.verifiedUrl;
  if (input.source === "FILE_UPLOAD") {
    const file = selectedMedia.file!;
    if (file.durationSec && file.durationSec > creator.maxVideoPostDurationSec) {
      throw new TokMetricError(400, "VIDEO_TOO_LONG", `This TikTok account currently allows videos up to ${creator.maxVideoPostDurationSec} seconds.`);
    }
    try {
      chunkPlan = calculateTikTokChunkPlan(file.size);
    } catch (error) {
      throw new TokMetricError(400, "INVALID_VIDEO_SIZE", error instanceof Error ? error.message : "Video size is invalid.");
    }
  }

  const requestHash = contentHash({
    contentVersionId: version.id,
    connectorId: input.connectorId,
    title: input.title,
    privacyLevel: input.privacyLevel,
    disableComment: input.disableComment,
    disableDuet: input.disableDuet,
    disableStitch: input.disableStitch,
    videoCoverTimestampMs: input.videoCoverTimestampMs,
    brandContentToggle: input.brandContentToggle,
    brandOrganicToggle: input.brandOrganicToggle,
    isAigc: input.isAigc,
    source: input.source,
    mediaAssetId: mediaAsset.id,
    file: input.file,
    videoUrl: verifiedUrl?.toString(),
  });

  const existing = await db.publishJob.findUnique({
    where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) {
    if (existing.objectHash !== version.objectHash) {
      throw new TokMetricError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key belongs to a different content version.");
    }
    throw new TokMetricError(409, "PUBLISH_ALREADY_INITIALIZED", "This publishing request was already initialized. Refresh its status or start a new request.");
  }

  const job = await db.publishJob.create({
    data: {
      workspaceId: input.workspaceId,
      connectorId: input.connectorId,
      contentId: content.id,
      contentVersionId: version.id,
      requestedById: input.actorId,
      idempotencyKey: input.idempotencyKey,
      internalState: "RUNNING",
      externalState: "NOT_SUBMITTED",
      objectHash: version.objectHash,
    },
  });

  const postInput: TikTokDirectPostInput = {
    title: input.title,
    privacyLevel: input.privacyLevel,
    disableComment: input.disableComment || creator.commentDisabled,
    disableDuet: input.disableDuet || creator.duetDisabled,
    disableStitch: input.disableStitch || creator.stitchDisabled,
    videoCoverTimestampMs: input.videoCoverTimestampMs,
    brandContentToggle: input.brandContentToggle,
    brandOrganicToggle: input.brandOrganicToggle,
    isAigc: input.isAigc,
    source: input.source,
    chunkPlan,
    videoUrl: verifiedUrl?.toString(),
  };

  try {
    const initialized = await initializeTikTokDirectPost(credential.accessToken, postInput);
    const externalState = input.source === "FILE_UPLOAD" ? "UPLOAD_INITIALIZED" : "PROCESSING";
    const internalState = input.source === "FILE_UPLOAD" ? "RUNNING" : "WAITING_FOR_PLATFORM";
    await db.publishJob.update({
      where: { id: job.id },
      data: { externalRequestId: initialized.publishId, externalState, internalState },
    });
    await addJobAttempt(job.id, internalState, {
      requestHash,
      source: input.source,
      privacyLevel: input.privacyLevel,
      titleLength: input.title.length,
      brandContentToggle: input.brandContentToggle,
      brandOrganicToggle: input.brandOrganicToggle,
      isAigc: input.isAigc,
      chunkPlan,
      fileName: input.file?.name,
      verifiedMediaHost: verifiedUrl?.hostname,
      publishId: initialized.publishId,
    });
    await emitTokMetricAudit({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: "tokmetric.tiktok.publish_initialized",
      entityType: "publish_job",
      entityId: job.id,
      correlationId: input.correlationId,
      outcome: "success",
      sourceChannel: "website",
      metadata: { source: input.source, publishId: initialized.publishId, privacyLevel: input.privacyLevel },
    });
    await emitDomainEvent({
      workspaceId: input.workspaceId,
      aggregateType: "publish_job",
      aggregateId: job.id,
      eventType: "TIKTOK_VIDEO_PUBLISH_INITIALIZED",
      correlationId: input.correlationId,
      metadata: { source: input.source, publishId: initialized.publishId },
    });

    return {
      jobId: job.id,
      publishId: initialized.publishId,
      uploadUrl: initialized.uploadUrl,
      chunkPlan: chunkPlan ?? null,
      source: input.source,
      processingNotice: "TikTok processing may take several minutes. Keep this page open to follow the status.",
    };
  } catch (error) {
    await db.publishJob.update({ where: { id: job.id }, data: { internalState: "FAILED", externalState: "FAILED" } });
    await addJobAttempt(job.id, "FAILED", { requestHash, source: input.source, errorCode: error instanceof TokMetricError ? error.code : "UNKNOWN" });
    throw error;
  }
}

export async function markVideoUploadComplete(input: { workspaceId: string; jobId: string; actorId: string; correlationId: string }) {
  const job = await db.publishJob.findFirst({ where: { id: input.jobId, workspaceId: input.workspaceId } });
  if (!job?.externalRequestId) throw new TokMetricError(404, "PUBLISH_JOB_NOT_FOUND", "Initialized publishing job was not found.");
  if (job.externalState !== "UPLOAD_INITIALIZED" && job.externalState !== "UPLOADED") {
    throw new TokMetricError(409, "UPLOAD_NOT_EXPECTED", "This publishing job is not waiting for a file upload.");
  }

  const updated = await db.publishJob.update({
    where: { id: job.id },
    data: { internalState: "WAITING_FOR_PLATFORM", externalState: "UPLOADED" },
  });
  await addJobAttempt(job.id, "WAITING_FOR_PLATFORM", { event: "browser_file_upload_completed" });
  await emitTokMetricAudit({ workspaceId: input.workspaceId, actorId: input.actorId, action: "tokmetric.tiktok.upload_completed", entityType: "publish_job", entityId: job.id, correlationId: input.correlationId, outcome: "success", sourceChannel: "website" });
  return updated;
}

export async function refreshVideoPublishStatus(input: { workspaceId: string; jobId: string; actorId: string; correlationId: string }) {
  const job = await db.publishJob.findFirst({ where: { id: input.jobId, workspaceId: input.workspaceId } });
  if (!job?.connectorId || !job.externalRequestId) throw new TokMetricError(404, "PUBLISH_JOB_NOT_FOUND", "Publishing job or TikTok request ID was not found.");
  const credential = await getAuthorizedTikTokCredential({
    workspaceId: input.workspaceId,
    connectorId: job.connectorId,
    requiredScope: "video.publish",
    actorId: input.actorId,
    correlationId: input.correlationId,
  });
  const status = await fetchTikTokPublishStatus(credential.accessToken, job.externalRequestId);

  const internalState = status.isFinal ? (status.succeeded ? "COMPLETED" : "FAILED") : "WAITING_FOR_PLATFORM";
  const externalState = status.isFinal ? (status.succeeded ? "PUBLISHED_CONFIRMED" : "FAILED") : "PROCESSING";
  await db.publishJob.update({ where: { id: job.id }, data: { internalState, externalState } });
  await addJobAttempt(job.id, internalState, status);
  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "tokmetric.tiktok.status_refreshed",
    entityType: "publish_job",
    entityId: job.id,
    correlationId: input.correlationId,
    outcome: status.isFinal && !status.succeeded ? "failure" : "success",
    sourceChannel: "website",
    metadata: status,
  });

  return { jobId: job.id, internalState, externalState, ...status };
}

export async function cancelVideoPublish(input: { workspaceId: string; jobId: string; actorId: string; correlationId: string }) {
  const job = await db.publishJob.findFirst({ where: { id: input.jobId, workspaceId: input.workspaceId } });
  if (!job?.connectorId || !job.externalRequestId) throw new TokMetricError(404, "PUBLISH_JOB_NOT_FOUND", "Publishing job or TikTok request ID was not found.");
  const credential = await getAuthorizedTikTokCredential({
    workspaceId: input.workspaceId,
    connectorId: job.connectorId,
    requiredScope: "video.publish",
    actorId: input.actorId,
    correlationId: input.correlationId,
  });
  await cancelTikTokPublish(credential.accessToken, job.externalRequestId);
  const updated = await db.publishJob.update({ where: { id: job.id }, data: { internalState: "CANCELLED", externalState: "UNKNOWN" } });
  await addJobAttempt(job.id, "CANCELLED", { event: "cancel_requested" });
  await emitTokMetricAudit({ workspaceId: input.workspaceId, actorId: input.actorId, action: "tokmetric.tiktok.publish_cancelled", entityType: "publish_job", entityId: job.id, correlationId: input.correlationId, outcome: "success", sourceChannel: "website" });
  return updated;
}

export function activeTikTokEnvironment() {
  return getTikTokOAuthConfig().environment;
}
