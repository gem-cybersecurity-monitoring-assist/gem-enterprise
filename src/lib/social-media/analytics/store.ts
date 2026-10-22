import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  AccountMetricValues,
  MetricCollectionStatus,
  PostMetricValues,
  PublishedJobForMetrics,
  SocialAnalyticsProvider,
  SocialMetricSnapshotRecord,
} from "./types";

export interface UpsertSnapshotInput {
  workspaceId: string;
  connectorId: string;
  publishingJobId: string | null;
  provider: SocialAnalyticsProvider;
  externalPostId: string;
  metricDate: string; // YYYY-MM-DD
  metrics: PostMetricValues;
  engagementRate: number | null;
  raw: Record<string, unknown>;
}

export interface UpsertAccountMetricsInput {
  workspaceId: string;
  connectorId: string;
  provider: SocialAnalyticsProvider;
  metricDate: string; // YYYY-MM-DD
  metrics: AccountMetricValues;
  raw: Record<string, unknown>;
}

export interface RecordSyncRunInput {
  workspaceId: string;
  connectorId: string;
  publishingJobId: string | null;
  provider: SocialAnalyticsProvider;
  externalPostId: string | null;
  kind: "POST_METRICS" | "ACCOUNT_METRICS";
  status: MetricCollectionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  providerStatusCode: number | null;
}

const snapshotSelection = Prisma.sql`
  id,
  workspace_id AS "workspaceId",
  connector_id AS "connectorId",
  publishing_job_id AS "publishingJobId",
  provider,
  external_post_id AS "externalPostId",
  metric_date AS "metricDate",
  views,
  impressions,
  reach,
  likes,
  comments,
  shares,
  saves,
  clicks,
  watch_time_seconds AS "watchTimeSeconds",
  followers_delta AS "followersDelta",
  engagement_rate AS "engagementRate",
  collected_at AS "collectedAt",
  raw
`;

interface SnapshotRow {
  id: string;
  workspaceId: string;
  connectorId: string;
  publishingJobId: string | null;
  provider: SocialAnalyticsProvider;
  externalPostId: string;
  metricDate: unknown;
  views: number | bigint | null;
  impressions: number | bigint | null;
  reach: number | bigint | null;
  likes: number | bigint | null;
  comments: number | bigint | null;
  shares: number | bigint | null;
  saves: number | bigint | null;
  clicks: number | bigint | null;
  watchTimeSeconds: number | bigint | null;
  followersDelta: number | bigint | null;
  engagementRate: number | null;
  collectedAt: Date;
  raw: unknown;
}

function toCount(value: number | bigint | null): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "bigint" ? Number(value) : value;
  return Number.isFinite(num) ? num : null;
}

function rowToSnapshot(row: SnapshotRow): SocialMetricSnapshotRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    connectorId: row.connectorId,
    publishingJobId: row.publishingJobId,
    provider: row.provider,
    externalPostId: row.externalPostId,
    metricDate:
      row.metricDate instanceof Date
        ? row.metricDate.toISOString().slice(0, 10)
        : String(row.metricDate ?? ""),
    views: toCount(row.views),
    impressions: toCount(row.impressions),
    reach: toCount(row.reach),
    likes: toCount(row.likes),
    comments: toCount(row.comments),
    shares: toCount(row.shares),
    saves: toCount(row.saves),
    clicks: toCount(row.clicks),
    watchTimeSeconds: toCount(row.watchTimeSeconds),
    followersDelta: toCount(row.followersDelta),
    engagementRate:
      typeof row.engagementRate === "number" && Number.isFinite(row.engagementRate)
        ? row.engagementRate
        : null,
    collectedAt: row.collectedAt,
    raw: row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
      ? (row.raw as Record<string, unknown>)
      : {},
  };
}

function bigIntOrNull(value: number | null): bigint | null {
  if (value === null) return null;
  return BigInt(Math.trunc(value));
}

/**
 * Idempotent upsert of a daily post-level metric snapshot.
 * The UNIQUE(workspace_id, provider, external_post_id, metric_date) index is
 * the atomic claim point: re-running a sync for the same day replaces the
 * previous snapshot instead of duplicating it.
 */
