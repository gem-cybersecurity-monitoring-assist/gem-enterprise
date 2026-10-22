import type { SharedSocialPublishingProvider } from "./types";
import type { SocialEnvSource } from "@/lib/social-media/autopilot/policy";

const providerLiveGate: Record<SharedSocialPublishingProvider, string> = {
  FACEBOOK_PAGE: "META_SOCIAL_PUBLISHING_ENABLED",
  INSTAGRAM_PROFESSIONAL: "META_SOCIAL_PUBLISHING_ENABLED",
  X: "X_SOCIAL_PUBLISHING_ENABLED",
  LINKEDIN_COMPANY: "LINKEDIN_SOCIAL_PUBLISHING_ENABLED",
  YOUTUBE: "YOUTUBE_PUBLISHING_ENABLED",
  NEXTDOOR: "NEXTDOOR_PUBLISHING_ENABLED",
  TELEGRAM: "TELEGRAM_SOCIAL_PUBLISHING_ENABLED",
};

/**
 * Connector provider match. Telegram authenticates with a bot token rather
 * than OAuth, so the stored connector provider value ("TELEGRAM") is compared
 * as a plain string instead of forcing it into the OAuth provider union.
 */
const connectorProvider: Record<SharedSocialPublishingProvider, string> = {
  FACEBOOK_PAGE: "META",
  INSTAGRAM_PROFESSIONAL: "META",
  X: "X",
  LINKEDIN_COMPANY: "LINKEDIN",
  YOUTUBE: "YOUTUBE",
  NEXTDOOR: "NEXTDOOR",
  TELEGRAM: "TELEGRAM",
};

function enabled(name: string, env: SocialEnvSource = process.env) {
  return env[name]?.trim() === "true";
}

export function globalSocialPublishingEnabled(
  env: SocialEnvSource = process.env,
) {
  return enabled("SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED", env);
}

export function providerSocialPublishingEnabled(
  provider: SharedSocialPublishingProvider,
  env: SocialEnvSource = process.env,
) {
  return enabled(providerLiveGate[provider], env);
}

export function connectorProviderMatches(
  provider: SharedSocialPublishingProvider,
  actual: string,
) {
  return connectorProvider[provider] === actual;
}

export function accountTypeMatches(
  provider: SharedSocialPublishingProvider,
  metadata: Record<string, unknown>,
) {
  const accountType =
    typeof metadata.accountType === "string" ? metadata.accountType : "";
  if (provider === "FACEBOOK_PAGE") return accountType === "META_PAGE";
  if (provider === "INSTAGRAM_PROFESSIONAL") {
    return accountType === "INSTAGRAM_PROFESSIONAL";
  }
  if (provider === "X") return accountType === "X_USER";
  if (provider === "LINKEDIN_COMPANY") {
    return accountType === "LINKEDIN_ORGANIZATION";
  }
  if (provider === "YOUTUBE") return accountType === "YOUTUBE_CHANNEL";
  if (provider === "NEXTDOOR") {
    return accountType === "NEXTDOOR_ENTITY_PROFILE";
  }
  return false;
}

export function missingPublishingScopes(
  provider: SharedSocialPublishingProvider,
  grantedScopes: readonly string[],
) {
  const granted = new Set(grantedScopes);
  const required = (() => {
    switch (provider) {
      case "FACEBOOK_PAGE":
        return ["pages_manage_posts"];
      case "INSTAGRAM_PROFESSIONAL":
        return ["instagram_content_publish"];
      case "X":
        return ["tweet.write"];
      case "LINKEDIN_COMPANY":
        return ["w_organization_social"];
      case "YOUTUBE":
        return ["https://www.googleapis.com/auth/youtube.upload"];
      case "NEXTDOOR": {
        const configured = process.env.NEXTDOOR_PUBLISH_SCOPE?.trim();
        return configured ? [configured] : ["NEXTDOOR_PUBLISH_SCOPE_NOT_CONFIGURED"];
      }
    }
  })();
  return required.filter((scope) => !granted.has(scope));
}
