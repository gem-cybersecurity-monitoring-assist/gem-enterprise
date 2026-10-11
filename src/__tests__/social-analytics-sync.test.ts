import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsHttpClient } from "@/lib/social-media/analytics/types";

const upsertSocialMetricSnapshot = vi.fn();
const upsertProviderAccountMetrics = vi.fn();
const recordSocialMetricSyncRun = vi.fn();
const listPublishedJobsForMetrics = vi.fn();
const loadSocialConnectorCredential = vi.fn();
const emitTokMetricAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/social-media/analytics/store", () => ({
  upsertSocialMetricSnapshot: (...args: unknown[]) => upsertSocialMetricSnapshot(...args),
  upsertProviderAccountMetrics: (...args: unknown[]) => upsertProviderAccountMetrics(...args),
  recordSocialMetricSyncRun: (...args: unknown[]) => recordSocialMetricSyncRun(...args),
  listPublishedJobsForMetrics: (...args: unknown[]) => listPublishedJobsForMetrics(...args),
}));

vi.mock("@/lib/social-media/oauth/lifecycle-store", () => ({
  loadSocialConnectorCredential: (...args: unknown[]) => loadSocialConnectorCredential(...args),
}));

vi.mock("@/lib/tokmetric/security", () => ({
  emitTokMetricAudit: (...args: unknown[]) => emitTokMetricAudit(...args),
  redactSecrets: (value: unknown) => value,
}));

const { runSocialMetricsSync } = await import("@/lib/social-media/analytics/sync");

function instagramHttp(): AnalyticsHttpClient {
  return {
    async get() {
      return {
        status: 200,
        async json() {
          return {
            data: [
              { name: "impressions", values: [{ value: 700 }] },
              { name: "reach", values: [{ value: 600 }] },
              { name: "likes", values: [{ value: 35 }] },
              { name: "comments", values: [{ value: 5 }] },
            ],
          };
        },
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadSocialConnectorCredential.mockResolvedValue({
    connector: { externalAccountId: "ig-user-1", safeMetadata: {} },
    credential: { accessToken: "server-side-token" },
  });
});

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-ig-1",
    workspaceId: "ws-1",
    connectorId: "conn-ig-1",
    provider: "INSTAGRAM_PROFESSIONAL",
    contentType: "SHORT_VIDEO",
    externalPostId: "ig-media-1",
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("social metrics sync worker", () => {
  it("collects post metrics and upserts snapshots idempotently", async () => {
    listPublishedJobsForMetrics.mockResolvedValue([job()]);
    const result = await runSocialMetricsSync(50, { http: instagramHttp() });

    expect(result.jobsConsidered).toBe(1);
    expect(result.snapshotsCollected).toBe(1);
    expect(upsertSocialMetricSnapshot).toHaveBeenCalledTimes(1);
    const input = upsertSocialMetricSnapshot.mock.calls[0][0];
    expect(input.workspaceId).toBe("ws-1");
    expect(input.provider).toBe("INSTAGRAM_PROFESSIONAL");
    expect(input.externalPostId).toBe("ig-media-1");
    expect(input.metrics.impressions).toBe(700);
    expect(input.raw.contentType).toBe("SHORT_VIDEO");
    expect(recordSocialMetricSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "POST_METRICS", status: "COLLECTED" }),
    );
  });

  it("records NOT_SUPPORTED without calling the provider for unsupported providers", async () => {
    const get = vi.fn();
    listPublishedJobsForMetrics.mockResolvedValue([
      job({ id: "job-nd-1", provider: "NEXTDOOR", externalPostId: "nd-1" }),
    ]);
    const result = await runSocialMetricsSync(50, { http: { get } });

    expect(get).not.toHaveBeenCalled();
    expect(upsertSocialMetricSnapshot).not.toHaveBeenCalled();
    expect(result.runs).toContainEqual(
      expect.objectContaining({ kind: "POST_METRICS", provider: "NEXTDOOR", status: "NOT_SUPPORTED" }),
    );
    expect(recordSocialMetricSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "POST_METRICS", status: "NOT_SUPPORTED" }),
    );
  });

  it("skips jobs older than the provider lookback window", async () => {
    const get = vi.fn();
    listPublishedJobsForMetrics.mockResolvedValue([
      job({
        id: "job-old",
        provider: "FACEBOOK_PAGE",
        externalPostId: "fb-old",
        completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      }),
    ]);
    const result = await runSocialMetricsSync(50, { http: { get } });

    expect(get).not.toHaveBeenCalled();
    expect(result.jobsConsidered).toBe(0);
    expect(upsertSocialMetricSnapshot).not.toHaveBeenCalled();
  });

  it("records failures instead of zero-filling snapshots", async () => {
    const failingHttp: AnalyticsHttpClient = {
      async get() {
        throw new Error("provider down");
      },
    };
    listPublishedJobsForMetrics.mockResolvedValue([job()]);
    const result = await runSocialMetricsSync(50, { http: failingHttp });

    expect(result.snapshotsCollected).toBe(0);
    expect(upsertSocialMetricSnapshot).not.toHaveBeenCalled();
    expect(recordSocialMetricSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "POST_METRICS", status: "FAILED" }),
    );
  });

  it("refreshes account metrics once per connector", async () => {
    const accountHttp: AnalyticsHttpClient = {
      async get() {
        return {
          status: 200,
          async json() {
            return {
              data: [
                { name: "impressions", values: [{ value: 700 }] },
                { name: "likes", values: [{ value: 35 }] },
              ],
            };
          },
        };
      },
    };
    listPublishedJobsForMetrics.mockResolvedValue([job(), job({ id: "job-ig-2", externalPostId: "ig-media-2" })]);
    const result = await runSocialMetricsSync(50, { http: accountHttp });

    expect(result.snapshotsCollected).toBe(2);
    expect(upsertProviderAccountMetrics).toHaveBeenCalledTimes(1);
    expect(result.accountMetricsCollected).toBe(1);
  });
});
