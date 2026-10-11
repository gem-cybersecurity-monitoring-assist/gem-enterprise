import type { SharedSocialPublishingProvider } from "@/lib/social-media/publishing/types";
import type { SocialContentType } from "@/lib/social-media/policy";

export type SocialAnalyticsProvider = SharedSocialPublishingProvider;

/**
 * Collection outcome for a single metrics fetch attempt.
 * - COLLECTED: provider returned metric values (possibly partial; fields the
 *   provider does not expose are null, never invented).
 * - NOT_SUPPORTED: the provider exposes no usable API for this metric kind.
 * - API_TIER_REQUIRED: the provider requires a higher API tier/permission than
 *   the connected authorization grants.
 * - FAILED: the provider call failed; the failure is recorded in
 *   social_metric_sync_runs. Never zero-fill silently.
 */
export type MetricCollectionStatus =
  | "COLLECTED"
  | "NOT_SUPPORTED"
  | "API_TIER_REQUIRED"
  | "FAILED";

export interface PostMetricValues {
  views: number | null;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  watchTimeSeconds: number | null;
  followersDelta: number | null;
}

export interface AccountMetricValues {
  followers: number | null;
  following: number | null;
  posts: number | null;
  impressions: number | null;
  reach: number | null;
  profileViews: number | null;
}

export interface FetchedPostMetrics {
  status: MetricCollectionStatus;
  metrics: PostMetricValues | null;
  engagementRate: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  providerStatusCode: number | null;
  /** Sanitized provider payload: whitelisted metric fields only, no secrets. */
  raw: Record<string, unknown>;
}

export interface FetchedAccountMetrics {
  status: MetricCollectionStatus;
  metrics: AccountMetricValues | null;
  errorCode: string | null;
  errorMessage: string | null;
  providerStatusCode: number | null;
  raw: Record<string, unknown>;
}

/** Minimal injectable HTTP surface so fetchers stay pure and testable. */
export interface AnalyticsHttpResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface AnalyticsHttpClient {
  get(url: string, init?: { headers?: Record<string, string> }): Promise<AnalyticsHttpResponse>;
}

export interface MetricFetchContext {
  http: AnalyticsHttpClient;
  accessToken: string;
  /** Provider post identifier (post id, media id, tweet id, video id). */
  externalPostId: string;
  /** Provider account identifier (page id, IG user id, org urn, channel id). */
  externalAccountId: string | null;
}

export interface AccountMetricFetchContext {
  http: AnalyticsHttpClient;
  accessToken: string;
  externalAccountId: string | null;
  connectorMetadata: Record<string, unknown>;
}

export interface SocialMetricSnapshotRecord {
  id: string;
  workspaceId: string;
  connectorId: string;
  publishingJobId: string | null;
  provider: SocialAnalyticsProvider;
  externalPostId: string;
  metricDate: string;
  views: number | null;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  watchTimeSeconds: number | null;
  followersDelta: number | null;
  engagementRate: number | null;
  collectedAt: Date;
  raw: Record<string, unknown>;
}

export interface PublishedJobForMetrics {
  id: string;
  workspaceId: string;
  connectorId: string;
  provider: SocialAnalyticsProvider;
  contentType: string;
  externalPostId: string;
  completedAt: Date | null;
}

export interface PerformanceObservation {
  provider: SocialAnalyticsProvider;
  /** Content format, e.g. SHORT_VIDEO / TEXT / LINK (see socialContentTypes). */
  format: string;
  /** 0-23 hour of day (UTC) the post was published. */
  hourOfDay: number;
  engagementRate: number | null;
  impressions: number | null;
  views: number | null;
}

export type { SocialContentType };
