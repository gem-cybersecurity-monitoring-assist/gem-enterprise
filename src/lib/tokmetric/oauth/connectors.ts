import { db } from "@/lib/db";
import { TokMetricError, emitTokMetricAudit, enforceEmergencyLocks } from "@/lib/tokmetric/security";
import { decryptCredential, encryptCredential } from "./crypto";
import { getTikTokOAuthConfig, isPlatformApprovalRequired, providerScopes, validateTikTokOAuthConfig, type TikTokEnvironment, type TokMetricConnectorProvider } from "./config";
import { refreshTikTokToken, revokeTikTokToken, safeTokenMetadata, type TikTokTokenResponse } from "./client";

export interface StoredTikTokCredential {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  environment: TikTokEnvironment;
  provider: TokMetricConnectorProvider;
  grantedScopes: string[];
  externalAccountId?: string;
}

function referenceTypeFor(environment: TikTokEnvironment) {
  return `oauth:${environment}`;
}

function mergeCredential(input: { existing?: StoredTikTokCredential; token: TikTokTokenResponse; provider: TokMetricConnectorProvider; environment: TikTokEnvironment }) {
  const metadata = safeTokenMetadata(input.token, input.provider, input.environment);
  return {
    credential: {
      accessToken: input.token.access_token,
      refreshToken: input.token.refresh_token || input.existing?.refreshToken,
      expiresAt: input.token.expires_in ? new Date(Date.now() + input.token.expires_in * 1000).toISOString() : input.existing?.expiresAt,
      refreshExpiresAt: input.token.refresh_expires_in ? new Date(Date.now() + input.token.refresh_expires_in * 1000).toISOString() : input.existing?.refreshExpiresAt,
      environment: input.environment,
      provider: input.provider,
      grantedScopes: metadata.grantedScopes,
      externalAccountId: metadata.externalAccountId ?? input.existing?.externalAccountId,
    } satisfies StoredTikTokCredential,
    metadata,
  };
}

export function connectorDefaults() {
  const { ok, missing, config } = validateTikTokOAuthConfig();
  return (Object.keys(providerScopes) as TokMetricConnectorProvider[]).map((provider) => ({
    provider,
    displayName: providerDisplayName(provider),
    requiredScopes: providerScopes[provider],
    environment: config.environment,
    state: isPlatformApprovalRequired(provider) ? "PLATFORM_APPROVAL_REQUIRED" : ok ? "AUTHORIZATION_REQUIRED" : "NOT_CONFIGURED",
    configurationMissing: isPlatformApprovalRequired(provider) ? [] : missing,
  }));
}

export function providerDisplayName(provider: TokMetricConnectorProvider) {
  return {
    TIKTOK_LOGIN_KIT: "TikTok Organic / Login Kit",
    TIKTOK_DISPLAY_API: "TikTok Display API",
    TIKTOK_CONTENT_POSTING_API: "TikTok Content Posting API",
    TIKTOK_BUSINESS_API: "TikTok Business API",
    TIKTOK_SHOP_SELLER: "TikTok Shop Seller",
    TIKTOK_SHOP_CREATOR: "TikTok Shop Creator/Affiliate",
  }[provider];
}

export async function listWorkspaceConnectors(workspaceId: string, database = db) {
  const persisted = await database.connector.findMany({ where: { workspaceId }, include: { credentialReferences: true }, orderBy: { createdAt: "asc" } });
  const defaults = connectorDefaults();
  return defaults.map((item) => {
    const matches = persisted.filter((connector) => connector.provider === item.provider);
    if (matches.length === 0) return { ...item, id: null, accounts: [] };
    return {
      ...item,
      state: matches.some((connector) => connector.state === "CONNECTED") ? "CONNECTED" : matches[0].state,
      accounts: matches.map((connector) => ({
        id: connector.id,
        displayName: connector.displayName,
        state: connector.state,
        externalAccountId: connector.externalAccountId,
        grantedScopes: connector.grantedScopes,
        lastHealthAt: connector.lastHealthAt,
        disabledAt: connector.disabledAt,
      })),
    };
  });
}

