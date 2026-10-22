import type {
  AccountMetricFetchContext,
  AccountMetricValues,
  AnalyticsHttpClient,
  AnalyticsHttpResponse,
  FetchedAccountMetrics,
  FetchedPostMetrics,
  MetricCollectionStatus,
  MetricFetchContext,
  PostMetricValues,
  SocialAnalyticsProvider,
} from "./types";

export const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";
export const X_API_BASE = "https://api.x.com/2";
export const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
export const YOUTUBE_ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2";
export const YOUTUBE_DATA_BASE = "https://www.googleapis.com/youtube/v3";

/** Per-provider collection capabilities for post-level metrics. */
export const POST_METRICS_CAPABILITY: Record<
  SocialAnalyticsProvider,
  MetricCollectionStatus
> = {
  FACEBOOK_PAGE: "COLLECTED",
  INSTAGRAM_PROFESSIONAL: "COLLECTED",
  X: "COLLECTED",
  LINKEDIN_COMPANY: "API_TIER_REQUIRED",
  YOUTUBE: "COLLECTED",
  NEXTDOOR: "NOT_SUPPORTED",
  TELEGRAM: "NOT_SUPPORTED",
};

/** Per-provider collection capabilities for account-level metrics. */
export const ACCOUNT_METRICS_CAPABILITY: Record<
  SocialAnalyticsProvider,
  MetricCollectionStatus
