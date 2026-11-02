import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createContentDraft, runComplianceReview } from "@/lib/tokmetric/workflow";
import { requireTrustedVideoWorker } from "@/lib/video/worker-auth";
import {
  createVideoRenderJob,
  getVideoRenderJobByIdempotencyKey,
  markVideoRenderQueued,
  updateVideoRenderState,
} from "@/lib/video/store";
import { verifyTrustedWorkerUpload } from "@/lib/video/worker-upload-verification";
import { finalizeTrustedWorkerContentRender } from "@/lib/video/worker-finalization";
import { validateGemStorylineManifest } from "@/lib/video/storyline-ingestion";
import {
  contentHash,
  correlationId,
  parseJson,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const requestSchema = z.object({
  workspaceId: z.string().regex(/^ws_[a-f0-9]{32}$/),
  storylineId: z.string().regex(/^gem-cyber-[a-z0-9-]{1,64}$/),
  storageRef: z.string().url().max(2000),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.literal("video/mp4"),
  fileSize: z.number().int().positive().max(512 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  manifest: z.record(z.unknown()),
});

type IngestPayload = z.infer<typeof requestSchema>;

function configured(name: string) {
  return process.env[name]?.trim() ?? "";
}

function validatePrivateStorageReference(input: IngestPayload) {
  const storageUrl = configured("VIDEO_RENDER_STORAGE_URL");
  const storageKey = configured("VIDEO_RENDER_STORAGE_KEY");
  const bucket = configured("VIDEO_RENDER_STORAGE_BUCKET") || "gem-video-renders";
  if (!storageUrl || !storageKey) {
    throw new TokMetricError(503, "STORYLINE_STORAGE_NOT_CONFIGURED", "Private video storage verification is not configured.");
  }
  if (!/^[a-z0-9_-]{1,100}$/.test(bucket)) {
    throw new TokMetricError(503, "STORYLINE_STORAGE_BUCKET_INVALID", "The private video storage bucket is invalid.");
  }
  let base: URL;
  let reference: URL;
  try {
    base = new URL(storageUrl);
    reference = new URL(input.storageRef);
  } catch {
    throw new TokMetricError(400, "STORYLINE_STORAGE_REFERENCE_INVALID", "The private storage reference is invalid.");
  }
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    reference.origin !== base.origin ||
    reference.username ||
    reference.password ||
    reference.search ||
    reference.hash
  ) {
    throw new TokMetricError(400, "STORYLINE_STORAGE_REFERENCE_INVALID", "The video must be stored at the configured HTTPS storage origin.");
  }
  const expectedPath = `/storage/v1/object/authenticated/${bucket}/storylines/${input.workspaceId}/${input.storylineId}/${input.checksumSha256.toLowerCase()}.mp4`;
  if (reference.pathname !== expectedPath) {
    throw new TokMetricError(400, "STORYLINE_STORAGE_REFERENCE_INVALID", "The storage path is not bound to this workspace, storyline, and file checksum.");
  }
}

async function activeSystemActor(workspaceId: string) {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      status: "active",
      user: {
        isActive: true,
        status: "active",
        role: { in: ["admin", "super_admin", "internal"] },
      },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!member) {
    throw new TokMetricError(409, "STORYLINE_WORKSPACE_OPERATOR_REQUIRED", "An active GEM workspace administrator is required to record the governed draft.");
  }
  return member.userId;
}

