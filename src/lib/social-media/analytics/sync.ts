import { loadSocialConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
import { emitTokMetricAudit, redactSecrets } from "@/lib/tokmetric/security";
import {
  ACCOUNT_METRICS_CAPABILITY,
  createAnalyticsHttpClient,
  fetchAccountMetrics,
  fetchPostMetrics,
  POST_METRICS_CAPABILITY,
} from "./providers";
import {
  listPublishedJobsForMetrics,
  recordSocialMetricSyncRun,
  upsertProviderAccountMetrics,
  upsertSocialMetricSnapshot,
} from "./store";
import type {
  AnalyticsHttpClient,
  FetchedAccountMetrics,
  FetchedPostMetrics,
  MetricCollectionStatus,
  PublishedJobForMetrics,
  SocialAnalyticsProvider,
} from "./types";

/** Per-provider lookback windows (days) for post metrics collection. */
export const METRICS_LOOKBACK_DAYS: Record<SocialAnalyticsProvider, number> = {
  FACEBOOK_PAGE: 30,
  INSTAGRAM_PROFESSIONAL: 30,
  X: 30,
  LINKEDIN_COMPANY: 14,
  YOUTUBE: 90,
  NEXTDOOR: 0,
  TELEGRAM: 0,
};

export interface MetricsSyncDependencies {
  http?: AnalyticsHttpClient;
  loadCredential?: typeof loadSocialConnectorCredential;
}

export interface MetricsSyncResult {
  jobsConsidered: number;
  snapshotsCollected: number;
  accountMetricsCollected: number;
  runs: Array<{
    kind: "POST_METRICS" | "ACCOUNT_METRICS";
    provider: SocialAnalyticsProvider;
    status: MetricCollectionStatus;
  }>;
}

function metricDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function publishedHourUtc(job: PublishedJobForMetrics): number | null {
  if (!job.completedAt) return null;
  const date = job.completedAt instanceof Date ? job.completedAt : new Date(job.completedAt);
  return Number.isNaN(date.getTime()) ? null : date.getUTCHours();
}

async function audit(input: Parameters<typeof emitTokMetricAudit>[0]) {
  await emitTokMetricAudit(input).catch(() => undefined);
}

async function collectPostMetrics(options: {
  job: PublishedJobForMetrics;
  http: AnalyticsHttpClient;
  loadCredential: typeof loadSocialConnectorCredential;
}): Promise<{ collected: boolean; status: MetricCollectionStatus }> {
  const { job, http, loadCredential } = options;
  const capability = POST_METRICS_CAPABILITY[job.provider];
  if (capability !== "COLLECTED") {
    await recordSocialMetricSyncRun({
      workspaceId: job.workspaceId,
      connectorId: job.connectorId,
      publishingJobId: job.id,
      provider: job.provider,
      externalPostId: job.externalPostId,
      kind: "POST_METRICS",
      status: capability,
      errorCode: null,
      errorMessage: null,
      providerStatusCode: null,
    });
    return { collected: false, status: capability };
  }

  let credential: Awaited<ReturnType<typeof loadSocialConnectorCredential>>;
  try {
    credential = await loadCredential({
      workspaceId: job.workspaceId,
      connectorId: job.connectorId,
    });
  } catch (error) {
    await recordSocialMetricSyncRun({
      workspaceId: job.workspaceId,
      connectorId: job.connectorId,
      publishingJobId: job.id,
      provider: job.provider,
      externalPostId: job.externalPostId,
      kind: "POST_METRICS",
      status: "FAILED",
      errorCode: "SOCIAL_METRICS_CREDENTIAL_UNAVAILABLE",
      errorMessage: error instanceof Error ? error.message : "Connector credential could not be loaded.",
      providerStatusCode: null,
    });
    return { collected: false, status: "FAILED" };
  }

  const accessToken =
    typeof (credential.credential as { accessToken?: unknown }).accessToken === "string"
      ? ((credential.credential as { accessToken: string }).accessToken)
      : null;
  if (!accessToken) {
    await recordSocialMetricSyncRun({
      workspaceId: job.workspaceId,
      connectorId: job.connectorId,
      publishingJobId: job.id,
      provider: job.provider,
      externalPostId: job.externalPostId,
      kind: "POST_METRICS",
      status: "FAILED",
      errorCode: "SOCIAL_METRICS_TOKEN_MISSING",
      errorMessage: "Connector credential has no usable access token.",
      providerStatusCode: null,
    });
    return { collected: false, status: "FAILED" };
  }

  let fetched: FetchedPostMetrics;
  try {
    fetched = await fetchPostMetrics(job.provider, {
      http,
      accessToken,
      externalPostId: job.externalPostId,
      externalAccountId: credential.connector.externalAccountId ?? null,
    });
  } catch (error) {
    fetched = {
      status: "FAILED",
      metrics: null,
      engagementRate: null,
      errorCode: "SOCIAL_METRICS_FETCHER_ERROR",
      errorMessage: error instanceof Error ? error.message : "Metrics fetcher threw.",
      providerStatusCode: null,
      raw: {},
    };
  }

  if (fetched.status !== "COLLECTED" || !fetched.metrics) {
    await recordSocialMetricSyncRun({
      workspaceId: job.workspaceId,
      connectorId: job.connectorId,
      publishingJobId: job.id,
      provider: job.provider,
      externalPostId: job.externalPostId,
      kind: "POST_METRICS",
      status: fetched.status,
      errorCode: fetched.errorCode,
      errorMessage: fetched.errorMessage,
      providerStatusCode: fetched.providerStatusCode,
    });
    return { collected: false, status: fetched.status };
  }

  // Stamp join metadata the learning loop needs; never touches provider values.
  const raw: Record<string, unknown> = { ...fetched.raw };
  if (typeof raw.contentType !== "string") raw.contentType = job.contentType;
  const hour = publishedHourUtc(job);
  if (typeof raw.publishedHourUtc !== "number" && hour !== null) {
    raw.publishedHourUtc = hour;
  }

  await upsertSocialMetricSnapshot({
    workspaceId: job.workspaceId,
    connectorId: job.connectorId,
    publishingJobId: job.id,
    provider: job.provider,
    externalPostId: job.externalPostId,
    metricDate: metricDateToday(),
    metrics: fetched.metrics,
    engagementRate: fetched.engagementRate,
    raw: redactSecrets(raw) as Record<string, unknown>,
  });
  await recordSocialMetricSyncRun({
    workspaceId: job.workspaceId,
    connectorId: job.connectorId,
    publishingJobId: job.id,
    provider: job.provider,
    externalPostId: job.externalPostId,
    kind: "POST_METRICS",
    status: "COLLECTED",
    errorCode: null,
    errorMessage: null,
    providerStatusCode: fetched.providerStatusCode,
  });
  return { collected: true, status: "COLLECTED" };
}

async function collectAccountMetrics(options: {
  workspaceId: string;
  connectorId: string;
  provider: SocialAnalyticsProvider;
  http: AnalyticsHttpClient;
  loadCredential: typeof loadSocialConnectorCredential;
}): Promise<{ collected: boolean; status: MetricCollectionStatus }> {
  const { workspaceId, connectorId, provider, http, loadCredential } = options;
  const capability = ACCOUNT_METRICS_CAPABILITY[provider];
  if (capability !== "COLLECTED") {
    await recordSocialMetricSyncRun({
      workspaceId,
      connectorId,
      publishingJobId: null,
      provider,
      externalPostId: null,
      kind: "ACCOUNT_METRICS",
      status: capability,
      errorCode: null,
      errorMessage: null,
      providerStatusCode: null,
    });
    return { collected: false, status: capability };
  }

  let credential: Awaited<ReturnType<typeof loadSocialConnectorCredential>>;
  try {
    credential = await loadCredential({ workspaceId, connectorId });
  } catch (error) {
    await recordSocialMetricSyncRun({
      workspaceId,
      connectorId,
      publishingJobId: null,
      provider,
      externalPostId: null,
      kind: "ACCOUNT_METRICS",
      status: "FAILED",
      errorCode: "SOCIAL_METRICS_CREDENTIAL_UNAVAILABLE",
      errorMessage: error instanceof Error ? error.message : "Connector credential could not be loaded.",
      providerStatusCode: null,
    });
    return { collected: false, status: "FAILED" };
  }

  const accessToken =
    typeof (credential.credential as { accessToken?: unknown }).accessToken === "string"
      ? ((credential.credential as { accessToken: string }).accessToken)
      : null;
  if (!accessToken) {
    await recordSocialMetricSyncRun({
      workspaceId,
      connectorId,
      publishingJobId: null,
      provider,
      externalPostId: null,
      kind: "ACCOUNT_METRICS",
      status: "FAILED",
      errorCode: "SOCIAL_METRICS_TOKEN_MISSING",
      errorMessage: "Connector credential has no usable access token.",
      providerStatusCode: null,
    });
    return { collected: false, status: "FAILED" };
  }

  let fetched: FetchedAccountMetrics;
  try {
    fetched = await fetchAccountMetrics(provider, {
      http,
      accessToken,
      externalAccountId: credential.connector.externalAccountId ?? null,
      connectorMetadata:
        credential.connector.safeMetadata &&
        typeof credential.connector.safeMetadata === "object"
          ? (credential.connector.safeMetadata as Record<string, unknown>)
          : {},
    });
  } catch (error) {
    fetched = {
      status: "FAILED",
      metrics: null,
      errorCode: "SOCIAL_METRICS_FETCHER_ERROR",
      errorMessage: error instanceof Error ? error.message : "Metrics fetcher threw.",
      providerStatusCode: null,
      raw: {},
    };
  }

  if (fetched.status !== "COLLECTED" || !fetched.metrics) {
    await recordSocialMetricSyncRun({
      workspaceId,
      connectorId,
      publishingJobId: null,
      provider,
      externalPostId: null,
      kind: "ACCOUNT_METRICS",
      status: fetched.status,
      errorCode: fetched.errorCode,
      errorMessage: fetched.errorMessage,
      providerStatusCode: fetched.providerStatusCode,
    });
    return { collected: false, status: fetched.status };
  }

  await upsertProviderAccountMetrics({
    workspaceId,
    connectorId,
    provider,
    metricDate: metricDateToday(),
    metrics: fetched.metrics,
    raw: redactSecrets(fetched.raw) as Record<string, unknown>,
  });
  await recordSocialMetricSyncRun({
    workspaceId,
    connectorId,
    publishingJobId: null,
    provider,
    externalPostId: null,
    kind: "ACCOUNT_METRICS",
    status: "COLLECTED",
    errorCode: null,
    errorMessage: null,
    providerStatusCode: fetched.providerStatusCode,
  });
  return { collected: true, status: "COLLECTED" };
}

/**
 * Analytics ingestion worker. Iterates recently-published jobs per provider
 * lookback window, fetches post metrics, upserts snapshots idempotently, and
 * refreshes daily provider account metrics. Failures are recorded in
 * social_metric_sync_runs — never zero-filled into snapshots.
 */
export async function runSocialMetricsSync(
  limit = 50,
  deps: MetricsSyncDependencies = {},
): Promise<MetricsSyncResult> {
  const http = deps.http ?? createAnalyticsHttpClient();
  const loadCredential = deps.loadCredential ?? loadSocialConnectorCredential;
  const maxLookback = Math.max(...Object.values(METRICS_LOOKBACK_DAYS));
  const jobs = await listPublishedJobsForMetrics({ lookbackDays: maxLookback, limit });
  const result: MetricsSyncResult = {
    jobsConsidered: 0,
    snapshotsCollected: 0,
    accountMetricsCollected: 0,
    runs: [],
  };
  const accountJobs = new Map<string, { workspaceId: string; connectorId: string; provider: SocialAnalyticsProvider }>();

  for (const job of jobs) {
    const lookback = METRICS_LOOKBACK_DAYS[job.provider] ?? 0;
    if (lookback <= 0) {
      // Provider has no usable metrics API; still record honestly once per run.
      await collectPostMetrics({ job, http, loadCredential });
      result.runs.push({ kind: "POST_METRICS", provider: job.provider, status: "NOT_SUPPORTED" });
      continue;
    }
    const cutoff = Date.now() - lookback * 24 * 60 * 60 * 1000;
    if (job.completedAt && job.completedAt.getTime() < cutoff) continue;
    result.jobsConsidered += 1;
    const outcome = await collectPostMetrics({ job, http, loadCredential });
    result.runs.push({ kind: "POST_METRICS", provider: job.provider, status: outcome.status });
    if (outcome.collected) result.snapshotsCollected += 1;
    const accountKey = `${job.workspaceId}::${job.connectorId}`;
    if (!accountJobs.has(accountKey)) {
      accountJobs.set(accountKey, {
        workspaceId: job.workspaceId,
        connectorId: job.connectorId,
        provider: job.provider,
      });
    }
    await audit({
      workspaceId: job.workspaceId,
      actorId: undefined,
      action: "SOCIAL_METRICS_SYNCED",
      entityType: "SOCIAL_PUBLISHING_JOB",
      entityId: job.id,
      correlationId: job.id,
      outcome: outcome.status,
      sourceChannel: "social-metrics-worker",
      metadata: { provider: job.provider, collected: outcome.collected },
    });
  }

  // Refresh account metrics once per connector per run.
  for (const entry of accountJobs.values()) {
    const outcome = await collectAccountMetrics({ ...entry, http, loadCredential });
    result.runs.push({ kind: "ACCOUNT_METRICS", provider: entry.provider, status: outcome.status });
    if (outcome.collected) result.accountMetricsCollected += 1;
  }

  return result;
}
