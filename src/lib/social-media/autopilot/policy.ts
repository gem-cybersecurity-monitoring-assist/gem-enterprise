export type SocialEnvSource = Record<string, string | undefined>;

import type { SharedSocialPublishingProvider } from "@/lib/social-media/publishing/types";

export const SOCIAL_AUTOPILOT_POLICY_VERSION = "social-autopilot-v1";

export interface SocialAutopilotProviderPolicy {
  provider: SharedSocialPublishingProvider;
  dailyTarget: number;
  hardDailyCap: number;
  minSpacingMinutes: number;
  reserveDays: number;
  autoApprovalEligible: boolean;
}

const defaults: Record<SharedSocialPublishingProvider, SocialAutopilotProviderPolicy> = {
  FACEBOOK_PAGE: {
    provider: "FACEBOOK_PAGE",
    dailyTarget: 3,
    hardDailyCap: 6,
    minSpacingMinutes: 150,
    reserveDays: 3,
    autoApprovalEligible: true,
  },
  INSTAGRAM_PROFESSIONAL: {
    provider: "INSTAGRAM_PROFESSIONAL",
    dailyTarget: 3,
    hardDailyCap: 5,
    minSpacingMinutes: 180,
    reserveDays: 3,
    autoApprovalEligible: true,
  },
  X: {
    provider: "X",
    dailyTarget: 8,
    hardDailyCap: 15,
    minSpacingMinutes: 60,
    reserveDays: 3,
    autoApprovalEligible: true,
  },
  LINKEDIN_COMPANY: {
    provider: "LINKEDIN_COMPANY",
    dailyTarget: 2,
    hardDailyCap: 3,
    minSpacingMinutes: 240,
    reserveDays: 3,
    autoApprovalEligible: true,
  },
  YOUTUBE: {
    provider: "YOUTUBE",
    dailyTarget: 1,
    hardDailyCap: 3,
    minSpacingMinutes: 360,
    reserveDays: 3,
    autoApprovalEligible: true,
  },
  NEXTDOOR: {
    provider: "NEXTDOOR",
    dailyTarget: 1,
    hardDailyCap: 2,
    minSpacingMinutes: 480,
    reserveDays: 3,
    autoApprovalEligible: true,
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
  };
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