> = {
  FACEBOOK_PAGE: "COLLECTED",
  INSTAGRAM_PROFESSIONAL: "COLLECTED",
  X: "COLLECTED",
  LINKEDIN_COMPANY: "API_TIER_REQUIRED",
  YOUTUBE: "COLLECTED",
  NEXTDOOR: "NOT_SUPPORTED",
  TELEGRAM: "NOT_SUPPORTED",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Coerce provider values to non-negative finite numbers; invalid -> null. */
export function toMetricNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

const SECRET_KEY_PATTERN = /token|secret|password|authorization|api[_-]?key|client[_-]?secret|session/i;

/**
 * Keep only safe, known metric fields from a provider payload.
 * Anything unrecognized is dropped rather than stored.
 */
export function sanitizeProviderPayload(
  provider: SocialAnalyticsProvider,
  payload: unknown,
): Record<string, unknown> {
  const source = record(payload);
  const allowed: Record<SocialAnalyticsProvider, Set<string>> = {
    FACEBOOK_PAGE: new Set([
      "impressions",
      "reach",
      "clicks",
      "engaged_users",
      "likes",
      "comments",
      "shares",
      "reactions",
      "metric_date",
    ]),
    INSTAGRAM_PROFESSIONAL: new Set([
      "impressions",
      "reach",
      "likes",
      "comments",
      "shares",
      "saves",
      "video_views",
      "profile_visits",
      "metric_date",
    ]),
    X: new Set([
      "impression_count",
      "like_count",
      "reply_count",
      "repost_count",
      "quote_count",
      "bookmark_count",
      "view_count",
    ]),
    LINKEDIN_COMPANY: new Set(["likes", "comments", "impressions", "clicks"]),
    YOUTUBE: new Set([
      "views",
      "likes",
      "comments",
      "shares",
      "estimatedMinutesWatched",
      "averageViewDuration",
      "subscribersGained",
      "subscribersLost",
    ]),
    NEXTDOOR: new Set([]),
    TELEGRAM: new Set([]),
  };
  const keep = allowed[provider];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (!keep.has(key)) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

function emptyPostMetrics(): PostMetricValues {
  return {
    views: null,
    impressions: null,
    reach: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    clicks: null,
    watchTimeSeconds: null,
    followersDelta: null,
  };
}

function emptyAccountMetrics(): AccountMetricValues {
  return {
    followers: null,
    following: null,
    posts: null,
    impressions: null,
    reach: null,
    profileViews: null,
  };
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function readJson(response: AnalyticsHttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function providerError(
  provider: SocialAnalyticsProvider,
  status: number,
  body: unknown,
  fallbackCode: string,
): { code: string; message: string } {
  const data = record(body);
  const nested = record(data.error);
  const message =
    typeof nested.message === "string" && nested.message.trim()
      ? nested.message.trim()
      : typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : `${provider} metrics request failed with status ${status}.`;
  return { code: fallbackCode, message };
}

/**
 * Deterministic engagement rate from provider-returned values only.
 * engagement = likes + comments + shares + saves + clicks (fields present).
 * base = impressions ?? reach ?? views. Returns null when either side is
 * unknown — never invented.
 */
export function computeEngagementRate(metrics: PostMetricValues): number | null {
  let engagements = 0;
  let hasEngagements = false;
  for (const field of ["likes", "comments", "shares", "saves", "clicks"] as const) {
    const value = metrics[field];
    if (value !== null) {
      engagements += value;
      hasEngagements = true;
    }
  }
  const base = metrics.impressions ?? metrics.reach ?? metrics.views;
  if (!hasEngagements || base === null || base <= 0) return null;
  return engagements / base;
}

function collectedPost(
  provider: SocialAnalyticsProvider,
  metrics: PostMetricValues,
  rawPayload: unknown,
): FetchedPostMetrics {
  const raw = sanitizeProviderPayload(provider, rawPayload);
  return {
    status: "COLLECTED",
    metrics,
    engagementRate: computeEngagementRate(metrics),
    errorCode: null,
    errorMessage: null,
    providerStatusCode: 200,
    raw,
  };
}

function postOutcome(
  status: Exclude<MetricCollectionStatus, "COLLECTED">,
  code: string,
  message: string,
  providerStatusCode: number | null = null,
): FetchedPostMetrics {
  return {
    status,
    metrics: null,
    engagementRate: null,
    errorCode: code,
    errorMessage: message,
    providerStatusCode,
    raw: {},
  };
}

function accountOutcome(
  status: Exclude<MetricCollectionStatus, "COLLECTED">,
  code: string,
  message: string,
  providerStatusCode: number | null = null,
): FetchedAccountMetrics {
  return {
    status,
    metrics: null,
    errorCode: code,
    errorMessage: message,
    providerStatusCode,
    raw: {},
  };
}

function collectedAccount(
  provider: SocialAnalyticsProvider,
  metrics: AccountMetricValues,
  rawPayload: unknown,
): FetchedAccountMetrics {
  return {
    status: "COLLECTED",
    metrics,
    errorCode: null,
    errorMessage: null,
    providerStatusCode: 200,
    raw: sanitizeProviderPayload(provider, rawPayload),
  };
}

/* ------------------------------------------------------------------ */
/* Meta (Facebook Page)                                                */
/* ------------------------------------------------------------------ */

export async function fetchMetaPostMetrics(
  ctx: MetricFetchContext,
): Promise<FetchedPostMetrics> {
  const url =
    `${META_GRAPH_BASE}/${encodeURIComponent(ctx.externalPostId)}` +
    `?fields=likes.summary(true),comments.summary(true),shares,` +
    `insights.metric(post_impressions,post_impressions_unique,post_clicks,post_engaged_users)` +
    `&access_token=${encodeURIComponent(ctx.accessToken)}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return postOutcome("FAILED", "META_METRICS_TRANSPORT_ERROR", error instanceof Error ? error.message : "Meta metrics request failed.");
  }
  const body = await readJson(response);
  if (response.status !== 200) {
    const { code, message } = providerError("FACEBOOK_PAGE", response.status, body, "META_METRICS_REQUEST_FAILED");
    return postOutcome("FAILED", code, message, response.status);
  }
  const data = record(body);
  const metrics = emptyPostMetrics();
  metrics.likes = toMetricNumber(record(record(data.likes).summary).total_count);
  metrics.comments = toMetricNumber(record(record(data.comments).summary).total_count);
  metrics.shares = toMetricNumber(record(data.shares).count);
  const insights = record(data.insights);
  const insightRows = Array.isArray(insights.data) ? insights.data : [];
  const latestValue = (name: string): unknown => {
    const row = insightRows.find((entry) => record(entry).name === name);
    const values = record(row).values;
    if (!Array.isArray(values) || values.length === 0) return null;
    return record(values[values.length - 1]).value;
  };
  metrics.impressions = toMetricNumber(latestValue("post_impressions"));
  metrics.reach = toMetricNumber(latestValue("post_impressions_unique"));
  metrics.clicks = toMetricNumber(latestValue("post_clicks"));
  return collectedPost("FACEBOOK_PAGE", metrics, {
    impressions: metrics.impressions,
    reach: metrics.reach,
    clicks: metrics.clicks,
    engaged_users: toMetricNumber(latestValue("post_engaged_users")),
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
  });
}

export async function fetchMetaAccountMetrics(
  ctx: AccountMetricFetchContext,
): Promise<FetchedAccountMetrics> {
  if (!ctx.externalAccountId) {
    return accountOutcome("FAILED", "META_ACCOUNT_ID_MISSING", "No Meta page account id is attached to this connector.");
  }
  const url =
    `${META_GRAPH_BASE}/${encodeURIComponent(ctx.externalAccountId)}` +
    `?fields=followers_count,fan_count&access_token=${encodeURIComponent(ctx.accessToken)}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return accountOutcome("FAILED", "META_ACCOUNT_TRANSPORT_ERROR", error instanceof Error ? error.message : "Meta account request failed.");
  }
  const body = await readJson(response);
  if (response.status !== 200) {
    const { code, message } = providerError("FACEBOOK_PAGE", response.status, body, "META_ACCOUNT_REQUEST_FAILED");
    return accountOutcome("FAILED", code, message, response.status);
  }
  const data = record(body);
  const metrics = emptyAccountMetrics();
  metrics.followers = toMetricNumber(data.followers_count ?? data.fan_count);
  return collectedAccount("FACEBOOK_PAGE", metrics, { followers: metrics.followers });
}

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */

export async function fetchInstagramPostMetrics(
  ctx: MetricFetchContext,
): Promise<FetchedPostMetrics> {
  const url =
    `${META_GRAPH_BASE}/${encodeURIComponent(ctx.externalPostId)}/insights` +
    `?metric=impressions,reach,likes,comments,shares,saves,video_views,profile_visits` +
    `&access_token=${encodeURIComponent(ctx.accessToken)}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return postOutcome("FAILED", "INSTAGRAM_METRICS_TRANSPORT_ERROR", error instanceof Error ? error.message : "Instagram metrics request failed.");
  }
  const body = await readJson(response);
  if (response.status !== 200) {
    const { code, message } = providerError("INSTAGRAM_PROFESSIONAL", response.status, body, "INSTAGRAM_METRICS_REQUEST_FAILED");
    return postOutcome("FAILED", code, message, response.status);
  }
  const rows = Array.isArray(record(body).data) ? (record(body).data as unknown[]) : [];
  const latestValue = (name: string): unknown => {
    const row = rows.find((entry) => record(entry).name === name);
    const values = record(row).values;
    if (!Array.isArray(values) || values.length === 0) return null;
    return record(values[values.length - 1]).value;
  };
  const metrics = emptyPostMetrics();
  metrics.impressions = toMetricNumber(latestValue("impressions"));
  metrics.reach = toMetricNumber(latestValue("reach"));
  metrics.likes = toMetricNumber(latestValue("likes"));
  metrics.comments = toMetricNumber(latestValue("comments"));
  metrics.shares = toMetricNumber(latestValue("shares"));
  metrics.saves = toMetricNumber(latestValue("saves"));
  metrics.views = toMetricNumber(latestValue("video_views"));
  return collectedPost("INSTAGRAM_PROFESSIONAL", metrics, {
    impressions: metrics.impressions,
    reach: metrics.reach,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    video_views: metrics.views,
    profile_visits: toMetricNumber(latestValue("profile_visits")),
  });
}

export async function fetchInstagramAccountMetrics(
  ctx: AccountMetricFetchContext,
): Promise<FetchedAccountMetrics> {
  if (!ctx.externalAccountId) {
    return accountOutcome("FAILED", "INSTAGRAM_ACCOUNT_ID_MISSING", "No Instagram professional account id is attached to this connector.");
  }
  const url =
    `${META_GRAPH_BASE}/${encodeURIComponent(ctx.externalAccountId)}` +
    `?fields=followers_count,follows_count,media_count&access_token=${encodeURIComponent(ctx.accessToken)}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return accountOutcome("FAILED", "INSTAGRAM_ACCOUNT_TRANSPORT_ERROR", error instanceof Error ? error.message : "Instagram account request failed.");
  }
  const body = await readJson(response);
  if (response.status !== 200) {
    const { code, message } = providerError("INSTAGRAM_PROFESSIONAL", response.status, body, "INSTAGRAM_ACCOUNT_REQUEST_FAILED");
    return accountOutcome("FAILED", code, message, response.status);
  }
  const data = record(body);
  const metrics = emptyAccountMetrics();
  metrics.followers = toMetricNumber(data.followers_count);
  metrics.following = toMetricNumber(data.follows_count);
  metrics.posts = toMetricNumber(data.media_count);
  return collectedAccount("INSTAGRAM_PROFESSIONAL", metrics, {
    followers: metrics.followers,
    following: metrics.following,
    posts: metrics.posts,
  });
}

/* ------------------------------------------------------------------ */
/* X                                                                   */
/* ------------------------------------------------------------------ */

export async function fetchXTweetMetrics(
  ctx: MetricFetchContext,
): Promise<FetchedPostMetrics> {
  const url =
    `${X_API_BASE}/tweets/${encodeURIComponent(ctx.externalPostId)}` +
    `?tweet.fields=public_metrics`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return postOutcome("FAILED", "X_METRICS_TRANSPORT_ERROR", error instanceof Error ? error.message : "X metrics request failed.");
  }
  const body = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    const { code, message } = providerError("X", response.status, body, "X_METRICS_TIER_REQUIRED");
    return postOutcome("API_TIER_REQUIRED", code, `X metrics need an elevated API tier or scope: ${message}`, response.status);
  }
  if (response.status !== 200) {
    const { code, message } = providerError("X", response.status, body, "X_METRICS_REQUEST_FAILED");
    return postOutcome("FAILED", code, message, response.status);
  }
  const pm = record(record(body).data).public_metrics;
  const publicMetrics = record(pm);
  const metrics = emptyPostMetrics();
  metrics.impressions = toMetricNumber(publicMetrics.impression_count);
  metrics.views = toMetricNumber(publicMetrics.impression_count);
  metrics.likes = toMetricNumber(publicMetrics.like_count);
  metrics.comments = toMetricNumber(publicMetrics.reply_count);
  metrics.shares = toMetricNumber(
    publicMetrics.repost_count !== null && publicMetrics.quote_count !== null
      ? Number(publicMetrics.repost_count) + Number(publicMetrics.quote_count)
      : (publicMetrics.repost_count ?? publicMetrics.quote_count),
  );
  return collectedPost("X", metrics, {
    impression_count: metrics.impressions,
    like_count: metrics.likes,
    reply_count: metrics.comments,
    repost_count: publicMetrics.repost_count,
    quote_count: publicMetrics.quote_count,
    bookmark_count: publicMetrics.bookmark_count,
  });
}

