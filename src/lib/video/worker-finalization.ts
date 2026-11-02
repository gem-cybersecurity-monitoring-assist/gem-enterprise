import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getVerifiedVideoUpload,
  getVideoRenderJobByPromptId,
} from "@/lib/video/store";
import {
  contentHash,
  emitDomainEvent,
  redactSecrets,
  TokMetricError,
} from "@/lib/tokmetric/security";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function orchestratorMetadata(settings: unknown) {
  return object(object(settings).orchestrator);
}

function approvalAction(settings: unknown) {
  const provider = orchestratorMetadata(settings).provider;
  return typeof provider === "string"
    ? `publish_${provider.toLowerCase()}_content`
    : "publish_content";
}

function toInputJson(value: unknown) {
  return redactSecrets(value) as Prisma.InputJsonValue;
}

async function reviewableContent(workspaceId: string, contentId: string) {
  const content = await db.content.findFirst({
    where: { id: contentId, workspaceId },
  });
  if (!content?.currentVersionId) {
    throw new TokMetricError(
      404,
      "CONTENT_NOT_FOUND",
      "The content or active version was not found.",
    );
  }
  if (["APPROVED", "ARCHIVED"].includes(content.state)) {
    throw new TokMetricError(
      409,
      "CONTENT_RENDER_IMMUTABLE",
      "Approved or archived content cannot enter the render workflow.",
    );
  }
  const version = await db.contentVersion.findUnique({
    where: { id: content.currentVersionId },
  });
  if (!version) {
    throw new TokMetricError(
      409,
      "CONTENT_VERSION_MISSING",
      "The active content version was not found.",
    );
  }
  const metadata = orchestratorMetadata(version.settings);
  if (
    typeof metadata.contentType !== "string" ||
    !new Set(["SHORT_VIDEO", "LONG_VIDEO", "REEL"]).has(metadata.contentType)
  ) {
    throw new TokMetricError(
      409,
      "CONTENT_NOT_VIDEO_RENDERABLE",
      "Only orchestrated video content can be finalized by the video workflow.",
    );
  }
  const review = await db.complianceReview.findFirst({
    where: { contentVersionId: version.id },
    orderBy: { createdAt: "desc" },
  });
  if (!review || !["PASS", "PASS_WITH_DISCLOSURE"].includes(review.result)) {
    throw new TokMetricError(
      409,
      "VIDEO_RENDER_COMPLIANCE_REQUIRED",
      "A passing compliance review for the exact source version is required.",
    );
  }
  return { content, version, review };
}

