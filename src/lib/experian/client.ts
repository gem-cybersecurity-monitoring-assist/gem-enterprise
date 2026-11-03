import { TokMetricError } from "@/lib/tokmetric/security";
import {
  requireExperianUrl,
  type ExperianConfig,
} from "./config";
import { experianResponseDigest, opaqueExperianReference } from "./crypto";

interface ExperianTokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  refresh_token_expires_in?: unknown;
  scope?: unknown;
  sub?: unknown;
  error?: unknown;
}

export interface ExperianCredential {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  grantedScopes: string[];
  tokenSubject?: string;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function secondsValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function jwtSubject(token: string) {
  const [, body] = token.split(".");
  if (!body) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    return stringValue(payload.sub) || stringValue(payload.user_name) || stringValue(payload.username);
  } catch {
    return undefined;
  }
}

function credentialFromPayload(payload: ExperianTokenPayload, requestedScopes: string[]) {
  const accessToken = stringValue(payload.access_token);
  if (!accessToken) {
    throw new TokMetricError(
      502,
      "EXPERIAN_TOKEN_RESPONSE_INVALID",
      "Experian returned an invalid token response.",
    );
  }
  const expiresIn = secondsValue(payload.expires_in);
  const refreshExpiresIn = secondsValue(payload.refresh_token_expires_in);
  const scope = stringValue(payload.scope);
  return {
    accessToken,
    refreshToken: stringValue(payload.refresh_token),
    tokenType: stringValue(payload.token_type) || "Bearer",
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined,
    refreshExpiresAt: refreshExpiresIn
      ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
      : undefined,
    grantedScopes: scope ? scope.split(/[\s,]+/).filter(Boolean) : requestedScopes,
    tokenSubject: stringValue(payload.sub) || jwtSubject(accessToken),
  } satisfies ExperianCredential;
}

async function parseTokenResponse(response: Response, requestedScopes: string[]) {
  let payload: ExperianTokenPayload = {};
  try {
    payload = (await response.json()) as ExperianTokenPayload;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw new TokMetricError(
        503,
        "EXPERIAN_TOKEN_SERVICE_UNAVAILABLE",
        "Experian token service is temporarily unavailable.",
      );
    }
    throw new TokMetricError(
      401,
      "EXPERIAN_AUTHORIZATION_REJECTED",
      "Experian rejected the authorization request.",
    );
  }
  return credentialFromPayload(payload, requestedScopes);
}