export async function fetchXAccountMetrics(
  ctx: AccountMetricFetchContext,
): Promise<FetchedAccountMetrics> {
  const url = `${X_API_BASE}/users/me?user.fields=public_metrics`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return accountOutcome("FAILED", "X_ACCOUNT_TRANSPORT_ERROR", error instanceof Error ? error.message : "X account request failed.");
  }
  const body = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    const { code, message } = providerError("X", response.status, body, "X_ACCOUNT_TIER_REQUIRED");
    return accountOutcome("API_TIER_REQUIRED", code, `X account metrics need an elevated API tier or scope: ${message}`, response.status);
  }
  if (response.status !== 200) {
    const { code, message } = providerError("X", response.status, body, "X_ACCOUNT_REQUEST_FAILED");
    return accountOutcome("FAILED", code, message, response.status);
  }
  const pm = record(record(record(body).data).public_metrics);
  const metrics = emptyAccountMetrics();
  metrics.followers = toMetricNumber(pm.followers_count);
  metrics.following = toMetricNumber(pm.following_count);
  metrics.posts = toMetricNumber(pm.tweet_count);
  return collectedAccount("X", metrics, {
    followers: metrics.followers,
    following: metrics.following,
    posts: metrics.posts,
  });
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */

export async function fetchLinkedInPostMetrics(
  ctx: MetricFetchContext,
): Promise<FetchedPostMetrics> {
  // Per-post UGC statistics require restricted LinkedIn permissions
  // (r_organization_social / partner approval). We attempt the socialActions
  // summary first and report the tier honestly instead of inventing numbers.
  if (!ctx.externalAccountId) {
    return postOutcome(
      "API_TIER_REQUIRED",
      "LINKEDIN_POST_STATS_RESTRICTED",
      "LinkedIn per-post statistics require restricted partner permissions that are not part of the standard OAuth authorization.",
    );
  }
  const urn = `urn:li:ugcPost:${ctx.externalPostId}`;
  const url = `${LINKEDIN_API_BASE}/socialActions/${encodeURIComponent(urn)}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return postOutcome("FAILED", "LINKEDIN_METRICS_TRANSPORT_ERROR", error instanceof Error ? error.message : "LinkedIn metrics request failed.");
  }
  const body = await readJson(response);
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    const { code, message } = providerError("LINKEDIN_COMPANY", response.status, body, "LINKEDIN_POST_STATS_RESTRICTED");
    return postOutcome("API_TIER_REQUIRED", code, `LinkedIn per-post statistics are not available on this authorization: ${message}`, response.status);
  }
  if (response.status !== 200) {
    const { code, message } = providerError("LINKEDIN_COMPANY", response.status, body, "LINKEDIN_METRICS_REQUEST_FAILED");
    return postOutcome("FAILED", code, message, response.status);
  }
  const data = record(body);
  const metrics = emptyPostMetrics();
  metrics.likes = toMetricNumber(record(data.likesSummary).totalLikes);
  metrics.comments = toMetricNumber(record(data.commentsSummary).totalFirstLevelComments);
  return collectedPost("LINKEDIN_COMPANY", metrics, {
    likes: metrics.likes,
    comments: metrics.comments,
  });
}

export async function fetchLinkedInAccountMetrics(
  ctx: AccountMetricFetchContext,
): Promise<FetchedAccountMetrics> {
  return accountOutcome(
    "API_TIER_REQUIRED",
    "LINKEDIN_ACCOUNT_STATS_RESTRICTED",
    "LinkedIn organization follower and page statistics require restricted partner permissions that are not part of the standard OAuth authorization.",
  );
}

/* ------------------------------------------------------------------ */
/* YouTube                                                             */
/* ------------------------------------------------------------------ */

function youtubeAnalyticsDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export async function fetchYouTubeVideoMetrics(
  ctx: MetricFetchContext,
): Promise<FetchedPostMetrics> {
  const { startDate, endDate } = youtubeAnalyticsDateRange();
  const params = new URLSearchParams({
    ids: "channel==MINE",
    metrics: "views,likes,comments,shares,estimatedMinutesWatched,subscribersGained,subscribersLost",
    filters: `video==${ctx.externalPostId}`,
    startDate,
    endDate,
  });
  const url = `${YOUTUBE_ANALYTICS_BASE}/reports?${params.toString()}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return postOutcome("FAILED", "YOUTUBE_METRICS_TRANSPORT_ERROR", error instanceof Error ? error.message : "YouTube metrics request failed.");
  }
  const body = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    const { code, message } = providerError("YOUTUBE", response.status, body, "YOUTUBE_ANALYTICS_AUTH_REQUIRED");
    return postOutcome(
      "API_TIER_REQUIRED",
      code,
      `YouTube Analytics requires the youtubeAnalytics.readonly scope and channel authorization: ${message}`,
      response.status,
    );
  }
  if (response.status !== 200) {
    const { code, message } = providerError("YOUTUBE", response.status, body, "YOUTUBE_METRICS_REQUEST_FAILED");
    return postOutcome("FAILED", code, message, response.status);
  }
  const rows = record(body).rows;
  const values = Array.isArray(rows) && rows.length > 0 ? (rows[0] as unknown[]) : null;
  const headers = Array.isArray(record(body).columnHeaders)
    ? ((record(body).columnHeaders as unknown[]).map((entry) => record(entry).name as string))
    : [];
  const byName = (name: string): unknown => {
    if (!values) return null;
    const index = headers.indexOf(name);
    return index >= 0 ? values[index] : null;
  };
  const metrics = emptyPostMetrics();
  metrics.views = toMetricNumber(byName("views"));
  metrics.likes = toMetricNumber(byName("likes"));
  metrics.comments = toMetricNumber(byName("comments"));
  metrics.shares = toMetricNumber(byName("shares"));
  const minutes = toMetricNumber(byName("estimatedMinutesWatched"));
  metrics.watchTimeSeconds = minutes === null ? null : minutes * 60;
  const gained = toMetricNumber(byName("subscribersGained"));
  const lost = toMetricNumber(byName("subscribersLost"));
  metrics.followersDelta = gained === null || lost === null ? null : gained - lost;
  return collectedPost("YOUTUBE", metrics, {
    views: metrics.views,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    estimatedMinutesWatched: minutes,
    subscribersGained: gained,
    subscribersLost: lost,
  });
}

