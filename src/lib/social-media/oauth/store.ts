import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  GatewayRequestError,
  shouldUseSupabaseGateway,
} from "@/lib/supabase-gateway";
import { socialPublishingGateway } from "@/lib/social-media/publishing/gateway-client";
import { enforceEmergencyLocks, TokMetricError } from "@/lib/tokmetric/security";
import { decryptSocialCredential, encryptSocialCredential } from "./crypto";
import { parseSocialConnectorProvider } from "./config";
import type {
  SocialBotTokenProvider,
  SocialConnectorProvider,
  SocialOAuthProvider,
} from "./config";
import type { SocialOAuthStatePayload } from "./state";

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

export interface SocialOAuthAttemptRecord {
  id: string;
  nonce: string;
  workspaceId: string;
  actorId: string;
  provider: SocialOAuthProvider;
  encryptedCodeVerifier: string | null;
  requestedScopes: string[];
  redirectUri: string;
  redirectAfter: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface StoredSocialCredential {
  provider: SocialConnectorProvider;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  grantedScopes: string[];
  externalAccountId?: string;
}

export interface SocialConnectorRecord {
  id: string;
  workspaceId: string;
  provider: SocialConnectorProvider;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  grantedScopes: string[];
  safeMetadata: Record<string, unknown>;
  lastHealthAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function isMissingStore(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    (text.includes("social_connectors") ||
      text.includes("social_connector_credentials") ||
      text.includes("social_oauth_authorization_attempts")) &&
    (text.includes("does not exist") || text.includes("42p01") || text.includes("p2010"))
  );
}

function storeUnavailable(error: unknown): never {
  if (isMissingStore(error)) {
    throw new TokMetricError(
      503,
      "SOCIAL_OAUTH_STORE_NOT_PROVISIONED",
      "The social connector authorization store has not been provisioned.",
    );
  }
  throw error;
}

function normalizeRedirectAfter(value?: string) {
  const candidate = value?.trim() || "/app/command-center/social-media";
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    throw new TokMetricError(400, "INVALID_REDIRECT_TARGET", "Redirect target must be a local application path.");
  }
  return candidate;
}

