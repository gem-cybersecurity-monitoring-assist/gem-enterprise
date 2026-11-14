import {
  socialOAuthProviders,
  validateSocialOAuthConnectionConfig,
  type SocialOAuthProvider,
  type SocialOAuthRefreshMode,
} from "./config";

export const SOCIAL_AUTHORIZATION_FOUNDATION_VERSION = "2026-07-22.3" as const;

export interface SafeSocialOAuthReadiness {
  provider: SocialOAuthProvider;
  displayName: string;
  readyToAuthorize: boolean;
  platformApproval?: "NOT_REQUIRED" | "NEEDS_REVIEW" | "VERIFIED";
  missing: string[];
  requestedScopes: string[];
  pkce: boolean;
  accountDiscovery: "PROVIDER_VERIFIED";
  refreshMode: SocialOAuthRefreshMode;
  authorizationFoundationVersion: typeof SOCIAL_AUTHORIZATION_FOUNDATION_VERSION;
  credentialStoragePolicy: "ENCRYPTED_SERVER_ONLY";
  authorizationStatePolicy: "SIGNED_SINGLE_USE";
  externalPublishingEnabled: false;
}

export function getSafeSocialOAuthReadiness(): SafeSocialOAuthReadiness[] {
  return socialOAuthProviders.map((provider) => {
    const { config, missing, ok } = validateSocialOAuthConnectionConfig(provider);
    return {
      provider,
      displayName: config.displayName,
      readyToAuthorize: ok,
      platformApproval: !config.platformAccessEnv ? "NOT_REQUIRED" : process.env[config.platformAccessEnv] === "true" ? "VERIFIED" : "NEEDS_REVIEW",
      missing,
      requestedScopes: config.scopes,
      pkce: config.usePkce,
      accountDiscovery: "PROVIDER_VERIFIED",
      refreshMode: config.refreshMode,
      authorizationFoundationVersion: SOCIAL_AUTHORIZATION_FOUNDATION_VERSION,
      credentialStoragePolicy: "ENCRYPTED_SERVER_ONLY",
      authorizationStatePolicy: "SIGNED_SINGLE_USE",
      externalPublishingEnabled: false,
    };
  });
}