export async function fetchYouTubeAccountMetrics(
  ctx: AccountMetricFetchContext,
): Promise<FetchedAccountMetrics> {
  if (!ctx.externalAccountId) {
    return accountOutcome("FAILED", "YOUTUBE_CHANNEL_ID_MISSING", "No YouTube channel id is attached to this connector.");
  }
  const params = new URLSearchParams({
    part: "statistics",
    id: ctx.externalAccountId,
  });
  const url = `${YOUTUBE_DATA_BASE}/channels?${params.toString()}`;
  let response: AnalyticsHttpResponse;
  try {
    response = await ctx.http.get(url, { headers: bearer(ctx.accessToken) });
  } catch (error) {
    return accountOutcome("FAILED", "YOUTUBE_ACCOUNT_TRANSPORT_ERROR", error instanceof Error ? error.message : "YouTube channel request failed.");
  }
  const body = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    const { code, message } = providerError("YOUTUBE", response.status, body, "YOUTUBE_DATA_AUTH_REQUIRED");
    return accountOutcome("API_TIER_REQUIRED", code, `YouTube channel statistics need channel authorization: ${message}`, response.status);
  }
  if (response.status !== 200) {
    const { code, message } = providerError("YOUTUBE", response.status, body, "YOUTUBE_ACCOUNT_REQUEST_FAILED");
    return accountOutcome("FAILED", code, message, response.status);
  }
  const items = record(body).items;
  const stats = record(Array.isArray(items) && items.length > 0 ? record(items[0]).statistics : null);
  const metrics = emptyAccountMetrics();
  metrics.followers = toMetricNumber(stats.subscriberCount);
  metrics.posts = toMetricNumber(stats.videoCount);
  return collectedAccount("YOUTUBE", metrics, {
    followers: metrics.followers,
    posts: metrics.posts,
  });
}

