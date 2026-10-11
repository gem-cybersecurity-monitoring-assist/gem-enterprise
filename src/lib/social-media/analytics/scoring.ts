import { listSocialMetricSnapshots } from "./store";
import type {
  PerformanceObservation,
  SocialAnalyticsProvider,
} from "./types";

/**
 * WS-C learning loop interface for WS-E (orchestrator / scheduler).
 *
 * The orchestrator calls getPerformanceWeights({ workspaceId }) and biases
 * topic/format/time selection by multiplying candidate scores with
 * weightForKey(weights, key). When no data exists the loop degrades to
 * neutral weights (1.0 everywhere, coldStart: true) instead of faking
 * confidence.
 *
 * Key format: `${provider}::${format}::${hourBucket}`
 *   - provider: e.g. "INSTAGRAM_PROFESSIONAL"
 *   - format: content type, e.g. "SHORT_VIDEO" (see socialContentTypes)
 *   - hourBucket: "h0-5" | "h6-11" | "h12-17" | "h18-23" (UTC publish hour)
 */

export type HourBucket = "h0-5" | "h6-11" | "h12-17" | "h18-23";

export const MIN_SAMPLES_FOR_WEIGHT = 3;
export const CONFIDENCE_FULL_SAMPLES = 10;
export const MIN_WEIGHT = 0.5;
export const MAX_WEIGHT = 2.0;

export function weightKey(
  provider: SocialAnalyticsProvider,
  format: string,
  hourBucket: HourBucket,
): string {
  return `${provider}::${format}::${hourBucket}`;
}

export function hourBucketFor(hourOfDay: number): HourBucket {
  const hour = ((Math.floor(hourOfDay) % 24) + 24) % 24;
  if (hour < 6) return "h0-5";
  if (hour < 12) return "h6-11";
  if (hour < 18) return "h12-17";
  return "h18-23";
}

export interface PerformanceWeights {
  /** Bucket key -> multiplicative weight. Missing key means neutral (1.0). */
  weights: Record<string, number>;
  /** Bucket key -> confidence in [0, 1] from sample size. */
  confidence: Record<string, number>;
  /** Distinct post-metric observations consumed. */
  sampleCount: number;
  /** True when there is no usable engagement data: all weights are neutral. */
  coldStart: boolean;
}

export function neutralPerformanceWeights(): PerformanceWeights {
  return { weights: {}, confidence: {}, sampleCount: 0, coldStart: true };
}

/**
 * Pure scoring function. Bucket engagement rates are compared to the global
 * mean engagement rate across all observations; weights are clamped so a
 * small sample can nudge but never dominate selection.
 */
export function computePerformanceWeights(
  observations: PerformanceObservation[],
): PerformanceWeights {
  const usable = observations.filter(
    (observation) =>
      observation.engagementRate !== null &&
      Number.isFinite(observation.engagementRate) &&
      observation.engagementRate >= 0,
  );
  if (usable.length === 0) {
    return neutralPerformanceWeights();
  }
  const globalMean =
    usable.reduce((sum, observation) => sum + (observation.engagementRate ?? 0), 0) /
    usable.length;
  if (globalMean <= 0) {
    // Engagement data exists but is uniformly zero: nothing learned.
    return { weights: {}, confidence: {}, sampleCount: usable.length, coldStart: true };
  }
  const buckets = new Map<string, number[]>();
  for (const observation of usable) {
    const key = weightKey(observation.provider, observation.format, hourBucketFor(observation.hourOfDay));
    const list = buckets.get(key) ?? [];
    list.push(observation.engagementRate ?? 0);
    buckets.set(key, list);
  }
  const weights: Record<string, number> = {};
  const confidence: Record<string, number> = {};
  for (const [key, values] of buckets) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const raw = mean / globalMean;
    const clamped = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, raw));
    // Shrink toward neutral for small samples so weak evidence barely moves selection.
    const shrink = Math.min(1, values.length / MIN_SAMPLES_FOR_WEIGHT);
    weights[key] = values.length >= MIN_SAMPLES_FOR_WEIGHT ? clamped : 1 + (clamped - 1) * shrink;
    confidence[key] = Math.min(1, values.length / CONFIDENCE_FULL_SAMPLES);
  }
  return { weights, confidence, sampleCount: usable.length, coldStart: false };
}

/** Orchestrator helper: multiplicative weight for a candidate, neutral by default. */
export function weightForKey(weights: PerformanceWeights, key: string): number {
  const value = weights.weights[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 1.0;
}

export async function getPerformanceWeights(options: {
  workspaceId: string;
  provider?: SocialAnalyticsProvider;
  lookbackDays?: number;
}): Promise<PerformanceWeights> {
  const lookbackDays = Math.min(Math.max(options.lookbackDays ?? 90, 1), 365);
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const snapshots = await listSocialMetricSnapshots({
    workspaceId: options.workspaceId,
    provider: options.provider,
    from,
    to,
    limit: 2000,
  });
  // De-duplicate to one observation per post (latest snapshot), joined with
  // format/hour metadata where the publishing job is known.
  const latestByPost = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.provider}::${snapshot.externalPostId}`;
    const existing = latestByPost.get(key);
    if (!existing || existing.collectedAt < snapshot.collectedAt) {
      latestByPost.set(key, snapshot);
    }
  }
  const observations: PerformanceObservation[] = [];
  for (const snapshot of latestByPost.values()) {
    // Format and publish hour are enriched from the publishing job where
    // available; unknown dimensions fall back to a provider-wide bucket.
    const format = (snapshot.raw as Record<string, unknown>).contentType;
    const hour = (snapshot.raw as Record<string, unknown>).publishedHourUtc;
    observations.push({
      provider: snapshot.provider,
      format: typeof format === "string" && format ? format : "UNKNOWN",
      hourOfDay: typeof hour === "number" && Number.isFinite(hour) ? hour : 12,
      engagementRate: snapshot.engagementRate,
      impressions: snapshot.impressions,
      views: snapshot.views,
    });
  }
  return computePerformanceWeights(observations);
}
