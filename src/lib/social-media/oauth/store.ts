import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enforceEmergencyLocks, TokMetricError } from "@/lib/tokmetric/security";
import { decryptSocialCredential, encryptSocialCredential } from "./crypto";
import type { SocialConnectorProvider, SocialOAuthProvider } from "./config";
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
}) {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_MS);
  const encryptedCodeVerifier = input.codeVerifier
    ? encryptSocialCredential({ codeVerifier: input.codeVerifier })
    : null;
  const redirectAfter = normalizeRedirectAfter(input.redirectAfter);

  try {
    const rows = await db.$queryRaw<SocialOAuthAttemptRecord[]>(Prisma.sql`
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

export async function consumeSocialOAuthAuthorizationAttempt(state: SocialOAuthStatePayload) {
  try {
    const rows = await db.$queryRaw<SocialOAuthAttemptRecord[]>(Prisma.sql`
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

export async function listSocialConnectors(workspaceId: string) {
  try {
    return await db.$queryRaw<SocialConnectorRecord[]>(Prisma.sql`
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