export async function finalizeTrustedWorkerContentRender(input: {
  workspaceId: string;
  contentId: string;
  promptId: string;
  actorId: string;
  correlationId: string;
}) {
  const current = await getVideoRenderJobByPromptId(input.promptId);
  if (
    !current ||
    current.workspaceId !== input.workspaceId ||
    current.contentId !== input.contentId
  ) {
    throw new TokMetricError(
      409,
      "VIDEO_RENDER_OWNERSHIP_INVALID",
      "The render job is not bound to this workspace and content item.",
    );
  }
  if (!["COMPLETED", "FINALIZED"].includes(current.state)) {
    throw new TokMetricError(
      409,
      "VIDEO_RENDER_NOT_COMPLETE",
      "Only a verified completed render can be finalized.",
    );
  }
  const renderDescriptor = object(current.outputManifest);
  const renderProvider =
    typeof renderDescriptor.renderProvider === "string"
      ? renderDescriptor.renderProvider
      : "comfyui-local";

  const upload = await getVerifiedVideoUpload(current.id);
  if (!upload) {
    throw new TokMetricError(
      409,
      "VIDEO_UPLOAD_VERIFICATION_REQUIRED",
      "The render must have a trusted verified upload before finalization.",
    );
  }

  const { content, version, review: sourceReview } = await reviewableContent(
    input.workspaceId,
    input.contentId,
  );
  if (current.contentVersionId !== version.id) {
    throw new TokMetricError(
      409,
      "VIDEO_RENDER_VERSION_MISMATCH",
      "The content version changed after the render was queued.",
    );
  }

  if (current.state === "FINALIZED") {
    const renderMetadata = object(object(version.settings).render);
    const mediaAssetId =
      typeof renderMetadata.mediaAssetId === "string"
        ? renderMetadata.mediaAssetId
        : null;
    if (
      renderMetadata.renderJobId !== current.id ||
      !mediaAssetId
    ) {
      throw new TokMetricError(
        409,
        "VIDEO_FINALIZATION_STATE_INCONSISTENT",
        "The finalized render is missing its rendered content version.",
      );
    }
    const existingReview = await db.complianceReview.findFirst({
      where: { contentVersionId: version.id },
      orderBy: { createdAt: "desc" },
    });
    const existingApproval = await db.approvalRequest.findFirst({
      where: { contentVersionId: version.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      mediaAssetId,
      contentId: content.id,
      contentVersionId: version.id,
      complianceReviewId: existingReview?.id,
      complianceResult: existingReview?.result ?? "HUMAN_REVIEW_REQUIRED",
      approvalRequestId: existingApproval?.id,
      state: existingApproval
        ? "AWAITING_HUMAN_APPROVAL"
        : "COMPLIANCE_REVIEW_REQUIRED",
      externalPublicationTaken: false,
      idempotent: true,
    };
  }

  const settings = object(version.settings);
  const mediaAssetIds = [...new Set([...version.mediaAssetIds, upload.id])];
  const nextSettings = {
    ...settings,
    render: {
      provider: renderProvider,
      promptId: current.externalPromptId,
      renderJobId: current.id,
      mediaAssetId: upload.id,
      finalizedAt: new Date().toISOString(),
      humanApprovalRequired: true,
      trustedUploadVerifiedAt: upload.verifiedAt.toISOString(),
    },
  };
  const objectHash = contentHash({
    script: version.script,
    caption: version.caption,
    hashtags: version.hashtags,
    settings: nextSettings,
    mediaAssetIds,
  });
  const action = approvalAction(settings);
  const now = new Date();
  const transactionResult = await db.$transaction(
    async (transaction) => {
      const lockedJobs = await transaction.$queryRaw<Array<{
        id: string;
        state: string;
      }>>(Prisma.sql`
        SELECT id, state
        FROM video_render_jobs
        WHERE id = ${current.id}
        FOR UPDATE
      `);
      const locked = lockedJobs[0];
      if (!locked) {
        throw new TokMetricError(
          404,
          "VIDEO_RENDER_JOB_NOT_FOUND",
          "The durable video render job was not found.",
        );
      }
      if (locked.state === "FINALIZED") {
        throw new TokMetricError(
          409,
          "VIDEO_FINALIZATION_CONCURRENTLY_COMPLETED",
          "The render was finalized by another request. Retry to load the final result.",
        );
      }
      if (locked.state !== "COMPLETED") {
        throw new TokMetricError(
          409,
          "VIDEO_RENDER_NOT_COMPLETE",
          "Only a completed render can be finalized.",
        );
      }

      const lockedContent = await transaction.content.findFirst({
        where: { id: content.id, workspaceId: input.workspaceId },
      });
      if (!lockedContent || lockedContent.currentVersionId !== version.id) {
        throw new TokMetricError(
          409,
          "VIDEO_RENDER_VERSION_MISMATCH",
          "The content version changed during finalization.",
        );
      }
      if (["APPROVED", "ARCHIVED"].includes(lockedContent.state)) {
        throw new TokMetricError(
          409,
          "CONTENT_IMMUTABLE",
          "Approved or archived content cannot be changed.",
        );
      }

      let mediaAsset = await transaction.mediaAsset.findFirst({
        where: {
          workspaceId: input.workspaceId,
          checksum: upload.checksumSha256,
          version: 1,
        },
      });
      if (mediaAsset && mediaAsset.storageRef !== upload.storageRef) {
        throw new TokMetricError(
          409,
          "VIDEO_MEDIA_ASSET_CONFLICT",
          "The verified checksum is already bound to a different media reference.",
        );
      }
      if (!mediaAsset) {
        mediaAsset = await transaction.mediaAsset.create({
          data: {
            workspaceId: input.workspaceId,
            ownerId: input.actorId,
            objectHash: contentHash({
              checksum: upload.checksumSha256,
              storageRef: upload.storageRef,
            }),
            fileName: upload.fileName,
            mimeType: upload.mimeType,
            fileSize: upload.fileSize,
            checksum: upload.checksumSha256,
            storageRef: upload.storageRef,
            metadata: toInputJson({
              provider: "trusted-render-worker",
              promptId: current.externalPromptId,
              renderJobId: current.id,
              sourceContentId: content.id,
              sourceContentVersionId: version.id,
              renderProvider,
              outputDescriptors: current.outputManifest,
              manifest: object(renderDescriptor.manifest),
              uploadId: upload.id,
              uploadVerifiedAt: upload.verifiedAt,
              humanApprovalRequired: true,
            }),
          },
        });
      }

      let nextVersion = await transaction.contentVersion.findFirst({
        where: { contentId: content.id, objectHash },
      });
      if (!nextVersion) {
        const latest = await transaction.contentVersion.findFirst({
          where: { contentId: content.id },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        nextVersion = await transaction.contentVersion.create({
          data: {
            contentId: content.id,
            version: (latest?.version ?? 0) + 1,
            objectHash,
            script: version.script,
            caption: version.caption,
            hashtags: version.hashtags,
            settings: toInputJson(nextSettings),
            mediaAssetIds: [...new Set([...mediaAssetIds, mediaAsset.id])],
            createdById: input.actorId,
          },
        });
      }

      await transaction.approvalRequest.updateMany({
        where: {
          workspaceId: input.workspaceId,
          contentId: content.id,
          state: { in: ["APPROVAL_REQUIRED", "APPROVED"] },
        },
        data: { state: "REVOKED" },
      });

      let review = await transaction.complianceReview.findFirst({
        where: { contentVersionId: nextVersion.id },
        orderBy: { createdAt: "desc" },
      });
      if (!review) {
        const previousFindings = Array.isArray(sourceReview.findings)
          ? sourceReview.findings
          : [];
        review = await transaction.complianceReview.create({
          data: {
            workspaceId: input.workspaceId,
            contentId: content.id,
            contentVersionId: nextVersion.id,
            policyVersionId: sourceReview.policyVersionId,
            result: sourceReview.result,
            findings: toInputJson([
              ...previousFindings,
              {
                code: "VERIFIED_RENDERED_MEDIA",
                severity: "info",
                message:
                  "The rendered file was bound to the completed provider output and a trusted worker upload verification record.",
              },
              {
                code: "FRESH_HUMAN_APPROVAL_REQUIRED",
                severity: "info",
                message:
                  "The exact rendered content version requires a new human approval before publishing.",
              },
            ]),
            reviewerId: input.actorId,
          },
        });
      }

      let approvalRequestId: string | undefined;
      if (["PASS", "PASS_WITH_DISCLOSURE"].includes(review.result)) {
        let approval = await transaction.approvalRequest.findFirst({
          where: {
            workspaceId: input.workspaceId,
            contentId: content.id,
            contentVersionId: nextVersion.id,
            action,
            objectHash,
            state: "APPROVAL_REQUIRED",
          },
        });
        if (!approval) {
          approval = await transaction.approvalRequest.create({
            data: {
              workspaceId: input.workspaceId,
              contentId: content.id,
              contentVersionId: nextVersion.id,
              requestedById: input.actorId,
              requiredRole: "approver",
              action,
              objectHash,
              state: "APPROVAL_REQUIRED",
            },
          });
        }
        approvalRequestId = approval.id;
      }

      await transaction.content.update({
        where: { id: content.id },
        data: {
          currentVersionId: nextVersion.id,
          state: "APPROVAL_REQUIRED",
        },
      });

      await transaction.$executeRaw(Prisma.sql`
        UPDATE video_render_jobs
        SET state = 'FINALIZED',
            finalized_at = COALESCE(finalized_at, ${now}),
            dispatch_claim_id = NULL,
            dispatch_claim_expires_at = NULL,
            error_code = NULL,
            error_message = NULL,
            updated_at = ${now}
        WHERE id = ${current.id}
      `);
      await transaction.auditEvent.create({
        data: {
          workspaceId: input.workspaceId,
          actorId: input.actorId,
          action: "video.render.finalized",
          entityType: "media_asset",
          entityId: mediaAsset.id,
          correlationId: input.correlationId,
          outcome: review.result,
          sourceChannel: "video-render-worker",
          safeMetadata: toInputJson({
            contentId: content.id,
            previousContentVersionId: version.id,
            contentVersionId: nextVersion.id,
            promptId: current.externalPromptId,
            renderJobId: current.id,
            uploadId: upload.id,
            approvalRequestId,
            storageRefOrigin: new URL(upload.storageRef).origin,
            externalPublicationTaken: false,
          }),
        },
      });

      return {
        mediaAssetId: mediaAsset.id,
        contentId: content.id,
        contentVersionId: nextVersion.id,
        complianceReviewId: review.id,
        complianceResult: review.result,
        approvalRequestId,
        state: approvalRequestId
          ? "AWAITING_HUMAN_APPROVAL"
          : "COMPLIANCE_REVIEW_REQUIRED",
        externalPublicationTaken: false,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await emitDomainEvent({
    workspaceId: input.workspaceId,
    aggregateType: "content",
    aggregateId: content.id,
    eventType: "VIDEO_RENDER_FINALIZED",
    correlationId: input.correlationId,
    metadata: {
      renderJobId: current.id,
      contentVersionId: transactionResult.contentVersionId,
      mediaAssetId: transactionResult.mediaAssetId,
      approvalRequestId: transactionResult.approvalRequestId,
      externalPublicationTaken: false,
    },
  }).catch(() => undefined);

  return transactionResult;
}
