import { TokMetricError } from "@/lib/tokmetric/security";

export const socialOAuthProviders = ["META", "X", "LINKEDIN", "YOUTUBE", "NEXTDOOR"] as const;
export type SocialOAuthProvider = (typeof socialOAuthProviders)[number];
export type SocialOAuthRefreshMode = "STANDARD" | "REAUTHORIZE" | "NONE";

export interface SocialOAuthProviderConfig {
  provider: SocialOAuthProvider;
  displayName: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  accountDiscoveryUrl: string;
  scopes: string[];
  usePkce: boolean;
  tokenClientAuthentication: "BODY" | "BASIC";
  refreshMode: SocialOAuthRefreshMode;
  additionalAuthorizationParameters: Record<string, string>;
  apiVersion?: string;
  platformAccessEnv?: string;
}

function value(name: string) {
  return process.env[name]?.trim() || "";
}

function enabled(name: string) {
  return value(name) === "true";
}

function scopes(name: string) {
  return value(name)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function metaGraphBaseUrl() {
  const version = value("META_GRAPH_API_VERSION");
  return version ? `https://graph.facebook.com/${version}` : "";
}

function metaAuthorizationUrl() {
  const version = value("META_GRAPH_API_VERSION");
  return version ? `https://www.facebook.com/${version}/dialog/oauth` : "";
}

function metaTokenUrl() {
  const baseUrl = metaGraphBaseUrl();
  return baseUrl ? `${baseUrl}/oauth/access_token` : "";
}

export function getSocialOAuthProviderConfig(
  provider: SocialOAuthProvider,
): SocialOAuthProviderConfig {
  const configs: Record<SocialOAuthProvider, SocialOAuthProviderConfig> = {
    META: {
      provider: "META",
      displayName: "Meta Business",
      enabled: enabled("META_SOCIAL_OAUTH_ENABLED"),
      clientId: value("META_APP_ID"),
      clientSecret: value("META_APP_SECRET"),
      redirectUri: value("META_OAUTH_REDIRECT_URI"),
      authorizationUrl: metaAuthorizationUrl(),
      tokenUrl: metaTokenUrl(),
      accountDiscoveryUrl: metaGraphBaseUrl() ? `${metaGraphBaseUrl()}/me/accounts` : "",
      scopes: scopes("META_SOCIAL_SCOPES"),
      usePkce: false,
      tokenClientAuthentication: "BODY",
      refreshMode: "NONE",
      additionalAuthorizationParameters: {},
      apiVersion: value("META_GRAPH_API_VERSION"),
      platformAccessEnv: "META_APP_REVIEW_APPROVED",
    },
    X: {
      provider: "X",
      displayName: "X Company Account",
      enabled: enabled("X_SOCIAL_OAUTH_ENABLED"),
      clientId: value("X_CLIENT_ID"),
      clientSecret: value("X_CLIENT_SECRET"),
      redirectUri: value("X_OAUTH_REDIRECT_URI"),
      authorizationUrl: "https://x.com/i/oauth2/authorize",
      tokenUrl: "https://api.x.com/2/oauth2/token",
      accountDiscoveryUrl: "https://api.x.com/2/users/me",
      scopes: scopes("X_SOCIAL_SCOPES"),
      usePkce: true,
      tokenClientAuthentication: "BASIC",
      refreshMode: "STANDARD",
      additionalAuthorizationParameters: {},
    },
    LINKEDIN: {
      provider: "LINKEDIN",
      displayName: "LinkedIn Company",
      enabled: enabled("LINKEDIN_SOCIAL_OAUTH_ENABLED"),
      clientId: value("LINKEDIN_CLIENT_ID"),
      clientSecret: value("LINKEDIN_CLIENT_SECRET"),
      redirectUri: value("LINKEDIN_OAUTH_REDIRECT_URI"),
      authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      accountDiscoveryUrl: "https://api.linkedin.com/rest/organizationAcls",
      scopes: scopes("LINKEDIN_SOCIAL_SCOPES"),
      usePkce: false,
      tokenClientAuthentication: "BODY",
      refreshMode: "REAUTHORIZE",
      additionalAuthorizationParameters: {},
      apiVersion: value("LINKEDIN_API_VERSION"),
      platformAccessEnv: "LINKEDIN_COMMUNITY_MANAGEMENT_ACCESS_APPROVED",
    },
    YOUTUBE: {
      provider: "YOUTUBE",
      displayName: "YouTube Channel",
      enabled: enabled("YOUTUBE_SOCIAL_OAUTH_ENABLED"),
      clientId: value("GOOGLE_SOCIAL_CLIENT_ID"),
      clientSecret: value("GOOGLE_SOCIAL_CLIENT_SECRET"),
      redirectUri: value("YOUTUBE_OAUTH_REDIRECT_URI"),
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      accountDiscoveryUrl: "https://www.googleapis.com/youtube/v3/channels",
      scopes: scopes("YOUTUBE_SOCIAL_SCOPES"),
      usePkce: true,
      tokenClientAuthentication: "BODY",
      refreshMode: "STANDARD",
      additionalAuthorizationParameters: {
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
      },
      platformAccessEnv: "YOUTUBE_DATA_API_AUDIT_APPROVED",
    },
    NEXTDOOR: {
      provider: "NEXTDOOR",
      displayName: "Nextdoor Business",
      enabled: enabled("NEXTDOOR_OAUTH_ENABLED"),
      clientId: value("NEXTDOOR_CLIENT_ID"),
      clientSecret: value("NEXTDOOR_CLIENT_SECRET"),
      redirectUri: value("NEXTDOOR_OAUTH_REDIRECT_URI"),
      authorizationUrl: "https://www.nextdoor.com/v3/authorize/",
      tokenUrl: "https://auth.nextdoor.com/v2/token",
      accountDiscoveryUrl: "https://nextdoor.com/external/api/partner/v1/me/profiles/",
      scopes: scopes("NEXTDOOR_SOCIAL_SCOPES"),
      usePkce: false,
      tokenClientAuthentication: "BASIC",
      refreshMode: "STANDARD",
      additionalAuthorizationParameters: {},
      platformAccessEnv: "NEXTDOOR_PUBLISH_API_ACCESS_APPROVED",
    },
  };

  return configs[provider];
}

export function validateSocialOAuthProviderConfig(provider: SocialOAuthProvider) {
  const config = getSocialOAuthProviderConfig(provider);
  const missing: string[] = [];

  if (!config.enabled) missing.push(`${provider}_OAUTH_DISABLED`);
  if (!config.clientId) missing.push("CLIENT_ID");
  if (!config.clientSecret) missing.push("CLIENT_SECRET");
  if (!config.redirectUri) missing.push("REDIRECT_URI");
  if (!config.authorizationUrl) missing.push("AUTHORIZATION_URL");
  if (!config.tokenUrl) missing.push("TOKEN_URL");
  if (!config.accountDiscoveryUrl) missing.push("ACCOUNT_DISCOVERY_URL");
  if (config.scopes.length === 0) missing.push("SCOPES");
  if (provider === "X" && !config.scopes.includes("offline.access")) {
    missing.push("OFFLINE_ACCESS_SCOPE");
  }
  if (provider === "LINKEDIN") {
    if (!config.apiVersion) missing.push("LINKEDIN_API_VERSION");
    if (
      !config.scopes.includes("rw_organization_admin") &&
      !config.scopes.includes("r_organization_admin")
    ) {
      missing.push("LINKEDIN_ORGANIZATION_ADMIN_SCOPE");
    }
  }
  if (
    provider === "YOUTUBE" &&
    !config.scopes.includes("https://www.googleapis.com/auth/youtube.readonly")
  ) {
    missing.push("YOUTUBE_CHANNEL_DISCOVERY_SCOPE");
  }
  if (provider === "NEXTDOOR" && !config.scopes.includes("profile")) {
    missing.push("NEXTDOOR_PROFILE_DISCOVERY_SCOPE");
  }
  if (config.platformAccessEnv && !enabled(config.platformAccessEnv)) {
    missing.push(config.platformAccessEnv);
  }
  if (!value("SOCIAL_TOKEN_ENCRYPTION_KEY")) missing.push("SOCIAL_TOKEN_ENCRYPTION_KEY");

  return { config, missing, ok: missing.length === 0 };
}

export function parseSocialOAuthProvider(input: string): SocialOAuthProvider {
  const provider = input.toUpperCase();
  if (!socialOAuthProviders.includes(provider as SocialOAuthProvider)) {
    throw new TokMetricError(400, "UNSUPPORTED_SOCIAL_PROVIDER", "Social OAuth provider is not supported.");
  }
  return provider as SocialOAuthProvider;
}