export async function upsertSocialMetricSnapshot(
  input: UpsertSnapshotInput,
): Promise<SocialMetricSnapshotRecord> {
  const id = randomUUID();
  const now = new Date();
  const rows = await db.$queryRaw<SnapshotRow[]>(Prisma.sql`
    INSERT INTO social_metric_snapshots (
      id, workspace_id, connector_id, publishing_job_id, provider,
      external_post_id, metric_date,
      views, impressions, reach, likes, comments, shares, saves, clicks,
      watch_time_seconds, followers_delta, engagement_rate,
      collected_at, raw, created_at, updated_at
    ) VALUES (
      ${id}, ${input.workspaceId}, ${input.connectorId}, ${input.publishingJobId},
      ${input.provider}, ${input.externalPostId}, ${input.metricDate}::date,
      ${bigIntOrNull(input.metrics.views)}, ${bigIntOrNull(input.metrics.impressions)},
      ${bigIntOrNull(input.metrics.reach)}, ${bigIntOrNull(input.metrics.likes)},
      ${bigIntOrNull(input.metrics.comments)}, ${bigIntOrNull(input.metrics.shares)},
      ${bigIntOrNull(input.metrics.saves)}, ${bigIntOrNull(input.metrics.clicks)},
      ${bigIntOrNull(input.metrics.watchTimeSeconds)},
      ${input.metrics.followersDelta === null ? null : Math.trunc(input.metrics.followersDelta)},
      ${input.engagementRate},
      ${now}, ${JSON.stringify(input.raw)}::jsonb, ${now}, ${now}
    )
    ON CONFLICT (workspace_id, provider, external_post_id, metric_date)
    DO UPDATE SET
      connector_id = EXCLUDED.connector_id,
      publishing_job_id = COALESCE(EXCLUDED.publishing_job_id, social_metric_snapshots.publishing_job_id),
      views = EXCLUDED.views,
      impressions = EXCLUDED.impressions,
      reach = EXCLUDED.reach,
      likes = EXCLUDED.likes,
      comments = EXCLUDED.comments,
      shares = EXCLUDED.shares,
      saves = EXCLUDED.saves,
      clicks = EXCLUDED.clicks,
      watch_time_seconds = EXCLUDED.watch_time_seconds,
      followers_delta = EXCLUDED.followers_delta,
      engagement_rate = EXCLUDED.engagement_rate,
      collected_at = EXCLUDED.collected_at,
      raw = EXCLUDED.raw,
      updated_at = EXCLUDED.updated_at
    RETURNING ${snapshotSelection}
  `);
  const row = rows[0];
  if (!row) {
    throw new Error("SOCIAL_METRIC_SNAPSHOT_UPSERT_EMPTY");
  }
  return rowToSnapshot(row);
}

export async function upsertProviderAccountMetrics(
  input: UpsertAccountMetricsInput,
): Promise<void> {
  const now = new Date();
  await db.$queryRaw(Prisma.sql`
    INSERT INTO provider_account_metrics (
      id, workspace_id, connector_id, provider, metric_date,
      followers, following, posts, impressions, reach, profile_views,
      collected_at, raw, created_at, updated_at
    ) VALUES (
      ${randomUUID()}, ${input.workspaceId}, ${input.connectorId}, ${input.provider},
      ${input.metricDate}::date,
      ${bigIntOrNull(input.metrics.followers)}, ${bigIntOrNull(input.metrics.following)},
      ${bigIntOrNull(input.metrics.posts)}, ${bigIntOrNull(input.metrics.impressions)},
      ${bigIntOrNull(input.metrics.reach)}, ${bigIntOrNull(input.metrics.profileViews)},
      ${now}, ${JSON.stringify(input.raw)}::jsonb, ${now}, ${now}
    )
    ON CONFLICT (workspace_id, connector_id, metric_date)
    DO UPDATE SET
      provider = EXCLUDED.provider,
      followers = EXCLUDED.followers,
      following = EXCLUDED.following,
      posts = EXCLUDED.posts,
      impressions = EXCLUDED.impressions,
      reach = EXCLUDED.reach,
      profile_views = EXCLUDED.profile_views,
      collected_at = EXCLUDED.collected_at,
      raw = EXCLUDED.raw,
      updated_at = EXCLUDED.updated_at
  `);
}

