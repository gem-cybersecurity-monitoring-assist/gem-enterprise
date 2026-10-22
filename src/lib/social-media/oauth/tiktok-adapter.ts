import { getTikTokOAuthConfig, providerScopes } from "@/lib/tokmetric/oauth/config";
import type { SocialOAuthProviderConfig } from "./config";

function value(name: string) {
  return process.env[name]?.trim() || "";
}

function unifiedScopes(): string[] {
  const raw = value("TIKTOK_SOCIAL_SCOPES");
  if (raw) {
    return raw
      .split(/[\s,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }
  return [...providerScopes.TIKTOK_LOGIN_KIT];
}

/**
 * Canonical TikTok configuration for the unified social-media OAuth control
 * plane.
 *
 * This is an adapter shim: the credential source (client key/secret,
 * enablement flag, environment) stays in the legacy TokMetric TikTok config so
 * the legacy `/api/tokmetric/oauth/*` path keeps working unchanged. The unified
 * flow adds its own scope/redirect/audit gates on top.
 */
export function getUnifiedTikTokProviderConfig(): SocialOAuthProviderConfig {
  const legacy = getTikTokOAuthConfig();
  return {
    provider: "TIKTOK",
    displayName: "TikTok Business",
    enabled: legacy.oauthEnabled,
    clientId: legacy.clientKey,
    clientSecret: legacy.clientSecret,
    redirectUri: value("TIKTOK_SOCIAL_REDIRECT_URI") || legacy.redirectUri,
    authorizationUrl: legacy.authorizationUrl,
    tokenUrl: legacy.tokenUrl,
    accountDiscoveryUrl: "https://open.tiktokapis.com/v2/user/info/",
    scopes: unifiedScopes(),
    usePkce: true,
    tokenClientAuthentication: "BODY",
    refreshMode: "STANDARD",
    clientIdAuthorizationParameter: "client_key",
    clientIdTokenParameter: "client_key",
    scopeDelimiter: ",",
    additionalAuthorizationParameters: {},
    platformAccessEnv: "TIKTOK_APP_AUDIT_APPROVED",
    // The unified flow requires its own allow-listed callback URL. The legacy
    // TokMetric redirect URI stays untouched for the legacy route; validation
    // fails closed when this is absent.
    redirectUriEnv: "TIKTOK_SOCIAL_REDIRECT_URI",
  };
}

export function getUnifiedTikTokEnvironment(): "sandbox" | "production" {
  return getTikTokOAuthConfig().environment;
}

export function getUnifiedTikTokRevokeUrl(): string {
  return getTikTokOAuthConfig().revokeUrl;
}
