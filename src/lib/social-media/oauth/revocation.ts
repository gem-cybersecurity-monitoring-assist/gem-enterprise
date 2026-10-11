import { TokMetricError } from "@/lib/tokmetric/security";
import {
  getSocialOAuthProviderConfig,
  validateSocialOAuthProviderConfig,
  type SocialOAuthProvider,
  type SocialOAuthProviderConfig,
} from "./config";
import { getUnifiedTikTokRevokeUrl } from "./tiktok-adapter";
import type { StoredSocialCredential } from "./store";

/**
 * Best-effort provider-side grant revocation for connector disconnects.
 *
 * Revocation is attempted on a best-effort basis: it never throws, and local
 * credential deletion always proceeds regardless of the outcome. Every result
 * is recorded with outcome + timestamp by the caller.
 */

export const SOCIAL_REVOCATION_TIMEOUT_MS = 10_000;

export type SocialRevocationOutcome = "revoked" | "failed" | "not_supported";

export interface SocialRevocationResult {
  supported: boolean;
  outcome: SocialRevocationOutcome;
  attemptedAt: string;
  error?: string;
}

const unsupportedProviders = new Set<SocialOAuthProvider>(["LINKEDIN", "NEXTDOOR"]);

function revoked(attemptedAt: string): SocialRevocationResult {
  return { supported: true, outcome: "revoked", attemptedAt };
}

function failed(attemptedAt: string, error: string): SocialRevocationResult {
  return { supported: true, outcome: "failed", attemptedAt, error };
}

function notSupported(attemptedAt: string, reason: string): SocialRevocationResult {
  return { supported: false, outcome: "not_supported", attemptedAt, error: reason };
}

function metaGraphBaseUrl(config: SocialOAuthProviderConfig) {
  return config.tokenUrl.replace(/\/oauth\/access_token\/?$/, "");
}

function basicAuth(config: SocialOAuthProviderConfig) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

async function postForm(url: string, body: URLSearchParams, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(SOCIAL_REVOCATION_TIMEOUT_MS),
  });
  return response;
}

async function revokeMeta(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
  attemptedAt: string,
): Promise<SocialRevocationResult> {
  // Unified Meta connectors often store a Page or Instagram business ID as the
  // external account id, not the initiating user. Revoke via /me/permissions
  // against the stored bearer token so the grant that issued it is deleted.
  const url = `${metaGraphBaseUrl(config)}/me/permissions`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credential.accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SOCIAL_REVOCATION_TIMEOUT_MS),
    });
  } catch {
    return failed(attemptedAt, "META_REVOCATION_UNAVAILABLE");
  }
  return response.ok
    ? revoked(attemptedAt)
    : failed(attemptedAt, `META_REVOCATION_STATUS_${response.status}`);
}

async function revokeX(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
  attemptedAt: string,
): Promise<SocialRevocationResult> {
  const body = new URLSearchParams({
    token: credential.accessToken,
    token_type_hint: "access_token",
  });
  let response: Response;
  try {
    // X OAuth2 token revocation (RFC 7009 style). Revoking the access token
    // also revokes the associated refresh token for the same authorization.
    response = await postForm("https://api.x.com/2/oauth2/revoke", body, {
      Authorization: basicAuth(config),
    });
  } catch {
    return failed(attemptedAt, "X_REVOCATION_UNAVAILABLE");
  }
  return response.ok
    ? revoked(attemptedAt)
    : failed(attemptedAt, `X_REVOCATION_STATUS_${response.status}`);
}

async function revokeYouTube(
  credential: StoredSocialCredential,
  attemptedAt: string,
): Promise<SocialRevocationResult> {
  const body = new URLSearchParams({ token: credential.accessToken });
  let response: Response;
  try {
    response = await postForm("https://oauth2.googleapis.com/revoke", body, {});
  } catch {
    return failed(attemptedAt, "YOUTUBE_REVOCATION_UNAVAILABLE");
  }
  return response.ok
    ? revoked(attemptedAt)
    : failed(attemptedAt, `YOUTUBE_REVOCATION_STATUS_${response.status}`);
}

async function revokeTikTok(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
  attemptedAt: string,
): Promise<SocialRevocationResult> {
  const body = new URLSearchParams({
    client_key: config.clientId,
    client_secret: config.clientSecret,
    token: credential.accessToken,
  });
  let response: Response;
  try {
    response = await postForm(getUnifiedTikTokRevokeUrl(), body, {});
  } catch {
    return failed(attemptedAt, "TIKTOK_REVOCATION_UNAVAILABLE");
  }
  return response.ok
    ? revoked(attemptedAt)
    : failed(attemptedAt, `TIKTOK_REVOCATION_STATUS_${response.status}`);
}

export async function revokeSocialProviderGrant(input: {
  config: SocialOAuthProviderConfig;
  credential: StoredSocialCredential;
}): Promise<SocialRevocationResult> {
  const { config, credential } = input;
  const attemptedAt = new Date().toISOString();

  if (unsupportedProviders.has(config.provider)) {
    return notSupported(
      attemptedAt,
      `${getSocialOAuthProviderConfig(config.provider).displayName} does not document a token revocation endpoint.`,
    );
  }

  const { missing, ok } = validateSocialOAuthProviderConfig(config.provider);
  if (!ok) {
    return failed(
      attemptedAt,
      `SOCIAL_OAUTH_NOT_CONFIGURED: ${missing.join(", ")}`,
    );
  }

  try {
    switch (config.provider) {
      case "META":
        return await revokeMeta(config, credential, attemptedAt);
      case "X":
        return await revokeX(config, credential, attemptedAt);
      case "YOUTUBE":
        return await revokeYouTube(credential, attemptedAt);
      case "TIKTOK":
        return await revokeTikTok(config, credential, attemptedAt);
      default:
        return notSupported(attemptedAt, `${config.provider} revocation is not implemented.`);
    }
  } catch (error) {
    if (error instanceof TokMetricError) {
      return failed(attemptedAt, error.code);
    }
    return failed(attemptedAt, "SOCIAL_REVOCATION_UNEXPECTED");
  }
}
