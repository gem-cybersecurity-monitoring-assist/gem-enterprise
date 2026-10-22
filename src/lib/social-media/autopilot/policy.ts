import type { SharedSocialPublishingProvider } from "@/lib/social-media/publishing/types";

export const SOCIAL_AUTOPILOT_POLICY_VERSION = "social-autopilot-v1";

export type SocialEnvSource = Record<string, string | undefined>;

export interface SocialAutopilotProviderPolicy {
  provider: SharedSocialPublishingProvider;
  dailyTarget: number;
  hardDailyCap: number;
  minSpacingMinutes: number;
  reserveDays: number;
  autoApprovalEligible: boolean;
  /** Maximum PENDING/CLAIMED/RETRYING publishing jobs queued for this provider. */
  maxQueueDepth: number;
  /**
   * Cooldown between autopilot materializations for this provider: no new
   * jobs are scheduled when the previous materialization created jobs more
   * recently than this many minutes ago. Prevents burst pile-ups from
   * overlapping or repeated cron runs.
   */
  cooldownMinutes: number;
  /** Consecutive-window failure threshold that pauses new scheduling. */
  failurePauseThreshold: number;
  /** Lookback window (minutes) for counting failed publishing jobs. */
  failureWindowMinutes: number;
  /** Base backoff minutes applied once failurePauseThreshold is reached. */
  failureBackoffBaseMinutes: number;
  /** Exponential multiplier applied per additional failure beyond threshold. */
  failureBackoffMultiplier: number;
  /** Fixed backoff minutes after a rate-limit failure in the window. */
  rateLimitBackoffMinutes: number;
  /** Lookback window (minutes) for counting rate-limit failures. */
  rateLimitWindowMinutes: number;
  /** Maximum age (hours) for a news signal to count as "live". */
  signalFreshnessHours: number;
  /** Minimum fresh live signals before evergreen fallback is declared. */
  minLiveSignals: number;
  /** Duplicate-content protection lookback for fingerprints (days). */
  duplicateContentWindowDays: number;
}