export async function createSocialOAuthAuthorizationAttempt(input: {
  nonce: string;
  workspaceId: string;
  actorId: string;
  provider: SocialOAuthProvider;
  codeVerifier?: string;
  requestedScopes: string[];
  redirectUri: string;
  redirectAfter?: string;
}, database = db) {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_MS);
  const encryptedCodeVerifier = input.codeVerifier
    ? encryptSocialCredential({ codeVerifier: input.codeVerifier })
    : null;
  const redirectAfter = normalizeRedirectAfter(input.redirectAfter);

  try {
    const rows = await database.$queryRaw<SocialOAuthAttemptRecord[]>(Prisma.sql`
      INSERT INTO social_oauth_authorization_attempts (
        id,
        nonce,
        workspace_id,
        actor_id,
        provider,
        encrypted_code_verifier,
        requested_scopes,
        redirect_uri,
        redirect_after,
        expires_at,
        created_at
      ) VALUES (
        ${id},
        ${input.nonce},
        ${input.workspaceId},
        ${input.actorId},
        ${input.provider},
        ${encryptedCodeVerifier},
        ${input.requestedScopes},
        ${input.redirectUri},
        ${redirectAfter},
        ${expiresAt},
        ${now}
      )
      RETURNING
        id,
        nonce,
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        provider,
        encrypted_code_verifier AS "encryptedCodeVerifier",
        requested_scopes AS "requestedScopes",
        redirect_uri AS "redirectUri",
        redirect_after AS "redirectAfter",
        expires_at AS "expiresAt",
        consumed_at AS "consumedAt",
        created_at AS "createdAt"
    `);
    if (!rows[0]) throw new Error("Social OAuth attempt was not returned after creation.");
    return rows[0];
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function consumeSocialOAuthAuthorizationAttempt(state: SocialOAuthStatePayload, database = db) {
  try {
    const rows = await database.$queryRaw<SocialOAuthAttemptRecord[]>(Prisma.sql`
      UPDATE social_oauth_authorization_attempts
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE nonce = ${state.nonce}
        AND workspace_id = ${state.workspaceId}
        AND actor_id = ${state.actorId}
        AND provider = ${state.provider}
        AND consumed_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      RETURNING
        id,
        nonce,
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        provider,
        encrypted_code_verifier AS "encryptedCodeVerifier",
        requested_scopes AS "requestedScopes",
        redirect_uri AS "redirectUri",
        redirect_after AS "redirectAfter",
        expires_at AS "expiresAt",
        consumed_at AS "consumedAt",
        created_at AS "createdAt"
    `);
    const attempt = rows[0];
    if (!attempt) {
      throw new TokMetricError(
        401,
        "SOCIAL_OAUTH_ATTEMPT_INVALID",
        "Social OAuth authorization attempt is missing, expired, mismatched, or already consumed.",
      );
    }
    const codeVerifier = attempt.encryptedCodeVerifier
      ? decryptSocialCredential<{ codeVerifier: string }>(attempt.encryptedCodeVerifier).codeVerifier
      : undefined;
    return { attempt, codeVerifier };
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function persistSocialConnector(input: {
  workspaceId: string;
  provider: SocialOAuthProvider;
  displayName: string;
  credential: StoredSocialCredential;
  safeMetadata?: Record<string, unknown>;
}) {
  await enforceEmergencyLocks(input.workspaceId, "connector");

  const connectorId = randomUUID();
  const credentialId = randomUUID();
  const now = new Date();
  const externalAccountKey = input.credential.externalAccountId || "default";
  const encrypted = encryptSocialCredential(input.credential);
  const expiresAt = input.credential.expiresAt ? new Date(input.credential.expiresAt) : null;
  const refreshExpiresAt = input.credential.refreshExpiresAt
    ? new Date(input.credential.refreshExpiresAt)
    : null;

  try {
    return await db.$transaction(async (transaction) => {
      const connectors = await transaction.$queryRaw<SocialConnectorRecord[]>(Prisma.sql`
        INSERT INTO social_connectors (
          id,
          workspace_id,
          provider,
          state,
          display_name,
          external_account_key,
          external_account_id,
          granted_scopes,
          safe_metadata,
          last_health_at,
          created_at,
          updated_at
        ) VALUES (
          ${connectorId},
          ${input.workspaceId},
          ${input.provider},
          'CONNECTED',
          ${input.displayName},
          ${externalAccountKey},
          ${input.credential.externalAccountId ?? null},
          ${input.credential.grantedScopes},
          CAST(${JSON.stringify(input.safeMetadata ?? {})} AS jsonb),
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT (workspace_id, provider, external_account_key)
        DO UPDATE SET
          state = 'CONNECTED',
          display_name = EXCLUDED.display_name,
          external_account_id = EXCLUDED.external_account_id,
          granted_scopes = EXCLUDED.granted_scopes,
          safe_metadata = EXCLUDED.safe_metadata,
          disabled_at = NULL,
          last_health_at = EXCLUDED.last_health_at,
          updated_at = EXCLUDED.updated_at
        RETURNING
          id,
          workspace_id AS "workspaceId",
          provider,
          state,
          display_name AS "displayName",
          external_account_id AS "externalAccountId",
          granted_scopes AS "grantedScopes",
          safe_metadata AS "safeMetadata",
          last_health_at AS "lastHealthAt",
          disabled_at AS "disabledAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `);
      const connector = connectors[0];
      if (!connector) throw new Error("Social connector was not returned after persistence.");

      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO social_connector_credentials (
          id,
          connector_id,
          reference_type,
          secret_ref,
          expires_at,
          refresh_expires_at,
          rotated_at,
          created_at,
          updated_at
        ) VALUES (
          ${credentialId},
          ${connector.id},
          'oauth:production',
          ${encrypted},
          ${expiresAt},
          ${refreshExpiresAt},
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT (connector_id, reference_type)
        DO UPDATE SET
          secret_ref = EXCLUDED.secret_ref,
          expires_at = EXCLUDED.expires_at,
          refresh_expires_at = EXCLUDED.refresh_expires_at,
          rotated_at = EXCLUDED.rotated_at,
          updated_at = EXCLUDED.updated_at
      `);
      return connector;
    });
  } catch (error) {
    return storeUnavailable(error);
  }
}

// Gateway errors keep the edge function's status + stable code (so a 409
// SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT from the RPC survives the hop
// instead of becoming a generic 500).
function gatewayError(error: unknown): never {
  if (error instanceof GatewayRequestError) {
    throw new TokMetricError(error.statusCode, error.code, error.message);
  }
  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// Row shape the gem_social_create_connector RPC returns (JSON: camelCase
// keys, ISO timestamp strings). Mirrors SocialConnectorRecord so the
// gateway branch returns the same record the Prisma branch returns.
function reviveConnectorRecord(raw: Record<string, unknown>): SocialConnectorRecord {
  const createdAt = toDate(raw.createdAt);
  const updatedAt = toDate(raw.updatedAt);
  if (!createdAt || !updatedAt) {
    throw new TokMetricError(
      500,
      "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
      "The social publishing gateway returned an unexpected response.",
    );
  }
  return {
    id: String(raw.id ?? ""),
    workspaceId: String(raw.workspaceId ?? ""),
    provider: parseSocialConnectorProvider(String(raw.provider ?? "")),
    state: String(raw.state ?? ""),
    displayName: String(raw.displayName ?? ""),
    externalAccountId: toNullableString(raw.externalAccountId),
    grantedScopes: Array.isArray(raw.grantedScopes)
      ? (raw.grantedScopes.filter(
          (entry): entry is string => typeof entry === "string",
        ) as string[])
      : [],
    safeMetadata: isRecord(raw.safeMetadata) ? raw.safeMetadata : {},
    lastHealthAt: toDate(raw.lastHealthAt),
    disabledAt: toDate(raw.disabledAt),
    createdAt,
    updatedAt,
  };
}

/**
 * Create a bot-token connector (Telegram). The bot token travels as an
 * encrypted credential (SOCIAL_TOKEN_ENCRYPTION_KEY); the target chat id is
 * safe metadata, never a secret. The connector identity is (workspace,
 * provider, external account key = the chat id), so creating the same
 * Telegram connector twice returns the existing row (reactivated with the
 * new token) instead of duplicating it. The emergency-locks check lives in
 * the route, like disconnectSocialConnector — this function does not
 * re-check it.
 */
export async function createSocialBotTokenConnector(input: {
  workspaceId: string;
  provider: SocialBotTokenProvider;
  displayName: string;
  credential: StoredSocialCredential;
  safeMetadata?: Record<string, unknown>;
}): Promise<SocialConnectorRecord> {
  if (shouldUseSupabaseGateway()) {
    return createSocialBotTokenConnectorViaGateway(input);
  }
  return createSocialBotTokenConnectorPrisma(input);
}

async function createSocialBotTokenConnectorPrisma(input: {
  workspaceId: string;
  provider: SocialBotTokenProvider;
  displayName: string;
  credential: StoredSocialCredential;
  safeMetadata?: Record<string, unknown>;
}): Promise<SocialConnectorRecord> {
  const connectorId = randomUUID();
  const credentialId = randomUUID();
  const now = new Date();
  const externalAccountKey = input.credential.externalAccountId || "default";
  const encrypted = encryptSocialCredential(input.credential);

  try {
    return await db.$transaction(async (transaction) => {
      // The generic type argument is avoided here on purpose: the
      // sandbox Prisma stub leaves $queryRaw untyped, so $queryRaw<T>
      // raises TS2347 there (the same pre-existing stub artifact as
      // persistSocialConnector's call). The cast is identical at
      // runtime and keeps this file clean under the stub.
      const connectors = (await transaction.$queryRaw(Prisma.sql`
        INSERT INTO social_connectors (
          id,
          workspace_id,
          provider,
          state,
          display_name,
          external_account_key,
          external_account_id,
          granted_scopes,
          safe_metadata,
          last_health_at,
          created_at,
          updated_at
        ) VALUES (
          ${connectorId},
          ${input.workspaceId},
          ${input.provider},
          'CONNECTED',
          ${input.displayName},
          ${externalAccountKey},
          ${input.credential.externalAccountId ?? null},
          ${input.credential.grantedScopes},
          CAST(${JSON.stringify(input.safeMetadata ?? {})} AS jsonb),
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT (workspace_id, provider, external_account_key)
        DO UPDATE SET
          state = 'CONNECTED',
          display_name = EXCLUDED.display_name,
          external_account_id = EXCLUDED.external_account_id,
          granted_scopes = EXCLUDED.granted_scopes,
          safe_metadata = EXCLUDED.safe_metadata,
          disabled_at = NULL,
          last_health_at = EXCLUDED.last_health_at,
          updated_at = EXCLUDED.updated_at
        RETURNING
          id,
          workspace_id AS "workspaceId",
          provider,
          state,
          display_name AS "displayName",
          external_account_id AS "externalAccountId",
          granted_scopes AS "grantedScopes",
          safe_metadata AS "safeMetadata",
          last_health_at AS "lastHealthAt",
          disabled_at AS "disabledAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `)) as SocialConnectorRecord[];
      const connector = connectors[0];
      if (!connector) throw new Error("Social connector was not returned after creation.");

      // The credential row uses reference_type 'oauth:production' because
      // that is the reference type the credential-load path filters on
      // (lifecycle-store.ts, gem_social_load_connector_credential). A
      // bot-token-specific reference type would make the worker unable to
      // load the Telegram token.
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO social_connector_credentials (
          id,
          connector_id,
          reference_type,
          secret_ref,
          expires_at,
          refresh_expires_at,
          rotated_at,
          created_at,
          updated_at
        ) VALUES (
          ${credentialId},
          ${connector.id},
          'oauth:production',
          ${encrypted},
          NULL,
          NULL,
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT (connector_id, reference_type)
        DO UPDATE SET
          secret_ref = EXCLUDED.secret_ref,
          rotated_at = EXCLUDED.rotated_at,
          updated_at = EXCLUDED.updated_at
      `);
      return connector;
    });
  } catch (error) {
    return storeUnavailable(error);
  }
}

async function createSocialBotTokenConnectorViaGateway(input: {
  workspaceId: string;
  provider: SocialBotTokenProvider;
  displayName: string;
  credential: StoredSocialCredential;
  safeMetadata?: Record<string, unknown>;
}): Promise<SocialConnectorRecord> {
  const externalAccountKey = input.credential.externalAccountId || "default";
  const encrypted = encryptSocialCredential(input.credential);
  try {
    const body = await socialPublishingGateway<{
      ok: boolean;
      connector?: Record<string, unknown>;
    }>("create_connector", {
      workspaceId: input.workspaceId,
      provider: input.provider,
      displayName: input.displayName,
      externalAccountKey,
      externalAccountId: input.credential.externalAccountId ?? externalAccountKey,
      grantedScopes: input.credential.grantedScopes,
      safeMetadata: input.safeMetadata ?? {},
      secretRef: encrypted,
      now: new Date().toISOString(),
    });
    if (!isRecord(body.connector)) {
      throw new TokMetricError(
        500,
        "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
        "The social publishing gateway returned an unexpected response.",
      );
    }
    return reviveConnectorRecord(body.connector);
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return gatewayError(error);
  }
}

export async function listSocialConnectors(workspaceId: string, database = db) {
  try {
    return await database.$queryRaw<SocialConnectorRecord[]>(Prisma.sql`
      SELECT
        id,
        workspace_id AS "workspaceId",
        provider,
        state,
        display_name AS "displayName",
        external_account_id AS "externalAccountId",
        granted_scopes AS "grantedScopes",
        safe_metadata AS "safeMetadata",
        last_health_at AS "lastHealthAt",
        disabled_at AS "disabledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM social_connectors
      WHERE workspace_id = ${workspaceId}
      ORDER BY provider ASC, created_at ASC
    `);
  } catch (error) {
    return storeUnavailable(error);
  }
}
