import { TokMetricError } from "@/lib/tokmetric/security";

export const experianAuthModes = ["DEVELOPER_PASSWORD", "AUTHORIZATION_CODE"] as const;
export type ExperianAuthMode = (typeof experianAuthModes)[number];
export type ExperianEnvironment = "sandbox" | "uat" | "production";

export interface ExperianConfig {
  enabled: boolean;
  environment: ExperianEnvironment;
  authMode: ExperianAuthMode;
  clientId: string;
  clientSecret: string;
  tokenClientAuthentication: "BODY" | "BASIC";
  developerUsername: string;
  developerPassword: string;
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl: string;
  redirectUri: string;
  scopes: string[];
  identityUrl: string;
  identityIdPath: string;
  approvedCapabilities: string[];
  consumerDelegationApproved: boolean;
}

function value(name: string) {
  return process.env[name]?.trim() || "";
}

function enabled(name: string) {
  return value(name).toLowerCase() === "true";
}

function list(name: string) {
  return value(name)
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function environment(): ExperianEnvironment {
  const candidate = value("EXPERIAN_ENVIRONMENT").toLowerCase();
  if (candidate === "uat" || candidate === "production") return candidate;
  return "sandbox";
}

function authMode(): ExperianAuthMode {
  const candidate = value("EXPERIAN_AUTH_MODE").toUpperCase();
  if (candidate === "AUTHORIZATION_CODE") return candidate;
  return "DEVELOPER_PASSWORD";
}

function tokenClientAuthentication() {
  return value("EXPERIAN_TOKEN_CLIENT_AUTHENTICATION").toUpperCase() === "BASIC"
    ? ("BASIC" as const)
    : ("BODY" as const);
}

function defaultTokenUrl(target: ExperianEnvironment) {
  return target === "sandbox" ? "https://sandbox-us-api.experian.com/oauth2/v1/token" : "";
}

export function isExperianUrl(candidate: string) {
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "experian.com" || host.endsWith(".experian.com"));
  } catch {
    return false;
  }
}

export function requireExperianUrl(candidate: string, label: string) {
  if (!isExperianUrl(candidate)) {
    throw new TokMetricError(
      503,
      "EXPERIAN_ENDPOINT_INVALID",
      `${label} must be an HTTPS endpoint on an experian.com host.`,
    );
  }
  return candidate;
}

export function getExperianConfig(): ExperianConfig {
  const target = environment();
  return {
    enabled: enabled("EXPERIAN_CONNECTION_ENABLED"),
    environment: target,
    authMode: authMode(),
    clientId: value("EXPERIAN_CLIENT_ID"),
    clientSecret: value("EXPERIAN_CLIENT_SECRET"),
    tokenClientAuthentication: tokenClientAuthentication(),
    developerUsername: value("EXPERIAN_DEVELOPER_USERNAME"),
    developerPassword: value("EXPERIAN_DEVELOPER_PASSWORD"),
    authorizationUrl: value("EXPERIAN_AUTHORIZATION_URL"),
    tokenUrl: value("EXPERIAN_TOKEN_URL") || defaultTokenUrl(target),
    revokeUrl: value("EXPERIAN_REVOKE_URL"),
    redirectUri: value("EXPERIAN_REDIRECT_URI"),
    scopes: list("EXPERIAN_SCOPES"),
    identityUrl: value("EXPERIAN_IDENTITY_URL"),
    identityIdPath: value("EXPERIAN_IDENTITY_ID_PATH"),
    approvedCapabilities: list("EXPERIAN_APPROVED_CAPABILITIES"),
    consumerDelegationApproved: enabled("EXPERIAN_CONSUMER_DELEGATION_APPROVED"),
  };
}

export function validateExperianConfig() {
  const config = getExperianConfig();
  const missing: string[] = [];

  if (!config.enabled) missing.push("EXPERIAN_CONNECTION_ENABLED");
  if (!config.clientId) missing.push("EXPERIAN_CLIENT_ID");
  if (!config.clientSecret) missing.push("EXPERIAN_CLIENT_SECRET");
  if (!config.tokenUrl || !isExperianUrl(config.tokenUrl)) missing.push("EXPERIAN_TOKEN_URL");
  if (!config.identityUrl || !isExperianUrl(config.identityUrl)) missing.push("EXPERIAN_IDENTITY_URL");
  if (!value("EXPERIAN_TOKEN_ENCRYPTION_KEY")) missing.push("EXPERIAN_TOKEN_ENCRYPTION_KEY");

  if (config.authMode === "DEVELOPER_PASSWORD") {
    if (!config.developerUsername) missing.push("EXPERIAN_DEVELOPER_USERNAME");
    if (!config.developerPassword) missing.push("EXPERIAN_DEVELOPER_PASSWORD");
  } else {
    if (!config.consumerDelegationApproved) missing.push("EXPERIAN_CONSUMER_DELEGATION_APPROVED");
    if (!config.authorizationUrl || !isExperianUrl(config.authorizationUrl)) {
      missing.push("EXPERIAN_AUTHORIZATION_URL");
    }
    if (!config.redirectUri) missing.push("EXPERIAN_REDIRECT_URI");
    if (config.scopes.length === 0) missing.push("EXPERIAN_SCOPES");
    if (!["BODY", "BASIC"].includes(value("EXPERIAN_TOKEN_CLIENT_AUTHENTICATION").toUpperCase())) {
      missing.push("EXPERIAN_TOKEN_CLIENT_AUTHENTICATION");
    }
  }

  return { config, missing: [...new Set(missing)], ok: missing.length === 0 };
}

export function requireExperianConfig() {
  const result = validateExperianConfig();
  if (!result.ok) {
    throw new TokMetricError(
      503,
      "EXPERIAN_NOT_CONFIGURED",
      `Experian connection is not configured: ${result.missing.join(", ")}`,
    );
  }
  return result.config;
}

export function getSafeExperianReadiness() {
  const { config, missing, ok } = validateExperianConfig();
  return {
    configured: ok,
    environment: config.environment,
    authMode: config.authMode,
    missing,
    consumerDelegationApproved: config.consumerDelegationApproved,
    approvedCapabilities: config.approvedCapabilities,
  };
}
