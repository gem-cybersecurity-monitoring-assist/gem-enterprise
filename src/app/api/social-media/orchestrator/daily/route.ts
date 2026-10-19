import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orchestrateDailyContent } from "@/lib/social-media/orchestration/orchestrator";
import { socialMediaProviderIds } from "@/lib/social-media/providers";
import {
  correlationId,
  parseJson,
  requirePermission,
  requireTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
  withIdempotency,
} from "@/lib/tokmetric/security";

type ProviderId = (typeof socialMediaProviderIds)[number];
type SignalPayload = {
  id: string;
  topic: string;
  summary: string;
  relevance: number;
  momentum: number;
  observedAt: string;
  sourceReference: string;
  providers?: ProviderId[];
};
type SourcePayload = {
  id: string;
  title: string;
  summary: string;
  callToAction: string;
  sourceReference: string;
  approvedAt: string;
  approved: true;
  providers?: ProviderId[];
  vacancyId?: string;
  employerUpdateApproved?: boolean;
};
type RequestPayload = {
  workspaceId: string;
  planDate?: string;
  enabledProviders: ProviderId[];
  marketSignals?: SignalPayload[];
  approvedSources?: SourcePayload[];
  useGemCatalog: boolean;
  gemProductSlugs?: string[];
  localContext?: string;
  minimumTikTokItems: number;
  maxItemsPerOtherProvider: number;
  freshnessWindowDays?: number | null;
  requestApprovals: boolean;
  forceRegenerate: boolean;
};

const providerSchema = z.enum(socialMediaProviderIds);
const signalSchema = z.object({
  id: z.string().trim().min(1).max(300),
  topic: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(5000),
  relevance: z.number().min(0).max(1),
  momentum: z.number().min(0).max(1),
  observedAt: z.string().datetime(),
  sourceReference: z.string().trim().min(1).max(2000),
  providers: z.array(providerSchema).max(8).optional(),
});
const sourceSchema = z.object({
  id: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(10000),
  callToAction: z.string().trim().min(1).max(1000),
  sourceReference: z.string().trim().min(1).max(2000),
  approvedAt: z.string().datetime(),
  approved: z.literal(true),
  providers: z.array(providerSchema).max(8).optional(),
  vacancyId: z.string().trim().min(1).max(300).optional(),
  employerUpdateApproved: z.boolean().optional(),
});
const requestSchema = z.object({
  workspaceId: z.string().trim().min(1),
  planDate: z.string().datetime().optional(),
  enabledProviders: z
    .array(providerSchema)
    .min(1)
    .max(8)
    .default([
      "TIKTOK",
      "FACEBOOK_PAGE",
      "INSTAGRAM_PROFESSIONAL",
      "X",
      "NEXTDOOR",
    ]),
  marketSignals: z.array(signalSchema).max(100).optional(),
  approvedSources: z.array(sourceSchema).max(100).optional(),
  useGemCatalog: z.boolean().default(true),
  gemProductSlugs: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  localContext: z.string().trim().min(1).max(2000).optional(),
  minimumTikTokItems: z.number().int().min(20).max(100).default(20),
  maxItemsPerOtherProvider: z.number().int().min(1).max(20).default(3),
  freshnessWindowDays: z.number().int().positive().max(36500).nullable().optional(),
  requestApprovals: z.boolean().default(true),
  forceRegenerate: z.boolean().default(false),
});

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(
      403,
      "CROSS_ORIGIN_REQUEST_BLOCKED",
      "Content orchestration requires a same-origin request.",
    );
  }
}

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    const planDate = request.nextUrl.searchParams.get("planDate")?.trim();
    if (!workspaceId || !planDate || !/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
      throw new TokMetricError(
        400,
        "VALIDATION_ERROR",
        "workspaceId and planDate in YYYY-MM-DD format are required.",
      );
    }
    await requireWorkspaceAccess(workspaceId, session);
    const campaign = await db.campaign.findFirst({
      where: {
        workspaceId,
        title: `GEM Adaptive Content Plan ${planDate}`,
      },
      include: {
        contents: {
          orderBy: { createdAt: "asc" },
          include: {
            versions: { orderBy: { version: "desc" }, take: 1 },
            reviews: { orderBy: { createdAt: "desc" }, take: 1 },
            approvals: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        campaign,
        externalActionTaken: false,
      },
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
    const input = (await parseJson(request, requestSchema)) as RequestPayload;
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "create", "content");
    requirePermission(membership, "review", "content");
    if (input.requestApprovals) {
      requirePermission(membership, "request", "approvals");
    }

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      throw new TokMetricError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Daily orchestration requests require an Idempotency-Key header.",
      );
    }
    const planDate = input.planDate ? new Date(input.planDate) : new Date();
    const normalizedInput = {
      ...input,
      planDate: planDate.toISOString().slice(0, 10),
    };
    const result = await withIdempotency(
      input.workspaceId,
      idempotencyKey,
      normalizedInput,
      async () => ({
        statusCode: 201,
        response: await orchestrateDailyContent({
          workspaceId: input.workspaceId,
          actorId: session.userId,
          correlationId: cid,
          planDate,
          enabledProviders: input.enabledProviders,
          marketSignals: input.marketSignals?.map((signal) => ({
            ...signal,
            observedAt: new Date(signal.observedAt),
          })),
          approvedSources: input.approvedSources?.map((source) => ({
            ...source,
            approvedAt: new Date(source.approvedAt),
          })),
          useGemCatalog: input.useGemCatalog,
          gemProductSlugs: input.gemProductSlugs,
          localContext: input.localContext,
          minimumTikTokItems: input.minimumTikTokItems,
          maxItemsPerOtherProvider: input.maxItemsPerOtherProvider,
          freshnessWindowDays: input.freshnessWindowDays,
          requestApprovals: input.requestApprovals,
          forceRegenerate: input.forceRegenerate,
        }),
      }),
      normalizedInput,
    );

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        data: result.response,
      },
      {
        status: result.statusCode,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