async function existingFinalizedResponse(input: { workspaceId: string; contentId: string }) {
  const content = await db.content.findFirst({
    where: { id: input.contentId, workspaceId: input.workspaceId },
    select: { id: true, currentVersionId: true, state: true },
  });
  if (!content?.currentVersionId) return null;
  const version = await db.contentVersion.findUnique({
    where: { id: content.currentVersionId },
    select: { settings: true },
  });
  const settings = version?.settings && typeof version.settings === "object"
    ? version.settings as Record<string, unknown>
    : {};
  const render = settings.render && typeof settings.render === "object"
    ? settings.render as Record<string, unknown>
    : {};
  const approval = await db.approvalRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contentId: input.contentId,
      contentVersionId: content.currentVersionId,
      state: { in: ["APPROVAL_REQUIRED", "APPROVED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, state: true },
  });
  return {
    contentId: content.id,
    contentVersionId: content.currentVersionId,
    mediaAssetId: typeof render.mediaAssetId === "string" ? render.mediaAssetId : null,
    approvalRequestId: approval?.id ?? null,
    approvalState: approval?.state ?? null,
    state: content.state,
    externalPublicationTaken: false,
    idempotent: true,
  };
}

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireTrustedVideoWorker(request);
    const input = (await parseJson(request, requestSchema)) as IngestPayload;
    const validated = validateGemStorylineManifest({
      storylineId: input.storylineId,
      fileName: input.fileName,
      fileSize: input.fileSize,
      checksumSha256: input.checksumSha256,
      manifest: input.manifest,
    });
    validatePrivateStorageReference(input);

    const workspace = await db.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      throw new TokMetricError(404, "WORKSPACE_NOT_FOUND", "The TokMetric workspace was not found.");
    }

    const manifestDigest = contentHash(input.manifest);
    const ingestionKey = `gem-storylines:${input.storylineId}:${validated.primary.checksumSha256}:${manifestDigest}`;
    const existingJob = await getVideoRenderJobByIdempotencyKey({
      workspaceId: input.workspaceId,
      idempotencyKey: ingestionKey,
    });

    if (existingJob?.state === "FINALIZED") {
      const existing = await existingFinalizedResponse({
        workspaceId: input.workspaceId,
        contentId: existingJob.contentId,
      });
      if (existing) {
        return NextResponse.json(
          { ok: true, correlationId: cid, data: { ...existing, storylineId: input.storylineId } },
          { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
        );
      }
    }
    if (existingJob && ["FAILED", "CANCELLED"].includes(existingJob.state)) {
      throw new TokMetricError(409, "STORYLINE_RENDER_JOB_CLOSED", "This storyline ingestion job has been closed and cannot be resumed.");
    }

    const actorId = await activeSystemActor(input.workspaceId);
    let contentId = existingJob?.contentId ?? "";
    let contentVersionId = existingJob?.contentVersionId ?? "";

    if (existingJob) {
      const existingContent = await db.content.findFirst({
        where: { id: contentId, workspaceId: input.workspaceId },
        select: { currentVersionId: true },
      });
      const existingVersion = await db.contentVersion.findUnique({
        where: { id: contentVersionId },
        select: { id: true },
      });
      if (!existingContent || !existingVersion || existingContent.currentVersionId !== existingVersion.id) {
        throw new TokMetricError(409, "STORYLINE_CONTENT_VERSION_CHANGED", "The content version changed after the Storylines render was first registered.");
      }
    } else {
      const existingVersion = await db.contentVersion.findFirst({
        where: {
          content: { workspaceId: input.workspaceId },
          settings: { path: ["storyline", "ingestionKey"], equals: ingestionKey },
        },
      });
      if (existingVersion) {
        const owningContent = await db.content.findFirst({
          where: { id: existingVersion.contentId, workspaceId: input.workspaceId },
          select: { currentVersionId: true },
        });
        if (!owningContent || owningContent.currentVersionId !== existingVersion.id) {
          throw new TokMetricError(409, "STORYLINE_CONTENT_VERSION_CHANGED", "The storyline draft was edited after creation; a fresh draft is required.");
        }
        contentId = existingVersion.contentId;
        contentVersionId = existingVersion.id;
      } else {
        const draft = await createContentDraft(
          {
            workspaceId: input.workspaceId,
            title: validated.title,
            script: validated.script,
            caption: validated.caption,
            hashtags: validated.hashtags,
            settings: {
              orchestrator: { provider: "tiktok", contentType: "SHORT_VIDEO" },
              storyline: {
                source: "gem-video-storylines",
                storylineId: input.storylineId,
                ingestionKey,
                disclosures: validated.disclosures,
              },
              videoRecipe: {
                aspectRatio: "9:16",
                cameraDirection: "Polished corporate cybersecurity footage with restrained motion",
                voiceDirection: "Professional Kokoro synthetic narration",
                scenes: validated.scenes.map((scene) => ({
                  visualDirection: `${scene.role} cybersecurity awareness footage`,
                  narration: scene.voiceover,
                  onScreenText: scene.caption,
                })),
              },
            },
          },
          actorId,
          cid,
        );
        contentId = draft.content.id;
        contentVersionId = draft.version.id;
      }
    }

    const existingReview = await db.complianceReview.findFirst({
      where: { contentVersionId },
      orderBy: { createdAt: "desc" },
    });
    const review = existingReview ?? await runComplianceReview({
      workspaceId: input.workspaceId,
      contentId,
      actorId,
      correlationId: cid,
    });
    if (!["PASS", "PASS_WITH_DISCLOSURE"].includes(review.result)) {
      throw new TokMetricError(409, "STORYLINE_COMPLIANCE_REVIEW_REQUIRED", "The storyline draft did not pass automatic content review and needs manual review before media ingestion.");
    }

    const requestDescriptor = {
      source: "gem-video-storylines",
      storylineId: input.storylineId,
      contentVersionId,
      checksumSha256: validated.primary.checksumSha256,
      fileName: validated.primary.fileName,
      fileSize: validated.primary.fileSize,
    };
    const durable = await createVideoRenderJob({
      workspaceId: input.workspaceId,
      contentId,
      contentVersionId,
      complianceReviewId: review.id,
      requestedById: actorId,
      idempotencyKey: ingestionKey,
      request: requestDescriptor,
      dispatchPayload: {
        renderProvider: "gem-video-storylines",
        storylineId: input.storylineId,
        source: "github-actions",
      },
    });

    const promptId = `gem-storylines:${input.workspaceId}:${input.storylineId}:${validated.primary.checksumSha256}:${manifestDigest}`;
    let current = durable.record;
    if (current.externalPromptId && current.externalPromptId !== promptId) {
      throw new TokMetricError(409, "STORYLINE_RENDER_PROMPT_CONFLICT", "The storyline render is already bound to a different output.");
    }
    if (!current.externalPromptId) {
      current = await markVideoRenderQueued({ id: current.id, promptId });
    }

    const outputManifest = {
      renderProvider: "gem-video-storylines",
      storylineId: input.storylineId,
      filename: validated.primary.fileName,
      files: [{
        filename: validated.primary.fileName,
        variant: "vertical_9x16",
        sha256: validated.primary.checksumSha256,
        bytes: validated.primary.fileSize,
      }],
      manifest: input.manifest,
    };
    if (current.state !== "FINALIZED") {
      current = await updateVideoRenderState({
        id: current.id,
        state: "COMPLETED",
        outputManifest,
      });
      await verifyTrustedWorkerUpload({
        renderJobId: current.id,
        storageRef: input.storageRef,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        checksumSha256: input.checksumSha256,
        outputManifest,
        correlationId: cid,
      });
      const finalized = await finalizeTrustedWorkerContentRender({
        workspaceId: input.workspaceId,
        contentId,
        promptId,
        actorId,
        correlationId: cid,
      });
      return NextResponse.json(
        { ok: true, correlationId: cid, data: { ...finalized, storylineId: input.storylineId, externalPublicationTaken: false } },
        { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    const existing = await existingFinalizedResponse({ workspaceId: input.workspaceId, contentId });
    return NextResponse.json(
      { ok: true, correlationId: cid, data: existing ?? { contentId, storylineId: input.storylineId, externalPublicationTaken: false } },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