/* ------------------------------------------------------------------ */
/* Nextdoor / TikTok — no usable post-metrics API                      */
/* ------------------------------------------------------------------ */

export async function fetchNextdoorPostMetrics(): Promise<FetchedPostMetrics> {
  return postOutcome(
    "NOT_SUPPORTED",
    "NEXTDOOR_METRICS_NOT_SUPPORTED",
    "Nextdoor exposes no post-level metrics API for connected business accounts.",
  );
}

export async function fetchNextdoorAccountMetrics(): Promise<FetchedAccountMetrics> {
  return accountOutcome(
    "NOT_SUPPORTED",
    "NEXTDOOR_ACCOUNT_METRICS_NOT_SUPPORTED",
    "Nextdoor exposes no account metrics API for connected business accounts.",
  );
}

/* ------------------------------------------------------------------ */
/* Dispatchers                                                         */
/* ------------------------------------------------------------------ */

export function fetchPostMetrics(
  provider: SocialAnalyticsProvider,
  ctx: MetricFetchContext,
): Promise<FetchedPostMetrics> {
  switch (provider) {
    case "FACEBOOK_PAGE":
      return fetchMetaPostMetrics(ctx);
    case "INSTAGRAM_PROFESSIONAL":
      return fetchInstagramPostMetrics(ctx);
    case "X":
      return fetchXTweetMetrics(ctx);
    case "LINKEDIN_COMPANY":
      return fetchLinkedInPostMetrics(ctx);
    case "YOUTUBE":
      return fetchYouTubeVideoMetrics(ctx);
    case "NEXTDOOR":
      return fetchNextdoorPostMetrics();
  }
}

export function fetchAccountMetrics(
  provider: SocialAnalyticsProvider,
  ctx: AccountMetricFetchContext,
): Promise<FetchedAccountMetrics> {
  switch (provider) {
    case "FACEBOOK_PAGE":
      return fetchMetaAccountMetrics(ctx);
    case "INSTAGRAM_PROFESSIONAL":
      return fetchInstagramAccountMetrics(ctx);
    case "X":
      return fetchXAccountMetrics(ctx);
    case "LINKEDIN_COMPANY":
      return fetchLinkedInAccountMetrics(ctx);
    case "YOUTUBE":
      return fetchYouTubeAccountMetrics(ctx);
    case "NEXTDOOR":
      return fetchNextdoorAccountMetrics();
  }
}

/**
 * Build a real AnalyticsHttpClient backed by the global fetch.
 * Only used server-side inside the sync worker.
 */
export function createAnalyticsHttpClient(): AnalyticsHttpClient {
  return {
    async get(url, init) {
      const response = await fetch(url, { headers: init?.headers });
      return {
        status: response.status,
        async json() {
          return response.json();
        },
      };
    },
  };
}