export function buildExperianAuthorizationUrl(input: {
  config: ExperianConfig;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(requireExperianUrl(input.config.authorizationUrl, "Experian authorization URL"));
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.config.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function requestExperianDeveloperToken(config: ExperianConfig) {
  let response: Response;
  try {
    response = await fetch(requireExperianUrl(config.tokenUrl, "Experian token URL"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Grant_type: "password",
      },
      body: JSON.stringify({
        username: config.developerUsername,
        password: config.developerPassword,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TokMetricError(
      503,
      "EXPERIAN_TOKEN_SERVICE_UNAVAILABLE",
      "Experian token service is temporarily unavailable.",
    );
  }
  return parseTokenResponse(response, config.scopes);
}

export async function exchangeExperianAuthorizationCode(input: {
  config: ExperianConfig;
  code: string;
  codeVerifier: string;
  requestedScopes: string[];
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.config.redirectUri,
    client_id: input.config.clientId,
    code_verifier: input.codeVerifier,
  });
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (input.config.tokenClientAuthentication === "BASIC") {
    body.delete("client_id");
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${input.config.clientId}:${input.config.clientSecret}`).toString("base64")}`,
    );
  } else {
    body.set("client_secret", input.config.clientSecret);
  }
  let response: Response;
  try {
    response = await fetch(requireExperianUrl(input.config.tokenUrl, "Experian token URL"), {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TokMetricError(
      503,
      "EXPERIAN_TOKEN_SERVICE_UNAVAILABLE",
      "Experian token service is temporarily unavailable.",
    );
  }
  return parseTokenResponse(response, input.requestedScopes);
}

export async function refreshExperianCredential(input: {
  config: ExperianConfig;
  credential: ExperianCredential;
}) {
  if (!input.credential.refreshToken) {
    throw new TokMetricError(
      409,
      "EXPERIAN_REAUTHORIZATION_REQUIRED",
      "Experian requires authorization again because no refresh credential is available.",
    );
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.credential.refreshToken,
    client_id: input.config.clientId,
  });
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (input.config.tokenClientAuthentication === "BASIC") {
    body.delete("client_id");
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${input.config.clientId}:${input.config.clientSecret}`).toString("base64")}`,
    );
  } else {
    body.set("client_secret", input.config.clientSecret);
  }
  let response: Response;
  try {
    response = await fetch(requireExperianUrl(input.config.tokenUrl, "Experian token URL"), {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TokMetricError(
      503,
      "EXPERIAN_TOKEN_SERVICE_UNAVAILABLE",
      "Experian token service is temporarily unavailable.",
    );
  }
  const refreshed = await parseTokenResponse(response, input.credential.grantedScopes);
  return {
    ...refreshed,
    refreshToken: refreshed.refreshToken || input.credential.refreshToken,
    refreshExpiresAt: refreshed.refreshExpiresAt || input.credential.refreshExpiresAt,
    tokenSubject: refreshed.tokenSubject || input.credential.tokenSubject,
  } satisfies ExperianCredential;
}

function valueAtPath(payload: unknown, path: string) {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, payload);
}

export async function verifyExperianRead(input: {
  config: ExperianConfig;
  credential: ExperianCredential;
}) {
  let response: Response;
  try {
    response = await fetch(requireExperianUrl(input.config.identityUrl, "Experian identity URL"), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `${input.credential.tokenType} ${input.credential.accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TokMetricError(
      503,
      "EXPERIAN_READ_TEST_UNAVAILABLE",
      "Experian read verification is temporarily unavailable.",
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new TokMetricError(
      response.status === 401 || response.status === 403 ? 401 : 502,
      "EXPERIAN_READ_TEST_FAILED",
      "Experian did not confirm the configured read access.",
    );
  }
  const identityValue =
    stringValue(valueAtPath(payload, input.config.identityIdPath)) || input.credential.tokenSubject;
  if (!identityValue) {
    throw new TokMetricError(
      502,
      "EXPERIAN_IDENTITY_NOT_VERIFIED",
      "Experian read verification succeeded but did not return a verifiable account identity.",
    );
  }
  return {
    externalAccountReference: opaqueExperianReference(identityValue),
    displayLabel: `Experian ${input.config.environment} API account`,
    responseDigest: experianResponseDigest(payload),
    verifiedAt: new Date().toISOString(),
  };
}

export async function revokeExperianCredential(input: {
  config: ExperianConfig;
  credential: ExperianCredential;
}) {
  if (!input.config.revokeUrl) return { attempted: false, revoked: false };
  const body = new URLSearchParams({
    token: input.credential.refreshToken || input.credential.accessToken,
    client_id: input.config.clientId,
  });
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
  if (input.config.tokenClientAuthentication === "BASIC") {
    body.delete("client_id");
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${input.config.clientId}:${input.config.clientSecret}`).toString("base64")}`,
    );
  } else {
    body.set("client_secret", input.config.clientSecret);
  }
  let response: Response;
  try {
    response = await fetch(requireExperianUrl(input.config.revokeUrl, "Experian revoke URL"), {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TokMetricError(
      503,
      "EXPERIAN_REVOCATION_UNAVAILABLE",
      "Experian credential revocation is temporarily unavailable.",
    );
  }
  if (!response.ok) {
    throw new TokMetricError(
      502,
      "EXPERIAN_REVOCATION_FAILED",
      "Experian did not confirm credential revocation.",
    );
  }
  return { attempted: true, revoked: true };
}
