import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

// The Prisma client cannot be generated in this sandbox (engine download is
// blocked), so unit tests run against a minimal mock of the Prisma.sql
// template-tag API. The mock preserves sql text + bound values, which is all
// the analytics store SQL builders need.
vi.mock("@prisma/client", () => {
  class MockSql {
    constructor(
      public sql: string,
      public values: unknown[],
    ) {}
  }
  function sqlTag(strings: TemplateStringsArray, ...values: unknown[]) {
    let text = "";
    const flat: unknown[] = [];
    strings.forEach((part, index) => {
      text += part;
      if (index < values.length) {
        const value = values[index];
        if (value instanceof MockSql) {
          text += value.sql;
          flat.push(...value.values);
        } else {
          flat.push(value);
          text += `$${flat.length}`;
        }
      }
    });
    return new MockSql(text, flat);
  }
  return { Prisma: { sql: sqlTag } };
});

// Import after the mock is registered.
const store = await import("@/lib/social-media/analytics/store");

beforeEach(() => {
  queryRaw.mockReset();
});

function lastSql(): { sql: string; values: unknown[] } {
  const call = queryRaw.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
  expect(call).toBeDefined();
  expect(typeof call.sql).toBe("string");
  return call;
}

describe("social analytics store", () => {
  it("upserts snapshots idempotently on the unique post-day key", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        id: "snap-1",
        workspaceId: "ws-1",
        connectorId: "conn-1",
        publishingJobId: "job-1",
        provider: "X",
        externalPostId: "tweet-9",
        metricDate: "2026-09-29",
        views: null,
        impressions: 100,
        reach: null,
        likes: 5,
        comments: null,
        shares: null,
        saves: null,
        clicks: null,
        watchTimeSeconds: null,
        followersDelta: null,
        engagementRate: 0.05,
        collectedAt: new Date("2026-09-29T12:00:00.000Z"),
        raw: {},
      },
    ]);

    const snapshot = await store.upsertSocialMetricSnapshot({
      workspaceId: "ws-1",
      connectorId: "conn-1",
      publishingJobId: "job-1",
      provider: "X",
      externalPostId: "tweet-9",
      metricDate: "2026-09-29",
      metrics: {
        views: null,
        impressions: 100,
        reach: null,
        likes: 5,
        comments: null,
        shares: null,
        saves: null,
        clicks: null,
        watchTimeSeconds: null,
        followersDelta: null,
      },
      engagementRate: 0.05,
      raw: {},
    });

    const { sql } = lastSql();
    expect(sql).toContain("INSERT INTO social_metric_snapshots");
    // The atomic claim point: re-running the same day replaces, never duplicates.
    expect(sql).toContain("ON CONFLICT (workspace_id, provider, external_post_id, metric_date)");
    expect(sql).toContain("DO UPDATE SET");
    expect(snapshot.id).toBe("snap-1");
    expect(snapshot.impressions).toBe(100);
  });

  it("upserts provider account metrics on the unique connector-day key", async () => {
    queryRaw.mockResolvedValueOnce([]);
    await store.upsertProviderAccountMetrics({
      workspaceId: "ws-1",
      connectorId: "conn-1",
      provider: "INSTAGRAM_PROFESSIONAL",
      metricDate: "2026-09-29",
      metrics: {
        followers: 1200,
        following: 300,
        posts: 45,
        impressions: null,
        reach: null,
        profileViews: null,
      },
      raw: {},
    });
    const { sql } = lastSql();
    expect(sql).toContain("INSERT INTO provider_account_metrics");
    expect(sql).toContain("ON CONFLICT (workspace_id, connector_id, metric_date)");
  });

  it("records sync failures without touching snapshot metrics", async () => {
    queryRaw.mockResolvedValueOnce([]);
    await store.recordSocialMetricSyncRun({
      workspaceId: "ws-1",
      connectorId: "conn-1",
      publishingJobId: "job-1",
      provider: "X",
      externalPostId: "tweet-9",
      kind: "POST_METRICS",
      status: "FAILED",
      errorCode: "X_METRICS_REQUEST_FAILED",
      errorMessage: "boom",
      providerStatusCode: 500,
    });
    const { sql } = lastSql();
    expect(sql).toContain("INSERT INTO social_metric_sync_runs");
    expect(sql).not.toContain("social_metric_snapshots");
  });

  it("lists only published jobs with an external post id for metrics", async () => {
    queryRaw.mockResolvedValueOnce([]);
    await store.listPublishedJobsForMetrics({ lookbackDays: 30, limit: 50 });
    const { sql } = lastSql();
    expect(sql).toContain("FROM social_publishing_jobs");
    expect(sql).toContain("state = 'PUBLISHED'");
    expect(sql).toContain("external_post_id IS NOT NULL");
  });

  it("scopes snapshot reads to the requesting workspace", async () => {
    queryRaw.mockResolvedValueOnce([]);
    await store.listSocialMetricSnapshots({ workspaceId: "ws-scoped" });
    const { sql, values } = lastSql();
    expect(sql).toContain("FROM social_metric_snapshots");
    expect(sql).toContain("workspace_id =");
    expect(values).toContain("ws-scoped");
  });

  it("expands nested selection fragments in the returned row query", async () => {
    queryRaw.mockResolvedValueOnce([]);
    await store.listSocialMetricSnapshots({ workspaceId: "ws-1" });
    const { sql } = lastSql();
    expect(sql).toContain('workspace_id AS "workspaceId"');
  });
});
