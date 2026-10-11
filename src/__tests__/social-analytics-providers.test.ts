import { describe, expect, it } from "vitest";
import {
  computeEngagementRate,
  fetchInstagramPostMetrics,
  fetchLinkedInPostMetrics,
  fetchMetaPostMetrics,
  fetchNextdoorAccountMetrics,
  fetchNextdoorPostMetrics,
  fetchXTweetMetrics,
  fetchYouTubeVideoMetrics,
  sanitizeProviderPayload,
  toMetricNumber,
} from "@/lib/social-media/analytics/providers";
import type {
  AnalyticsHttpClient,
  MetricFetchContext,
} from "@/lib/social-media/analytics/types";

function mockHttp(handler: (url: string) => { status: number; body: unknown }): AnalyticsHttpClient {
  return {
    async get(url: string) {
      const { status, body } = handler(url);
      return {
        status,
        async json() {
          return body;
        },
      };
    },
  };
}

function ctx(http: AnalyticsHttpClient, overrides: Partial<MetricFetchContext> = {}): MetricFetchContext {
  return {
    http,
    accessToken: "test-token",
    externalPostId: "post-123",
    externalAccountId: "account-456",
    ...overrides,
  };
}

describe("social analytics provider fetchers", () => {
  it("parses Meta page post insights without inventing values", async () => {
    const http = mockHttp(() => ({
      status: 200,
      body: {
        likes: { summary: { total_count: 42 } },
        comments: { summary: { total_count: 7 } },
        shares: { count: 3 },
        insights: {
          data: [
            { name: "post_impressions", values: [{ value: 1000 }] },
            { name: "post_impressions_unique", values: [{ value: 800 }] },
            { name: "post_clicks", values: [{ value: 50 }] },
            { name: "post_engaged_users", values: [{ value: 120 }] },
          ],
        },
      },
    }));
    const result = await fetchMetaPostMetrics(ctx(http));
    expect(result.status).toBe("COLLECTED");
    expect(result.metrics).toMatchObject({
      impressions: 1000,
      reach: 800,
      clicks: 50,
      likes: 42,
      comments: 7,
      shares: 3,
      saves: null,
      watchTimeSeconds: null,
    });
    // (42 + 7 + 3 + 50) / 1000
    expect(result.engagementRate).toBeCloseTo(0.102, 5);
    expect(result.errorCode).toBeNull();
  });

  it("parses Instagram media insights and leaves unsupported metrics null", async () => {
    const http = mockHttp(() => ({
      status: 200,
      body: {
        data: [
          { name: "impressions", values: [{ value: 500 }] },
          { name: "reach", values: [{ value: 400 }] },
          { name: "likes", values: [{ value: 25 }] },
          { name: "comments", values: [{ value: 2 }] },
          { name: "shares", values: [{ value: 1 }] },
        ],
      },
    }));
    const result = await fetchInstagramPostMetrics(ctx(http));
    expect(result.status).toBe("COLLECTED");
    expect(result.metrics).toMatchObject({
      impressions: 500,
      reach: 400,
      likes: 25,
      comments: 2,
      shares: 1,
      saves: null,
      clicks: null,
      views: null,
    });
  });

  it("parses X public_metrics and reports tier requirement on 403", async () => {
    const okHttp = mockHttp(() => ({
      status: 200,
      body: {
        data: {
          public_metrics: {
            impression_count: 900,
            like_count: 30,
            reply_count: 4,
            repost_count: 2,
            quote_count: 1,
            bookmark_count: 5,
          },
        },
      },
    }));
    const ok = await fetchXTweetMetrics(ctx(okHttp));
    expect(ok.status).toBe("COLLECTED");
    expect(ok.metrics).toMatchObject({
      impressions: 900,
      views: 900,
      likes: 30,
      comments: 4,
      shares: 3,
    });

    const tierHttp = mockHttp(() => ({
      status: 403,
      body: { title: "Forbidden", detail: "This endpoint requires a higher tier." },
    }));
    const tier = await fetchXTweetMetrics(ctx(tierHttp));
    expect(tier.status).toBe("API_TIER_REQUIRED");
    expect(tier.metrics).toBeNull();
    expect(tier.errorMessage).toContain("elevated API tier");
  });

  it("reports LinkedIn per-post stats as tier-restricted instead of inventing", async () => {
    const http = mockHttp(() => ({
      status: 403,
      body: { message: "Not enough permissions to access" },
    }));
    const result = await fetchLinkedInPostMetrics(ctx(http));
    expect(result.status).toBe("API_TIER_REQUIRED");
    expect(result.metrics).toBeNull();
    expect(result.providerStatusCode).toBe(403);
  });

  it("parses YouTube Analytics reports by column header", async () => {
    const http = mockHttp(() => ({
      status: 200,
      body: {
        columnHeaders: [
          { name: "views" },
          { name: "likes" },
          { name: "comments" },
          { name: "shares" },
          { name: "estimatedMinutesWatched" },
          { name: "subscribersGained" },
          { name: "subscribersLost" },
        ],
        rows: [[1200, 60, 10, 4, 90, 12, 3]],
      },
    }));
    const result = await fetchYouTubeVideoMetrics(ctx(http));
    expect(result.status).toBe("COLLECTED");
    expect(result.metrics).toMatchObject({
      views: 1200,
      likes: 60,
      comments: 10,
      shares: 4,
      watchTimeSeconds: 5400,
      followersDelta: 9,
    });
  });

  it("reports YouTube analytics scope problems as tier-required, not failure", async () => {
    const http = mockHttp(() => ({ status: 403, body: { error: { message: "Request had insufficient authentication scopes." } } }));
    const result = await fetchYouTubeVideoMetrics(ctx(http));
    expect(result.status).toBe("API_TIER_REQUIRED");
    expect(result.errorMessage).toContain("youtubeAnalytics.readonly");
  });

  it("honestly reports Nextdoor as unsupported", async () => {
    const post = await fetchNextdoorPostMetrics();
    const account = await fetchNextdoorAccountMetrics();
    expect(post.status).toBe("NOT_SUPPORTED");
    expect(post.metrics).toBeNull();
    expect(account.status).toBe("NOT_SUPPORTED");
  });

  it("distinguishes provider failure from zero-valued metrics", async () => {
    const failing = mockHttp(() => {
      throw new Error("socket hangup");
    });
    const failed = await fetchMetaPostMetrics(ctx(failing));
    expect(failed.status).toBe("FAILED");
    expect(failed.metrics).toBeNull();
    expect(failed.errorCode).toBe("META_METRICS_TRANSPORT_ERROR");

    const zeros = mockHttp(() => ({
      status: 200,
      body: {
        data: [
          { name: "impressions", values: [{ value: 0 }] },
          { name: "reach", values: [{ value: 0 }] },
          { name: "likes", values: [{ value: 0 }] },
          { name: "comments", values: [{ value: 0 }] },
        ],
      },
    }));
    const zeroed = await fetchInstagramPostMetrics(ctx(zeros));
    expect(zeroed.status).toBe("COLLECTED");
    expect(zeroed.metrics).toMatchObject({ impressions: 0, reach: 0, likes: 0, comments: 0 });
  });

  it("strips secrets and unknown keys from stored raw payloads", () => {
    const sanitized = sanitizeProviderPayload("X", {
      impression_count: 10,
      like_count: 1,
      access_token: "sekret",
      client_secret: "sekret",
      injected_field: "drop me",
    });
    expect(sanitized).toEqual({ impression_count: 10, like_count: 1 });
  });

  it("coerces metric numbers safely", () => {
    expect(toMetricNumber("42")).toBe(42);
    expect(toMetricNumber(0)).toBe(0);
    expect(toMetricNumber(null)).toBeNull();
    expect(toMetricNumber(undefined)).toBeNull();
    expect(toMetricNumber(-3)).toBeNull();
    expect(toMetricNumber("not-a-number")).toBeNull();
  });

  it("computes engagement rate only from present values", () => {
    expect(
      computeEngagementRate({
        views: null, impressions: 100, reach: null, likes: 5, comments: 3,
        shares: null, saves: null, clicks: 2, watchTimeSeconds: null, followersDelta: null,
      }),
    ).toBeCloseTo(0.1, 5);
    // No engagement fields present at all -> null, not 0.
    expect(
      computeEngagementRate({
        views: null, impressions: 100, reach: null, likes: null, comments: null,
        shares: null, saves: null, clicks: null, watchTimeSeconds: null, followersDelta: null,
      }),
    ).toBeNull();
    // No base -> null.
    expect(
      computeEngagementRate({
        views: null, impressions: null, reach: null, likes: 5, comments: null,
        shares: null, saves: null, clicks: null, watchTimeSeconds: null, followersDelta: null,
      }),
    ).toBeNull();
  });
});
