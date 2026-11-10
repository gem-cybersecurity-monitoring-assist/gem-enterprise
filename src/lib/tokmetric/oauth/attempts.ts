import crypto from "node:crypto";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { decryptCredential, encryptCredential } from "./crypto";
import { getTikTokOAuthConfig, connectorProviders, type TikTokEnvironment, type TokMetricConnectorProvider } from "./config";
import { type OAuthStatePayload } from "./state";
import { validateTikTokShopConfig } from "@/lib/tokmetric/shop/config";

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

export function createAuthorizationNonce() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createOAuthAuthorizationAttempt(input: { workspaceId: string; actorId: string; provider: TokMetricConnectorProvider; environment: TikTokEnvironment; codeVerifier: string }, database = db) {
  const nonce = createAuthorizationNonce();
  const encryptedCodeVerifier = encryptCredential({ codeVerifier: input.codeVerifier });
  const attempt = await database.oAuthAuthorizationAttempt.create({
    data: {
      nonce,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      provider: input.provider,
      environment: input.environment,
      encryptedCodeVerifier,
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    },
  });
  return attempt;
}

export async function consumeOAuthAuthorizationAttempt(state: OAuthStatePayload, database = db) {
  const { config, ok } = await import("./config").then((module) => module.validateTikTokOAuthConfig());
  if (!ok) throw new TokMetricError(503, "TOKMETRIC_OAUTH_NOT_CONFIGURED", "TikTok OAuth configuration is no longer valid.");
  if (config.environment !== state.environment) throw new TokMetricError(401, "OAUTH_ENVIRONMENT_MISMATCH", "OAuth environment changed before callback completed.");
  if (!connectorProviders.includes(state.provider)) throw new TokMetricError(400, "UNSUPPORTED_CONNECTOR_PROVIDER", "Connector provider is not supported.");

  const attempt = await database.oAuthAuthorizationAttempt.findUnique({ where: { nonce: state.nonce } });
  if (!attempt) throw new TokMetricError(401, "OAUTH_ATTEMPT_NOT_FOUND", "OAuth authorization attempt was not found.");
  if (attempt.consumedAt) throw new TokMetricError(401, "OAUTH_ATTEMPT_CONSUMED", "OAuth authorization attempt was already consumed.");
  if (attempt.expiresAt.getTime() <= Date.now()) throw new TokMetricError(401, "OAUTH_ATTEMPT_EXPIRED", "OAuth authorization attempt expired.");
  if (attempt.workspaceId !== state.workspaceId || attempt.actorId !== state.actorId || attempt.provider !== state.provider || attempt.environment !== state.environment) {
    throw new TokMetricError(401, "OAUTH_ATTEMPT_MISMATCH", "OAuth authorization attempt did not match state.");
  }
  if (attempt.environment !== getTikTokOAuthConfig().environment) throw new TokMetricError(401, "OAUTH_ENVIRONMENT_MISMATCH", "OAuth environment changed before callback completed.");

  const consumed = await database.oAuthAuthorizationAttempt.updateMany({ where: { id: attempt.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw new TokMetricError(401, "OAUTH_ATTEMPT_CONSUMED", "OAuth authorization attempt was already consumed.");
  const decrypted = decryptCredential<{ codeVerifier: string }>(attempt.encryptedCodeVerifier);
  return { attempt, codeVerifier: decrypted.codeVerifier };
}

export async function consumeTikTokShopAuthorizationAttempt(state: OAuthStatePayload) {
  const { config, ok } = validateTikTokShopConfig();
  if (!ok) throw new TokMetricError(503, "TIKTOK_SHOP_OAUTH_NOT_CONFIGURED", "TikTok Shop OAuth configuration is no longer valid.");
  if (state.provider !== "TIKTOK_SHOP_SELLER") throw new TokMetricError(400, "UNSUPPORTED_CONNECTOR_PROVIDER", "A TikTok Shop seller authorization is required.");
  if (config.environment !== state.environment) throw new TokMetricError(401, "OAUTH_ENVIRONMENT_MISMATCH", "TikTok Shop environment changed before callback completed.");
  const attempt = await db.oAuthAuthorizationAttempt.findUnique({ where: { nonce: state.nonce } });
  if (!attempt) throw new TokMetricError(401, "OAUTH_ATTEMPT_NOT_FOUND", "OAuth authorization attempt was not found.");
  if (attempt.consumedAt) throw new TokMetricError(401, "OAUTH_ATTEMPT_CONSUMED", "OAuth authorization attempt was already consumed.");
  if (attempt.expiresAt.getTime() <= Date.now()) throw new TokMetricError(401, "OAUTH_ATTEMPT_EXPIRED", "OAuth authorization attempt expired.");
  if (attempt.workspaceId !== state.workspaceId || attempt.actorId !== state.actorId || attempt.provider !== state.provider || attempt.environment !== state.environment) {
    throw new TokMetricError(401, "OAUTH_ATTEMPT_MISMATCH", "OAuth authorization attempt did not match state.");
  }
  const consumed = await db.oAuthAuthorizationAttempt.updateMany({ where: { id: attempt.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw new TokMetricError(401, "OAUTH_ATTEMPT_CONSUMED", "OAuth authorization attempt was already consumed.");
  return attempt;
}