const defaults: Record<SharedSocialPublishingProvider, SocialAutopilotProviderPolicy> = {
  FACEBOOK_PAGE: {
    provider: "FACEBOOK_PAGE",
    dailyTarget: 3,
    hardDailyCap: 6,
    minSpacingMinutes: 150,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 12,
    cooldownMinutes: 90,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
  INSTAGRAM_PROFESSIONAL: {
    provider: "INSTAGRAM_PROFESSIONAL",
    dailyTarget: 3,
    hardDailyCap: 5,
    minSpacingMinutes: 180,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 12,
    cooldownMinutes: 90,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
  X: {
    provider: "X",
    dailyTarget: 8,
    hardDailyCap: 15,
    minSpacingMinutes: 60,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 24,
    cooldownMinutes: 30,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
  LINKEDIN_COMPANY: {
    provider: "LINKEDIN_COMPANY",
    dailyTarget: 2,
    hardDailyCap: 3,
    minSpacingMinutes: 240,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 8,
    cooldownMinutes: 120,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
  YOUTUBE: {
    provider: "YOUTUBE",
    dailyTarget: 1,
    hardDailyCap: 3,
    minSpacingMinutes: 360,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 8,
    cooldownMinutes: 180,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
  NEXTDOOR: {
    provider: "NEXTDOOR",
    dailyTarget: 1,
    hardDailyCap: 2,
    minSpacingMinutes: 480,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 6,
    cooldownMinutes: 240,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
  TELEGRAM: {
    provider: "TELEGRAM",
    dailyTarget: 5,
    hardDailyCap: 10,
    minSpacingMinutes: 90,
    reserveDays: 3,
    autoApprovalEligible: true,
    maxQueueDepth: 16,
    cooldownMinutes: 60,
    failurePauseThreshold: 3,
    failureWindowMinutes: 360,
    failureBackoffBaseMinutes: 60,
    failureBackoffMultiplier: 2,
    rateLimitBackoffMinutes: 240,
    rateLimitWindowMinutes: 360,
    signalFreshnessHours: 72,
    minLiveSignals: 1,
    duplicateContentWindowDays: 30,
  },
};

const providers = Object.keys(defaults) as SharedSocialPublishingProvider[];

function enabled(env: SocialEnvSource, name: string) {
  return env[name]?.trim() === "true";
}

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

function boundedNumber(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = raw ? Number.parseFloat(raw) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function providerEnvName(provider: SharedSocialPublishingProvider) {
  return provider.replace(/[^A-Z0-9]/g, "_");
}

export function socialAutopilotEnabled(env: SocialEnvSource = process.env) {
  return enabled(env, "SOCIAL_AUTOPILOT_ENABLED");
}

export function socialAutopilotAutoApprovalEnabled(
  env: SocialEnvSource = process.env,
) {
  return (
    socialAutopilotEnabled(env) &&
    enabled(env, "SOCIAL_AUTOPILOT_AUTO_APPROVAL_ENABLED")
  );
}

export function getSocialAutopilotProviderPolicy(
  provider: SharedSocialPublishingProvider,
  env: SocialEnvSource = process.env,
): SocialAutopilotProviderPolicy {
  const base = defaults[provider];
  const prefix = `SOCIAL_AUTOPILOT_${providerEnvName(provider)}`;
  return {
    ...base,
    dailyTarget: boundedInteger(
      env[`${prefix}_DAILY_TARGET`],
      base.dailyTarget,
      0,
      base.hardDailyCap,
    ),
    reserveDays: boundedInteger(
      env.SOCIAL_AUTOPILOT_RESERVE_DAYS,
      base.reserveDays,
      1,
      7,
    ),
    maxQueueDepth: boundedInteger(
      env[`${prefix}_MAX_QUEUE_DEPTH`],
      base.maxQueueDepth,
      0,
      100,
    ),
    cooldownMinutes: boundedInteger(
      env[`${prefix}_COOLDOWN_MINUTES`],
      base.cooldownMinutes,
      0,
      1440,
    ),
    failurePauseThreshold: boundedInteger(
      env[`${prefix}_FAILURE_PAUSE_THRESHOLD`],
      base.failurePauseThreshold,
      1,
      20,
    ),
    failureWindowMinutes: boundedInteger(
      env[`${prefix}_FAILURE_WINDOW_MINUTES`],
      base.failureWindowMinutes,
      15,
      10080,
    ),
    failureBackoffBaseMinutes: boundedInteger(
      env[`${prefix}_FAILURE_BACKOFF_BASE_MINUTES`],
      base.failureBackoffBaseMinutes,
      5,
      1440,
    ),
    failureBackoffMultiplier: boundedNumber(
      env[`${prefix}_FAILURE_BACKOFF_MULTIPLIER`],
      base.failureBackoffMultiplier,
      1,
      8,
    ),
    rateLimitBackoffMinutes: boundedInteger(
      env[`${prefix}_RATE_LIMIT_BACKOFF_MINUTES`],
      base.rateLimitBackoffMinutes,
      5,
      2880,
    ),
    rateLimitWindowMinutes: boundedInteger(
      env[`${prefix}_RATE_LIMIT_WINDOW_MINUTES`],
      base.rateLimitWindowMinutes,
      15,
      10080,
    ),
    signalFreshnessHours: boundedInteger(
      env.SOCIAL_AUTOPILOT_SIGNAL_FRESHNESS_HOURS,
      base.signalFreshnessHours,
      1,
      720,
    ),
    minLiveSignals: boundedInteger(
      env.SOCIAL_AUTOPILOT_MIN_LIVE_SIGNALS,
      base.minLiveSignals,
      0,
      20,
    ),
    duplicateContentWindowDays: boundedInteger(
      env[`${prefix}_DUPLICATE_CONTENT_WINDOW_DAYS`],
      base.duplicateContentWindowDays,
      1,
      365,
    ),
  };
}

/**
 * Workspace/operator pause for a provider. Env-owned knobs:
 * - `SOCIAL_AUTOPILOT_<PROVIDER>_PAUSED=true` pauses one provider.
 * - `SOCIAL_AUTOPILOT_PAUSE_ALL=true` pauses every provider.
 */
export function isSocialAutopilotProviderPausedByConfig(
  provider: SharedSocialPublishingProvider,
  env: SocialEnvSource = process.env,
) {
  const prefix = `SOCIAL_AUTOPILOT_${providerEnvName(provider)}`;
  return (
    env[`${prefix}_PAUSED`]?.trim() === "true" ||
    env.SOCIAL_AUTOPILOT_PAUSE_ALL?.trim() === "true"
  );
}

export function getSocialAutopilotProviderPolicies(
  env: SocialEnvSource = process.env,
) {
  return providers.map((provider) =>
    getSocialAutopilotProviderPolicy(provider, env),
  );
}

export function getSocialAutopilotProviderTargets(
  env: SocialEnvSource = process.env,
) {
  return Object.fromEntries(
    getSocialAutopilotProviderPolicies(env).map((policy) => [
      policy.provider,
      policy.dailyTarget,
    ]),
  ) as Partial<Record<SharedSocialPublishingProvider, number>>;
}

export function getSocialAutopilotProviders(
  env: SocialEnvSource = process.env,
): SharedSocialPublishingProvider[] {
  const configured = env.SOCIAL_AUTOPILOT_PROVIDERS
    ?.split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const selected = configured?.length
    ? providers.filter((provider) => configured.includes(provider))
    : providers;
  return selected.filter(
    (provider) => getSocialAutopilotProviderPolicy(provider, env).dailyTarget > 0,
  );
}

export function explicitAutopilotConnectorId(
  provider: SharedSocialPublishingProvider,
  env: SocialEnvSource = process.env,
) {
  const prefix = `SOCIAL_AUTOPILOT_${providerEnvName(provider)}`;
  return env[`${prefix}_CONNECTOR_ID`]?.trim() || undefined;
}

export type SocialAutopilotEgressMode =
  | "PLATFORM_DEFAULT"
  | "STATIC_NAT"
  | "REGIONAL_EDGE";

export interface SocialAutopilotEgressPolicy {
  mode: SocialAutopilotEgressMode;
  region?: string;
  stableIdentityRequired: true;
  rotatingProxyAllowed: false;
}

const allowedEgressModes = new Set<SocialAutopilotEgressMode>([
  "PLATFORM_DEFAULT",
  "STATIC_NAT",
  "REGIONAL_EDGE",
]);

export function getSocialAutopilotEgressPolicy(
  env: SocialEnvSource = process.env,
): SocialAutopilotEgressPolicy {
  const requested = (env.SOCIAL_AUTOPILOT_EGRESS_MODE?.trim().toUpperCase() ||
    "PLATFORM_DEFAULT") as SocialAutopilotEgressMode;
  if (!allowedEgressModes.has(requested)) {
    throw new Error(
      "SOCIAL_AUTOPILOT_EGRESS_MODE must use platform-default, static-NAT, or regional-edge egress; rotating/residential/mobile proxy modes are not supported.",
    );
  }

  const suspiciousProxyVariables = [
    env.SOCIAL_AUTOPILOT_ROTATING_PROXY_URL,
    env.SOCIAL_AUTOPILOT_RESIDENTIAL_PROXY_URL,
    env.SOCIAL_AUTOPILOT_MOBILE_PROXY_URL,
  ].filter((value) => value?.trim());
  if (suspiciousProxyVariables.length > 0) {
    throw new Error(
      "Rotating, residential, and mobile proxy configuration is not accepted by Social Autopilot.",
    );
  }

  return {
    mode: requested,
    region: env.SOCIAL_AUTOPILOT_EGRESS_REGION?.trim() || undefined,
    stableIdentityRequired: true,
    rotatingProxyAllowed: false,
  };
}

export function getSocialAutopilotReserveDays(
  env: SocialEnvSource = process.env,
) {
  return getSocialAutopilotProviderPolicies(env).reduce(
    (maximum, policy) => Math.max(maximum, policy.reserveDays),
    1,
  );
}