/**
 * Record a sync run outcome. Failures, NOT_SUPPORTED, and API_TIER_REQUIRED
 * outcomes land here so "not yet collected" (no row anywhere) is never
 * confused with 0 (a snapshot with zero-valued fields).
 */
export async function recordSocialMetricSyncRun(
  input: RecordSyncRunInput,
): Promise<void> {
  await db.$queryRaw(Prisma.sql`
    INSERT INTO social_metric_sync_runs (
      id, workspace_id, connector_id, publishing_job_id, provider,
      external_post_id, kind, status, error_code, error_message,
      provider_status_code, ran_at, created_at
    ) VALUES (
      ${randomUUID()}, ${input.workspaceId}, ${input.connectorId},
      ${input.publishingJobId}, ${input.provider}, ${input.externalPostId},
      ${input.kind}, ${input.status}, ${input.errorCode}, ${input.errorMessage},
      ${input.providerStatusCode}, ${new Date()}, ${new Date()}
    )
  `);
}

export interface ListSnapshotsFilter {
  workspaceId: string;
  provider?: SocialAnalyticsProvider;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  publishingJobId?: string;
  limit?: number;
}

export async function listSocialMetricSnapshots(
  filter: ListSnapshotsFilter,
): Promise<SocialMetricSnapshotRecord[]> {
  const limit = Math.min(Math.max(filter.limit ?? 500, 1), 2000);
  const rows = await db.$queryRaw<SnapshotRow[]>(Prisma.sql`
    SELECT ${snapshotSelection}
    FROM social_metric_snapshots
    WHERE workspace_id = ${filter.workspaceId}
      AND (${filter.provider ?? null}::text IS NULL OR provider = ${filter.provider ?? null}::text)
      AND (${filter.from ?? null}::date IS NULL OR metric_date >= ${filter.from ?? null}::date)
      AND (${filter.to ?? null}::date IS NULL OR metric_date <= ${filter.to ?? null}::date)
      AND (${filter.publishingJobId ?? null}::text IS NULL OR publishing_job_id = ${filter.publishingJobId ?? null}::text)
    ORDER BY metric_date ASC, collected_at ASC
    LIMIT ${limit}
  `);
  return rows.map(rowToSnapshot);
}

/**
 * Recently published jobs eligible for metrics collection.
 * Join key to provider metrics is the publishing job's external_post_id.
 */
export async function listPublishedJobsForMetrics(options: {
  lookbackDays: number;
  limit: number;
}): Promise<PublishedJobForMetrics[]> {
  const cutoff = new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000);
  const limit = Math.min(Math.max(options.limit, 1), 200);
  const rows = await db.$queryRaw<PublishedJobForMetrics[]>(Prisma.sql`
    SELECT
      id,
      workspace_id AS "workspaceId",
      connector_id AS "connectorId",
      provider,
      content_type AS "contentType",
      external_post_id AS "externalPostId",
      completed_at AS "completedAt"
    FROM social_publishing_jobs
    WHERE state = 'PUBLISHED'
      AND external_post_id IS NOT NULL
      AND completed_at IS NOT NULL
      AND completed_at >= ${cutoff}
    ORDER BY completed_at ASC
    LIMIT ${limit}
  `);
  return rows;
}

/** Distinct connectors with recently published jobs, for account metrics. */
export async function listConnectorsForAccountMetrics(options: {
  workspaceId: string;
  provider: SocialAnalyticsProvider;
}): Promise<Array<{ connectorId: string; workspaceId: string; provider: SocialAnalyticsProvider }>> {
  const rows = await db.$queryRaw<
    Array<{ connectorId: string; workspaceId: string; provider: SocialAnalyticsProvider }>
  >(Prisma.sql`
    SELECT DISTINCT
      connector_id AS "connectorId",
      workspace_id AS "workspaceId",
      provider
    FROM social_publishing_jobs
    WHERE workspace_id = ${options.workspaceId}
      AND provider = ${options.provider}
      AND state = 'PUBLISHED'
  `);
  return rows;
}
