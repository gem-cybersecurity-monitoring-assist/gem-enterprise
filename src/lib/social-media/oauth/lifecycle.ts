import type { SocialOAuthProviderConfig } from "./config";
import type { StoredSocialCredential } from "./store";

const EXPIRING_WINDOW_MS = 10 * 60 * 1000;

export type SocialCredentialLifecycle =
  | "HEALTHY"
  | "EXPIRING"
  | "EXPIRED_REFRESHABLE"
  | "REAUTHORIZATION_REQUIRED"
  | "EXPIRY_UNKNOWN";

export interface SocialCredentialLifecycleResult {
  lifecycle: SocialCredentialLifecycle;
  connectorState: "CONNECTED" | "DEGRADED" | "TOKEN_EXPIRED" | "REAUTHORIZATION_REQUIRED";
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  refreshTokenPresent: boolean;
  refreshSupported: boolean;
  shouldRefresh: boolean;
}

function timestamp(value?: string) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function evaluateSocialCredentialLifecycle(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
  now = Date.now(),
): SocialCredentialLifecycleResult {
  const expiresAt = timestamp(credential.expiresAt);
  const refreshExpiresAt = timestamp(credential.refreshExpiresAt);
  const refreshTokenPresent = Boolean(credential.refreshToken);
  const refreshSupported = config.refreshMode === "STANDARD";
  const refreshUsable =
    refreshSupported &&
    refreshTokenPresent &&
    (refreshExpiresAt === undefined || refreshExpiresAt > now);

  if (expiresAt === undefined) {
    return {
      lifecycle: "EXPIRY_UNKNOWN",
      connectorState: "DEGRADED",
      expiresAt: credential.expiresAt || null,
      refreshExpiresAt: credential.refreshExpiresAt || null,
      refreshTokenPresent,
      refreshSupported,
      shouldRefresh: false,
    };
  }

  if (expiresAt > now + EXPIRING_WINDOW_MS) {
    return {
      lifecycle: "HEALTHY",
      connectorState: "CONNECTED",
      expiresAt: credential.expiresAt || null,
      refreshExpiresAt: credential.refreshExpiresAt || null,
      refreshTokenPresent,
      refreshSupported,
      shouldRefresh: false,
    };
  }

  if (expiresAt > now) {
    return {
      lifecycle: "EXPIRING",
      connectorState: refreshUsable ? "DEGRADED" : "REAUTHORIZATION_REQUIRED",
      expiresAt: credential.expiresAt || null,
      refreshExpiresAt: credential.refreshExpiresAt || null,
      refreshTokenPresent,
      refreshSupported,
      shouldRefresh: refreshUsable,
    };
  }

  if (refreshUsable) {
    return {
      lifecycle: "EXPIRED_REFRESHABLE",
      connectorState: "TOKEN_EXPIRED",
      expiresAt: credential.expiresAt || null,
      refreshExpiresAt: credential.refreshExpiresAt || null,
      refreshTokenPresent,
      refreshSupported,
      shouldRefresh: true,
    };
  }

  return {
    lifecycle: "REAUTHORIZATION_REQUIRED",
    connectorState: "REAUTHORIZATION_REQUIRED",
    expiresAt: credential.expiresAt || null,
    refreshExpiresAt: credential.refreshExpiresAt || null,
    refreshTokenPresent,
    refreshSupported,
    shouldRefresh: false,
  };
}
