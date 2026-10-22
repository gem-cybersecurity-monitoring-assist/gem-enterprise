import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listSocialMetricSnapshots } from "@/lib/social-media/analytics/store";
import { sharedSocialPublishingProviders } from "@/lib/social-media/publishing/types";
import type { SocialAnalyticsProvider } from "@/lib/social-media/analytics/types";
import {
  correlationId,
  requirePermission,
  requireTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const querySchema = z.object({
  workspaceId: z.string().trim().min(1),
  provider: z.enum(sharedSocialPublishingProviders).optional(),
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
  contentId: z.string().trim().min(1).optional(),
});

interface DayBucket {
  date: string;
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  posts: number;
}

function sum(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const params = request.nextUrl.searchParams;
    const input = querySchema.parse({
      workspaceId: params.get("workspaceId") ?? undefined,
      provider: params.get("provider") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      contentId: params.get("contentId") ?? undefined,
    });
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "manage", "analytics");

    // NOTE: contentId here is the publishing job id (the workspace-scoped
    // identifier callers have); provider post ids are never secrets but the
    // job id keeps scoping unambiguous.
    const snapshots = await listSocialMetricSnapshots({
      workspaceId: input.workspaceId,
      provider: input.provider as SocialAnalyticsProvider | undefined,
      from: input.from,
      to: input.to,
      publishingJobId: input.contentId,
      limit: 2000,
    });

    const byDay = new Map<string, DayBucket>();
    const totals: DayBucket = {
      date: "total",
      views: 0,
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: 0,
      posts: 0,
    };
    const postsSeen = new Set<string>();
    for (const snapshot of snapshots) {
      let bucket = byDay.get(snapshot.metricDate);
      if (!bucket) {
        bucket = {
          date: snapshot.metricDate,
          views: 0,
          impressions: 0,
          reach: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          clicks: 0,
          posts: 0,
        };
        byDay.set(snapshot.metricDate, bucket);
      }
      // One observation per post per day: keep the latest collected snapshot.
      const postKey = `${snapshot.provider}::${snapshot.externalPostId}::${snapshot.metricDate}`;
      if (postsSeen.has(postKey)) continue;
      postsSeen.add(postKey);
      bucket.views += sum(snapshot.views);
      bucket.impressions += sum(snapshot.impressions);
      bucket.reach += sum(snapshot.reach);
      bucket.likes += sum(snapshot.likes);
      bucket.comments += sum(snapshot.comments);
      bucket.shares += sum(snapshot.shares);
      bucket.saves += sum(snapshot.saves);
      bucket.clicks += sum(snapshot.clicks);
      bucket.posts += 1;
    }
    const series = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const bucket of series) {
      totals.views += bucket.views;
      totals.impressions += bucket.impressions;
      totals.reach += bucket.reach;
      totals.likes += bucket.likes;
      totals.comments += bucket.comments;
      totals.shares += bucket.shares;
      totals.saves += bucket.saves;
      totals.clicks += bucket.clicks;
      totals.posts += bucket.posts;
    }
    const engagement = totals.likes + totals.comments + totals.shares + totals.saves + totals.clicks;
    const base = totals.impressions || totals.reach || totals.views;

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        filters: {
          workspaceId: input.workspaceId,
          provider: input.provider ?? null,
          from: input.from ?? null,
          to: input.to ?? null,
          contentId: input.contentId ?? null,
        },
        totals: {
          ...totals,
          engagementRate: base > 0 ? engagement / base : null,
        },
        series,
        // Responses carry aggregated provider-returned metrics only: no
        // secrets, no raw provider payloads, no invented values.
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return tokMetricErrorResponse(
        new TokMetricError(400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid query parameters."),
        cid,
      );
    }
    return tokMetricErrorResponse(error, cid);
  }
}
