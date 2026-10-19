import { TokMetricError } from "@/lib/tokmetric/security";
import type { SocialOAuthProviderConfig } from "./config";
import type { StoredSocialCredential } from "./store";

interface GenericTokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  refresh_expires_in?: unknown;
  scope?: unknown;
  scopes?: unknown;
  open_id?: unknown;
  user_id?: unknown;
  sub?: unknown;
  error?: unknown;
}

const rejectedRefreshErrors = new Set([
  "invalid_grant",
  "invalid_token",
  "invalid_refresh_token",
  "access_denied",
]);

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function secondsValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function tokenScopes(payload: GenericTokenPayload, requestedScopes: string[]) {
  if (Array.isArray(payload.scopes)) {
    return payload.scopes.filter(
      (scope): scope is string => typeof scope === "string" && Boolean(scope.trim()),
    );
  }
  const scope = stringValue(payload.scope);
  if (scope) return scope.split(/[\s,]+/).filter(Boolean);
  return requestedScopes;
}

function tokenRequestHeaders(config: SocialOAuthProviderConfig) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (config.tokenClientAuthentication === "BASIC") {
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    );
  }
  return headers;
}

function addClientAuthentication(body: URLSearchParams, config: SocialOAuthProviderConfig) {
  if (config.tokenClientAuthentication === "BODY") {
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
  }
}

async function requestToken(input: {
  config: SocialOAuthProviderConfig;
  body: URLSearchParams;
  unavailableCode: string;
  failureCode: string;
  unavailableMessage: string;
  failureMessage: string;
}) {
  let response: Response;
  try {
    response = await fetch(input.config.tokenUrl, {
      method: "POST",
      headers: tokenRequestHeaders(input.config),
      body: input.body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TokMetricError(503, input.unavailableCode, input.unavailableMessage);
  }

  let payload: GenericTokenPayload = {};
  try {
    payload = (await response.json()) as GenericTokenPayload;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const oauthError = stringValue(payload.error)?.toLowerCase();
    const temporary = response.status === 429 || response.status >= 500;
    const explicitRefreshRejection =
      input.failureCode === "SOCIAL_TOKEN_REFRESH_REJECTED" &&
      Boolean(oauthError && rejectedRefreshErrors.has(oauthError));
    if (temporary || (input.failureCode === "SOCIAL_TOKEN_REFRESH_REJECTED" && !explicitRefreshRejection)) {
      throw new TokMetricError(503, input.unavailableCode, input.unavailableMessage);
    }
    throw new TokMetricError(401, input.failureCode, input.failureMessage);
  }
  return payload;
}

function credentialFromTokenPayload(input: {
  config: SocialOAuthProviderConfig;
  payload: GenericTokenPayload;
  requestedScopes: string[];
  previous?: StoredSocialCredential;
}) {
  const accessToken = stringValue(input.payload.access_token);
  if (!accessToken) {
    throw new TokMetricError(
      502,
      "SOCIAL_TOKEN_RESPONSE_INVALID",
      `${input.config.displayName} returned an invalid token response.`,
    );
  }
  const expiresIn = secondsValue(input.payload.expires_in);
  const refreshExpiresIn = secondsValue(input.payload.refresh_expires_in);
  const externalAccountId =
    stringValue(input.payload.open_id) ||
    stringValue(input.payload.user_id) ||
    stringValue(input.payload.sub) ||
    input.previous?.externalAccountId;
  const grantedScopes = tokenScopes(
    input.payload,
    input.previous?.grantedScopes || input.requestedScopes,
  );

  return {
    provider: input.config.provider,
    accessToken,
    refreshToken: stringValue(input.payload.refresh_token) || input.previous?.refreshToken,
    tokenType: stringValue(input.payload.token_type) || input.previous?.tokenType,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : input.previous?.expiresAt,
    refreshExpiresAt: refreshExpiresIn
      ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
      : input.previous?.refreshExpiresAt,
    grantedScopes,
    externalAccountId,
  } satisfies StoredSocialCredential;
}

function safeTokenMetadata(credential: StoredSocialCredential) {
  return {
    provider: credential.provider,
    tokenType: credential.tokenType || "unknown",
    expiresAt: credential.expiresAt || null,
    refreshExpiresAt: credential.refreshExpiresAt || null,
    refreshTokenPresent: Boolean(credential.refreshToken),
    scopeCount: credential.grantedScopes.length,
    externalAccountIdPresent: Boolean(credential.externalAccountId),
  };
}

export function buildSocialAuthorizationUrl(input: {
  config: SocialOAuthProviderConfig;
  state: string;
  codeChallenge?: string;
}) {
  const { config } = input;
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", input.state);
  for (const [key, value] of Object.entries(config.additionalAuthorizationParameters)) {
    url.searchParams.set(key, value);
  }
  if (config.usePkce) {
    if (!input.codeChallenge) {
      throw new TokMetricError(500, "SOCIAL_PKCE_REQUIRED", "PKCE challenge was not created.");
    }
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url;
}

export async function exchangeSocialAuthorizationCode(input: {
  config: SocialOAuthProviderConfig;
  code: string;
  codeVerifier?: string;
  requestedScopes: string[];
}) {
  if (input.config.usePkce && !input.codeVerifier) {
    throw new TokMetricError(401, "SOCIAL_PKCE_VERIFIER_MISSING", "PKCE verifier is missing.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.config.redirectUri,
  });
  addClientAuthentication(body, input.config);
  if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);

  const payload = await requestToken({
    config: input.config,
    body,
    unavailableCode: "SOCIAL_TOKEN_EXCHANGE_UNAVAILABLE",
    failureCode: "SOCIAL_TOKEN_EXCHANGE_REJECTED",
    unavailableMessage: `${input.config.displayName} token service is unavailable.`,
    failureMessage: `${input.config.displayName} did not authorize the connector.`,
  });
  const credential = credentialFromTokenPayload({
    config: input.config,
    payload,
    requestedScopes: input.requestedScopes,
  });

  return {
    credential,
    safeMetadata: safeTokenMetadata(credential),
  };
}

export async function refreshSocialAccessToken(input: {
  config: SocialOAuthProviderConfig;
  credential: StoredSocialCredential;
}) {
  if (input.config.refreshMode !== "STANDARD") {
    throw new TokMetricError(
      409,
      "SOCIAL_TOKEN_REFRESH_UNSUPPORTED",
      `${input.config.displayName} requires a new authorization flow instead of token refresh.`,
    );
  }
  if (!input.credential.refreshToken) {
    throw new TokMetricError(
      409,
      "SOCIAL_REFRESH_TOKEN_MISSING",
      `${input.config.displayName} requires reauthorization because no refresh token is stored.`,
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.credential.refreshToken,
  });
  addClientAuthentication(body, input.config);
  if (input.config.provider === "NEXTDOOR") {
    body.set("scope", input.credential.grantedScopes.join(" "));
  }

  const payload = await requestToken({
    config: input.config,
    body,
    unavailableCode: "SOCIAL_TOKEN_REFRESH_UNAVAILABLE",
    failureCode: "SOCIAL_TOKEN_REFRESH_REJECTED",
    unavailableMessage: `${input.config.displayName} token refresh service is unavailable.`,
    failureMessage: `${input.config.displayName} rejected the stored refresh credential.`,
  });
  const credential = credentialFromTokenPayload({
    config: input.config,
    payload,
    requestedScopes: input.credential.grantedScopes,
    previous: input.credential,
  });

  return {
    credential,
    safeMetadata: {
      ...safeTokenMetadata(credential),
      rotatedAt: new Date().toISOString(),
    },
  };
}
