import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { socialContentTypes } from "@/lib/social-media/policy";
import {
  createSocialPublishingJob,
  listSocialPublishingJobs,
} from "@/lib/social-media/publishing/store";
import {
  sharedSocialPublishingProviders,
  type SocialPublishingPayload,
} from "@/lib/social-media/publishing/types";
import {
  correlationId,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  parseJson,
  requirePermission,
  requireTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const queueSchema = z.object({
  workspaceId: z.string().trim().min(1),
  contentId: z.string().trim().min(1),
  connectorId: z.string().trim().min(1),
  provider: z.enum(sharedSocialPublishingProviders),
  contentType: z.enum(socialContentTypes),
  approvalId: z.string().trim().min(1),
  complianceReviewId: z.string().trim().min(1),
  localContext: z.string().trim().max(2000).optional(),
  scheduledFor: z.string().datetime().optional(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
});

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(
      403,
      "CROSS_ORIGIN_REQUEST_BLOCKED",
      "Publishing queue changes require a same-origin request.",
    );
  }
}

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

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      throw new TokMetricError(
        400,
        "VALIDATION_ERROR",
        "workspaceId is required.",
      );
    }
    await requireWorkspaceAccess(workspaceId, session);
    const jobs = await listSocialPublishingJobs({ workspaceId });
    return NextResponse.json(
      { ok: true, correlationId: cid, jobs, externalActionTaken: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireSameOrigin(request);
    const session = await requireTokMetricSession(request);
    const input = await parseJson(request, queueSchema);
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "publish", "content");
    await enforceEmergencyLocks(input.workspaceId, "publish");

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      throw new TokMetricError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Queue requests require an Idempotency-Key header.",
      );
    }

    const content = await db.content.findFirst({
      where: { id: input.contentId, workspaceId: input.workspaceId },
    });
    if (!content?.currentVersionId || content.state !== "APPROVED") {
      throw new TokMetricError(
        409,
        "CONTENT_NOT_APPROVED",
        "Only an approved active content version can be queued.",
      );
    }
    const version = await db.contentVersion.findUnique({
      where: { id: content.currentVersionId },
    });
    if (!version) {
      throw new TokMetricError(
        409,
        "CONTENT_VERSION_MISSING",
        "The approved content version was not found.",
      );
    }

    const [approval, complianceReview, mediaAssets] = await Promise.all([
      db.approvalRequest.findFirst({
        where: {
          id: input.approvalId,
          workspaceId: input.workspaceId,
          contentId: content.id,
          contentVersionId: version.id,
          objectHash: version.objectHash,
          state: "APPROVED",
        },
        include: {
          decisions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      db.complianceReview.findFirst({
        where: {
          id: input.complianceReviewId,
          workspaceId: input.workspaceId,
          contentId: content.id,
          contentVersionId: version.id,
          result: { in: ["PASS", "PASS_WITH_DISCLOSURE"] },
        },
      }),
      version.mediaAssetIds.length > 0
        ? db.mediaAsset.findMany({
            where: {
              workspaceId: input.workspaceId,
              id: { in: version.mediaAssetIds },
            },
          })
        : Promise.resolve([]),
    ]);

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
        "A different authorized operator must approve this exact content version.",
      );
    }
    if (!complianceReview) {
      throw new TokMetricError(
        409,
        "COMPLIANCE_EVIDENCE_INVALID",
        "A passing compliance review for this exact content version is required.",
      );
    }
    if (mediaAssets.length !== version.mediaAssetIds.length) {
      throw new TokMetricError(
        409,
        "MEDIA_ASSET_MISSING",
        "One or more approved media assets are unavailable.",
      );
    }

    const settings = object(version.settings);
    const hashtags = version.hashtags.map((tag) =>
      tag.startsWith("#") ? tag : `#${tag}`,
    );
    const caption = [version.caption?.trim(), hashtags.join(" ")]
      .filter(Boolean)
      .join("\n\n");
    const configuredMediaUrls = strings(settings.mediaUrls);
    const mediaUrls = configuredMediaUrls.length > 0
      ? configuredMediaUrls
      : mediaAssets.map((asset) => asset.storageRef);
    const visibility: SocialPublishingPayload["visibility"] =
      settings.visibility === "PUBLIC" ||
      settings.visibility === "UNLISTED" ||
      settings.visibility === "PRIVATE"
        ? settings.visibility
        : undefined;
    const payload: SocialPublishingPayload = {
      text: caption || version.script?.trim() || undefined,
      title:
        typeof settings.title === "string" ? settings.title.trim() : undefined,
      description:
        typeof settings.description === "string"
          ? settings.description.trim()
          : version.script?.trim() || undefined,
      linkUrl:
        typeof settings.linkUrl === "string"
          ? settings.linkUrl.trim()
          : undefined,
      mediaUrls,
      altText:
        typeof settings.altText === "string"
          ? settings.altText.trim()
          : undefined,
      thread: strings(settings.thread),
      localContext: input.localContext,
      visibility,
      metadata: {
        contentId: content.id,
        contentVersionId: version.id,
      },
    };

    const job = await createSocialPublishingJob({
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectorId: input.connectorId,
      contentType: input.contentType,
      contentVersionHash: version.objectHash,
      approvedVersionHash: approval.objectHash,
      approvalId: approval.id,
      complianceReviewId: complianceReview.id,
      compliancePassed: true,
      idempotencyKey,
      payload,
      localContext: input.localContext,
      requestedById: session.userId,
      scheduledFor: input.scheduledFor
        ? new Date(input.scheduledFor)
        : undefined,
      maxAttempts: input.maxAttempts,
    });

    await emitTokMetricAudit({
      workspaceId: input.workspaceId,
      actorId: session.userId,
      action: "SOCIAL_PUBLISH_QUEUED",
      entityType: "SOCIAL_PUBLISHING_JOB",
      entityId: job.id,
      correlationId: cid,
      outcome: "QUEUED",
      sourceChannel: "social-media-command-center",
      metadata: {
        provider: input.provider,
        connectorId: input.connectorId,
        contentId: content.id,
        contentVersionId: version.id,
        approvalId: approval.id,
        complianceReviewId: complianceReview.id,
      },
    });

    return NextResponse.json(
      { ok: true, correlationId: cid, job, externalActionTaken: false },
      { status: 202, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
