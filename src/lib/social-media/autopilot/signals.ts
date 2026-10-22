import { loadCurrentMarketSignals } from "../orchestration/intelligence";
import { buildSignalAttribution } from "../orchestration/content-package";
import type { MarketSignal } from "../planning/daily-flow";
import type { SocialEnvSource } from "./policy";

export { buildSignalAttribution };

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

/** Global (not per-provider) signal policy knobs for the autopilot run. */
export function getAutopilotSignalPolicy(env: SocialEnvSource = process.env) {
  return {
    freshnessHours: boundedInteger(
      env.SOCIAL_AUTOPILOT_SIGNAL_FRESHNESS_HOURS,
      72,
      1,
      720,
    ),
    minLiveSignals: boundedInteger(
      env.SOCIAL_AUTOPILOT_MIN_LIVE_SIGNALS,
      1,
      0,
      20,
    ),
  };
}

/**
 * Live signal ingestion for the Social Autopilot AUTO_POLICY path.
 *
 * Sourcing contract (never faked):
 * - "live" signals come from approved, published news articles
 *   (`loadCurrentMarketSignals` filters `status = "published"` and trusted
 *   categories) that are younger than `signalFreshnessHours`.
 * - When fewer than `minLiveSignals` fresh signals exist, the run falls back
 *   to GEM-approved evergreen themes and records
 *   `provenance: "evergreen-fallback"` in the campaign metadata, the audit
 *   trail, and the cron response. The provenance is never claimed as "live".
 *
 * Transformation contract:
 * - Summaries are already editorial summaries from the news ingest pipeline
 *   (aiSummary/summary, capped at ingest), never verbatim article bodies.
 * - `generateCrossPlatformContentPackage` composes original GEM wording
 *   (hook, explanation, call to action) from those summaries; the risk-flag
 *   scanner still runs over every generated string.
 * - Attribution: live-sourced signals carry `sourceReference` (the article
 *   URL). It is retained on every content item via
 *   `sourceEvidence.signalReference` and `buildSignalAttribution()` so the
 *   publisher can credit the source.
 */

export type SignalProvenance = "live" | "evergreen-fallback";

export interface AutopilotSignalSelection {
  signals: MarketSignal[];
  provenance: SignalProvenance;
  /** Number of fresh, approved, live signals found (before fallback). */
  freshSignalCount: number;
  /** True when evergreen fallback content was used instead of live signals. */
  fallbackApplied: boolean;
}

const evergreenThemes = [
  ["Access ownership and MFA hygiene", "Review who owns critical accounts, whether MFA is enforced, and whether recovery paths still work."],
  ["Backup and recovery readiness", "Test whether important business data can actually be restored and whether recovery responsibilities are clear."],
  ["Vendor and third-party dependency risk", "Review critical external services, administrator access, fallback options, and dependency ownership."],
  ["Payment-change verification", "Use an independent verification path before acting on payment, banking, or supplier-detail changes."],
  ["Phishing reporting and escalation", "Make suspicious-message reporting simple and ensure staff know where urgent security concerns should go."],
  ["Endpoint and patch readiness", "Keep supported devices current and track systems that cannot receive normal security updates."],
  ["Joiner, mover, and leaver access", "Remove stale access quickly and review privileges when people change responsibilities."],
  ["Recovery-code and privileged access hygiene", "Protect recovery methods and privileged credentials with the same care as primary sign-in credentials."],
  ["Incident escalation readiness", "Define who can make containment decisions and how the business communicates during an incident."],
  ["Cloud and SaaS access review", "Review administrators, integrations, stale accounts, and recovery contacts across business cloud services."],
  ["Business continuity dependencies", "Identify the systems and people the business cannot operate without and maintain practical fallback plans."],
  ["Security awareness through routine operations", "Turn common business actions into repeatable habits that reduce avoidable security mistakes."],
] as const;

export function evergreenFallbackSignals(planDate: Date): MarketSignal[] {
  const dayIndex = Math.floor(planDate.getTime() / (24 * 60 * 60 * 1000));
  return Array.from({ length: 4 }, (_, offset) => {
    const [topic, summary] =
      evergreenThemes[(dayIndex + offset) % evergreenThemes.length];
    return {
      id: `gem-evergreen:${(dayIndex + offset) % evergreenThemes.length}`,
      topic,
      summary,
      relevance: 0.58,
      momentum: 0.32,
      observedAt: planDate,
      sourceReference: `gem-approved-evergreen:${(dayIndex + offset) % evergreenThemes.length}`,
    };
  });
}

function ageHours(observedAt: Date, planDate: Date) {
  return Math.max(
    0,
    (planDate.getTime() - observedAt.getTime()) / (60 * 60 * 1000),
  );
}

function isLiveSourced(signal: MarketSignal) {
  return signal.id.startsWith("news:");
}

/**
 * Pure, testable selection: keep only fresh live-sourced signals; fall back
 * to evergreen honestly when there are too few.
 */
export function selectAutopilotSignals(input: {
  freshSignals: readonly MarketSignal[];
  planDate: Date;
  freshnessHours: number;
  minLiveSignals: number;
}): AutopilotSignalSelection {
  const freshnessHours = Math.max(1, input.freshnessHours);
  const minLiveSignals = Math.max(0, input.minLiveSignals);
  const fresh = input.freshSignals.filter(
    (signal) =>
      isLiveSourced(signal) &&
      ageHours(signal.observedAt, input.planDate) <= freshnessHours,
  );
  if (fresh.length >= minLiveSignals) {
    return {
      signals: [...fresh],
      provenance: "live",
      freshSignalCount: fresh.length,
      fallbackApplied: false,
    };
  }
  return {
    signals: evergreenFallbackSignals(input.planDate),
    provenance: "evergreen-fallback",
    freshSignalCount: fresh.length,
    fallbackApplied: true,
  };
}

export async function loadAutopilotSignalSelection(input: {
  planDate: Date;
  env?: SocialEnvSource;
}): Promise<AutopilotSignalSelection> {
  const env = input.env ?? process.env;
  const { freshnessHours, minLiveSignals } = getAutopilotSignalPolicy(env);
  const freshSignals = await loadCurrentMarketSignals({
    planDate: input.planDate,
    lookbackHours: freshnessHours,
  });
  return selectAutopilotSignals({
    freshSignals,
    planDate: input.planDate,
    freshnessHours,
    minLiveSignals,
  });
}
