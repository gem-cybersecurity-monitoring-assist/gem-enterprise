import {
  getPerformanceWeights,
  hourBucketFor,
  weightForKey,
  weightKey,
  type PerformanceWeights,
} from "../analytics/scoring";
import type { SharedSocialPublishingProvider } from "../publishing/types";
import type { SocialContentType } from "../policy";
import { applyEngagementLearning } from "../orchestration/intelligence";
import type { MarketSignal } from "../planning/daily-flow";
import {
  socialAutopilotEnabled,
  type SocialEnvSource,
} from "./policy";

/**
 * Social Autopilot learning-loop hookup (WS-E consumer of WS-C analytics).
 *
 * Contract with WS-C's performance-scoring interface
 * (`src/lib/social-media/analytics/scoring.ts`):
 * - `getPerformanceWeights({ workspaceId, lookbackDays })` returns
 *   multiplicative weights keyed `${provider}::${format}::${hourBucket}` plus
 *   confidence and a `coldStart` flag. No data -> neutral weights (1.0), never
 *   fabricated confidence.
 * - `weightForKey(weights, key)` reads one candidate's weight (neutral 1.0
 *   when unknown).
 *
 * How WS-E biases selection today:
 * 1. Signal ranking: `applyEngagementLearning` boosts signal relevance from
 *    recent engagement snapshots (built-in, always on when autopilot runs).
 * 2. Topic/format bias: `autopilotCandidateWeight()` scores each schedulable
 *    candidate; the materializer schedules higher-weight candidates first so
 *    formats/topics with proven engagement win scarce daily slots.
 * 3. Time selection remains deterministic (scheduler slots 08:00-22:00 UTC
 *    with SHA-256 jitter); weights do not move post times, only which
 *    candidates fill them.
 *
 * Defensive posture: every WS-C call is wrapped. Missing data, cold start,
 * or any thrown error degrades to neutral weights — the run never fails and
 * never invents performance.
 */

export interface AutopilotLearningResult {
  signals: MarketSignal[];
  /** Human-readable record of which learning inputs were applied. */
  learningApplied: string[];
  /** Null when the performance loop is disabled, cold, or unavailable. */
  performanceWeights: PerformanceWeights | null;
}

export async function getAutopilotPerformanceWeights(input: {
  workspaceId: string;
  env?: SocialEnvSource;
}): Promise<PerformanceWeights | null> {
  const env = input.env ?? process.env;
  if (!socialAutopilotEnabled(env)) return null;
  try {
    return await getPerformanceWeights({
      workspaceId: input.workspaceId,
      lookbackDays: 90,
    });
  } catch {
    return null;
  }
}

/**
 * Multiplicative weight for one schedulable candidate. Neutral (1.0) when
 * the loop is cold, disabled, or unavailable.
 */
export function autopilotCandidateWeight(input: {
  weights: PerformanceWeights | null;
  provider: SharedSocialPublishingProvider;
  format: SocialContentType;
  scheduledFor: Date;
}): number {
  if (!input.weights || input.weights.coldStart) return 1.0;
  const key = weightKey(
    input.provider,
    input.format,
    hourBucketFor(input.scheduledFor.getUTCHours()),
  );
  return weightForKey(input.weights, key);
}

export async function applyAutopilotLearning(input: {
  workspaceId: string;
  planDate: Date;
  signals: readonly MarketSignal[];
  lookbackDays?: number;
  env?: SocialEnvSource;
}): Promise<AutopilotLearningResult> {
  const learningApplied: string[] = [];
  const boosted = await applyEngagementLearning({
    workspaceId: input.workspaceId,
    planDate: input.planDate,
    signals: input.signals,
    lookbackDays: input.lookbackDays,
  });
  learningApplied.push("engagement-signal-boost");

  const performanceWeights = await getAutopilotPerformanceWeights({
    workspaceId: input.workspaceId,
    env: input.env,
  });
  if (!performanceWeights) {
    learningApplied.push("performance-weights-unavailable");
  } else if (performanceWeights.coldStart) {
    learningApplied.push("performance-weights-cold-start");
  } else {
    learningApplied.push(
      `performance-weights:${performanceWeights.sampleCount}-samples`,
    );
  }

  return { signals: boosted, learningApplied, performanceWeights };
}