export async function persistAuthorizedConnector(input: { workspaceId: string; actorId?: string; provider: TokMetricConnectorProvider; token: TikTokTokenResponse; correlationId: string; existingCredential?: StoredTikTokCredential }, scopedDatabase?: typeof db) {
  const database = scopedDatabase ?? db;
  await enforceEmergencyLocks(input.workspaceId, "connector", scopedDatabase);
  const config = getTikTokOAuthConfig();
  const { credential, metadata } = mergeCredential({ existing: input.existingCredential, token: input.token, provider: input.provider, environment: config.environment });
  const encrypted = encryptCredential(credential);

  const connector = await database.connector.upsert({
    where: { workspaceId_provider_externalAccountId: { workspaceId: input.workspaceId, provider: input.provider, externalAccountId: credential.externalAccountId ?? "default" } },
    update: { state: "CONNECTED", displayName: providerDisplayName(input.provider), grantedScopes: credential.grantedScopes, lastHealthAt: new Date(), disabledAt: null },
    create: { workspaceId: input.workspaceId, provider: input.provider, state: "CONNECTED", displayName: providerDisplayName(input.provider), externalAccountId: credential.externalAccountId ?? "default", grantedScopes: credential.grantedScopes, lastHealthAt: new Date() },
  });

  await database.connectorCredentialReference.upsert({
    where: { connectorId_referenceType: { connectorId: connector.id, referenceType: referenceTypeFor(config.environment) } },
    update: { secretRef: encrypted, expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : undefined, rotatedAt: new Date() },
    create: { connectorId: connector.id, referenceType: referenceTypeFor(config.environment), secretRef: encrypted, expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : undefined },
  });
  await emitTokMetricAudit({ workspaceId: input.workspaceId, actorId: input.actorId, action: "tokmetric.connector.authorized", entityType: "connector", entityId: connector.id, correlationId: input.correlationId, outcome: "success", sourceChannel: "website", metadata }, scopedDatabase);
  return connector;
}

async function loadEnvironmentCredential(connectorId: string, environment: TikTokEnvironment, database = db) {
  const ref = await database.connectorCredentialReference.findUnique({ where: { connectorId_referenceType: { connectorId, referenceType: referenceTypeFor(environment) } } });
  if (!ref) throw new TokMetricError(409, "REAUTHORIZATION_REQUIRED", "Connector requires reauthorization for the active TikTok environment.");
  return { ref, stored: decryptCredential<StoredTikTokCredential>(ref.secretRef) };
}

export async function getAuthorizedTikTokCredential(input: {
  workspaceId: string;
  connectorId: string;
  requiredScope: "video.publish" | "video.upload" | "user.info.basic";
  actorId?: string;
  correlationId: string;
}) {
  const connector = await db.connector.findFirst({
    where: {
      id: input.connectorId,
      workspaceId: input.workspaceId,
      provider: "TIKTOK_CONTENT_POSTING_API",
      state: "CONNECTED",
      disabledAt: null,
    },
  });
  if (!connector) throw new TokMetricError(409, "CONNECTOR_NOT_READY", "A connected TikTok Content Posting connector is required.");

  const config = getTikTokOAuthConfig();
  let loaded = await loadEnvironmentCredential(connector.id, config.environment);
  const expiresAt = loaded.stored.expiresAt ? new Date(loaded.stored.expiresAt).getTime() : null;
  const expiresSoon = expiresAt !== null && expiresAt <= Date.now() + 60_000;

  if (expiresSoon) {
    if (!loaded.stored.refreshToken) {
      await db.connector.update({ where: { id: connector.id }, data: { state: "TOKEN_EXPIRED", lastHealthAt: new Date() } });
      throw new TokMetricError(409, "REAUTHORIZATION_REQUIRED", "TikTok authorization has expired and must be renewed.");
    }
    const token = await refreshTikTokToken(loaded.stored.refreshToken);
    await persistAuthorizedConnector({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      provider: connector.provider,
      token,
      correlationId: input.correlationId,
      existingCredential: loaded.stored,
    });
    loaded = await loadEnvironmentCredential(connector.id, config.environment);
  }

  const granted = new Set([...connector.grantedScopes, ...loaded.stored.grantedScopes]);
  if (!granted.has(input.requiredScope)) {
    throw new TokMetricError(403, "TIKTOK_SCOPE_NOT_AUTHORIZED", `TikTok scope ${input.requiredScope} is required.`);
  }

  return {
    connector,
    accessToken: loaded.stored.accessToken,
    environment: loaded.stored.environment,
    externalAccountId: loaded.stored.externalAccountId ?? connector.externalAccountId,
    grantedScopes: [...granted],
  };
}

export async function refreshConnector(input: { workspaceId: string; connectorId: string; actorId?: string; correlationId: string }) {
  const connector = await db.connector.findFirst({ where: { id: input.connectorId, workspaceId: input.workspaceId } });
  if (!connector) throw new TokMetricError(404, "CONNECTOR_NOT_FOUND", "Connector was not found.");
  const config = getTikTokOAuthConfig();
  let loaded: Awaited<ReturnType<typeof loadEnvironmentCredential>>;
  try {
    loaded = await loadEnvironmentCredential(connector.id, config.environment);
    if (!loaded.stored.refreshToken) throw new TokMetricError(409, "REAUTHORIZATION_REQUIRED", "Connector does not have a refresh token.");
  } catch (error) {
    await db.connector.update({ where: { id: connector.id }, data: { state: "REAUTHORIZATION_REQUIRED" } });
    throw error;
  }
  try {
    const token = await refreshTikTokToken(loaded.stored.refreshToken);
    await persistAuthorizedConnector({ workspaceId: input.workspaceId, actorId: input.actorId, provider: connector.provider, token, correlationId: input.correlationId, existingCredential: loaded.stored });
    await emitTokMetricAudit({ workspaceId: input.workspaceId, actorId: input.actorId, action: "tokmetric.connector.refresh", entityType: "connector", entityId: connector.id, correlationId: input.correlationId, outcome: "success", sourceChannel: "website" });
  } catch (error) {
    await db.connector.update({ where: { id: connector.id }, data: { state: "REAUTHORIZATION_REQUIRED" } });
    await emitTokMetricAudit({ workspaceId: input.workspaceId, actorId: input.actorId, action: "tokmetric.connector.refresh", entityType: "connector", entityId: connector.id, correlationId: input.correlationId, outcome: "failure", sourceChannel: "website" });
    throw error;
  }
}

export async function disconnectConnector(input: { workspaceId: string; connectorId: string; actorId: string; correlationId: string; revoke?: boolean }, scopedDatabase?: typeof db) {
  const database = scopedDatabase ?? db;
  const connector = await database.connector.findFirst({ where: { id: input.connectorId, workspaceId: input.workspaceId } });
  if (!connector) throw new TokMetricError(404, "CONNECTOR_NOT_FOUND", "Connector was not found.");
  const config = getTikTokOAuthConfig();
  if (input.revoke) {
    const { stored } = await loadEnvironmentCredential(connector.id, config.environment, database);
    await revokeTikTokToken(stored.accessToken);
  }
  await database.connector.update({ where: { id: connector.id }, data: { state: input.revoke ? "DISCONNECTED" : "AUTHORIZATION_REQUIRED", disabledAt: new Date() } });
  await database.connectorCredentialReference.deleteMany({ where: { connectorId: connector.id, referenceType: referenceTypeFor(config.environment) } });
  await emitTokMetricAudit({ workspaceId: input.workspaceId, actorId: input.actorId, action: input.revoke ? "tokmetric.connector.revoked" : "tokmetric.connector.disconnected", entityType: "connector", entityId: connector.id, correlationId: input.correlationId, outcome: "success", sourceChannel: "website" }, scopedDatabase);
}

export async function updateConnectorHealth(workspaceId: string) {
  const config = getTikTokOAuthConfig();
  const now = new Date();
  const connectors = await db.connector.findMany({ where: { workspaceId } });
  for (const connector of connectors) {
    const ref = await db.connectorCredentialReference.findUnique({ where: { connectorId_referenceType: { connectorId: connector.id, referenceType: referenceTypeFor(config.environment) } } });
    if (!ref) {
      await db.connector.update({ where: { id: connector.id }, data: { state: "REAUTHORIZATION_REQUIRED", lastHealthAt: now } });
      continue;
    }
    if (ref.expiresAt && ref.expiresAt.getTime() < now.getTime()) {
      await db.connector.update({ where: { id: connector.id }, data: { state: "TOKEN_EXPIRED", lastHealthAt: now } });
      continue;
    }
    await db.connector.update({ where: { id: connector.id }, data: { lastHealthAt: now } });
  }
}
