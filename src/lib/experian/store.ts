import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enforceEmergencyLocks, TokMetricError } from "@/lib/tokmetric/security";
import type { ExperianAuthMode, ExperianEnvironment } from "./config";
import { decryptExperianCredential, encryptExperianCredential } from "./crypto";
import type { ExperianCredential } from "./client";
import type { ExperianStatePayload } from "./state";

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

export interface ExperianAuthorizationAttempt {
  id: string;
  nonce: string;
  workspaceId: string;
  actorId: string;
  encryptedCodeVerifier: string;
  requestedScopes: string[];
  redirectUri: string;
  redirectAfter: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}
export interface ExperianConnectionRecord {
  id: string;
  workspaceId: string;
  authMode: ExperianAuthMode;
  environment: ExperianEnvironment;
  state: string;
  externalAccountReference: string | null;
  displayLabel: string;
  grantedScopes: string[];
  approvedCapabilities: string[];
  safeMetadata: Record<string, unknown>;
  lastReadVerifiedAt: Date | null;
  lastHealthAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function isMissingStore(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    (text.includes("experian_connections") ||
      text.includes("experian_connection_credentials") ||
      text.includes("experian_authorization_attempts")) &&
    (text.includes("does not exist") || text.includes("42p01") || text.includes("p2010"))
  );
}

function storeUnavailable(error: unknown): never {
  if (isMissingStore(error)) {
    throw new TokMetricError(
      503,
      "EXPERIAN_STORE_NOT_PROVISIONED",
      "The Experian authorization store has not been provisioned.",
    );
  }
  throw error;
}

function normalizeRedirectAfter(value?: string) {
  const candidate = value?.trim() || "/app/products/financial/credit-readiness";
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    throw new TokMetricError(
      400,
      "INVALID_REDIRECT_TARGET",
      "Redirect target must be a local application path.",
    );
  }
  return candidate;
}

export async function createExperianAuthorizationAttempt(input: {
  nonce: string;
  workspaceId: string;
  actorId: string;
  codeVerifier: string;
  requestedScopes: string[];
  redirectUri: string;
  redirectAfter?: string;
}) {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_MS);
  const encryptedCodeVerifier = encryptExperianCredential({ codeVerifier: input.codeVerifier });
  const redirectAfter = normalizeRedirectAfter(input.redirectAfter);
  try {
    const rows = await db.$queryRaw<ExperianAuthorizationAttempt[]>(Prisma.sql`
      INSERT INTO experian_authorization_attempts (
        id, nonce, workspace_id, actor_id, encrypted_code_verifier,
        requested_scopes, redirect_uri, redirect_after, expires_at, created_at
      ) VALUES (
        ${id}, ${input.nonce}, ${input.workspaceId}, ${input.actorId},
        ${encryptedCodeVerifier}, ${input.requestedScopes}, ${input.redirectUri},
        ${redirectAfter}, ${expiresAt}, ${now}
      )
      RETURNING
        id, nonce, workspace_id AS "workspaceId", actor_id AS "actorId",
        encrypted_code_verifier AS "encryptedCodeVerifier",
        requested_scopes AS "requestedScopes", redirect_uri AS "redirectUri",
        redirect_after AS "redirectAfter", expires_at AS "expiresAt",
        consumed_at AS "consumedAt", created_at AS "createdAt"
    `);
    if (!rows[0]) throw new Error("Experian authorization attempt was not returned after creation.");
    return rows[0];
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function consumeExperianAuthorizationAttempt(state: ExperianStatePayload) {
  try {
    const rows = await db.$queryRaw<ExperianAuthorizationAttempt[]>(Prisma.sql`
      UPDATE experian_authorization_attempts
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE nonce = ${state.nonce}
        AND workspace_id = ${state.workspaceId}
        AND actor_id = ${state.actorId}
        AND consumed_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      RETURNING
        id, nonce, workspace_id AS "workspaceId", actor_id AS "actorId",
        encrypted_code_verifier AS "encryptedCodeVerifier",
        requested_scopes AS "requestedScopes", redirect_uri AS "redirectUri",
        redirect_after AS "redirectAfter", expires_at AS "expiresAt",
        consumed_at AS "consumedAt", created_at AS "createdAt"
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        401,
        "EXPERIAN_AUTHORIZATION_ATTEMPT_INVALID",
        "Experian authorization attempt is missing, expired, mismatched, or already consumed.",
      );
    }
    const codeVerifier = decryptExperianCredential<{ codeVerifier: string }>(
      rows[0].encryptedCodeVerifier,
    ).codeVerifier;
    return { attempt: rows[0], codeVerifier };
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function persistExperianConnection(input: {
  workspaceId: string;
  authMode: ExperianAuthMode;
  environment: ExperianEnvironment;
  credential: ExperianCredential;
  externalAccountReference: string;
  displayLabel: string;
  approvedCapabilities: string[];
  responseDigest: string;
  verifiedAt: string;
}) {
  await enforceEmergencyLocks(input.workspaceId, "connector");
  const connectionId = randomUUID();
  const credentialId = randomUUID();
  const now = new Date();
  const verifiedAt = new Date(input.verifiedAt);
  const encrypted = encryptExperianCredential(input.credential);
  const expiresAt = input.credential.expiresAt ? new Date(input.credential.expiresAt) : null;
  const refreshExpiresAt = input.credential.refreshExpiresAt
    ? new Date(input.credential.refreshExpiresAt)
    : null;
  const safeMetadata = {
    responseDigest: input.responseDigest,
    tokenType: input.credential.tokenType,
    refreshTokenPresent: Boolean(input.credential.refreshToken),
  };

  try {
    return await db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<ExperianConnectionRecord[]>(Prisma.sql`
        INSERT INTO experian_connections (
          id, workspace_id, auth_mode, environment, state,
          external_account_reference, display_label, granted_scopes,
          approved_capabilities, safe_metadata, last_read_verified_at,
          last_health_at, created_at, updated_at
        ) VALUES (
          ${connectionId}, ${input.workspaceId}, ${input.authMode}, ${input.environment},
          'CONNECTED', ${input.externalAccountReference}, ${input.displayLabel},
          ${input.credential.grantedScopes}, ${input.approvedCapabilities},
          CAST(${JSON.stringify(safeMetadata)} AS jsonb), ${verifiedAt}, ${now}, ${now}, ${now}
        )
        ON CONFLICT (workspace_id)
        DO UPDATE SET
          auth_mode = EXCLUDED.auth_mode,
          environment = EXCLUDED.environment,
          state = 'CONNECTED',
          external_account_reference = EXCLUDED.external_account_reference,
          display_label = EXCLUDED.display_label,
          granted_scopes = EXCLUDED.granted_scopes,
          approved_capabilities = EXCLUDED.approved_capabilities,
          safe_metadata = EXCLUDED.safe_metadata,
          last_read_verified_at = EXCLUDED.last_read_verified_at,
          last_health_at = EXCLUDED.last_health_at,
          disconnected_at = NULL,
          updated_at = EXCLUDED.updated_at
        RETURNING
          id, workspace_id AS "workspaceId", auth_mode AS "authMode",
          environment, state, external_account_reference AS "externalAccountReference",
          display_label AS "displayLabel", granted_scopes AS "grantedScopes",
          approved_capabilities AS "approvedCapabilities", safe_metadata AS "safeMetadata",
          last_read_verified_at AS "lastReadVerifiedAt", last_health_at AS "lastHealthAt",
          disconnected_at AS "disconnectedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      `);
      const connection = rows[0];
      if (!connection) throw new Error("Experian connection was not returned after persistence.");
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO experian_connection_credentials (
          id, connection_id, secret_ref, expires_at, refresh_expires_at,
          rotated_at, created_at, updated_at
        ) VALUES (
          ${credentialId}, ${connection.id}, ${encrypted}, ${expiresAt}, ${refreshExpiresAt},
          ${now}, ${now}, ${now}
        )
        ON CONFLICT (connection_id)
        DO UPDATE SET
          secret_ref = EXCLUDED.secret_ref,
          expires_at = EXCLUDED.expires_at,
          refresh_expires_at = EXCLUDED.refresh_expires_at,
          rotated_at = EXCLUDED.rotated_at,
          updated_at = EXCLUDED.updated_at
      `);
      return connection;
    });
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function getExperianConnection(workspaceId: string) {
  try {
    const rows = await db.$queryRaw<ExperianConnectionRecord[]>(Prisma.sql`
      SELECT
        id, workspace_id AS "workspaceId", auth_mode AS "authMode", environment,
        state, external_account_reference AS "externalAccountReference",
        display_label AS "displayLabel", granted_scopes AS "grantedScopes",
        approved_capabilities AS "approvedCapabilities", safe_metadata AS "safeMetadata",
        last_read_verified_at AS "lastReadVerifiedAt", last_health_at AS "lastHealthAt",
        disconnected_at AS "disconnectedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM experian_connections
      WHERE workspace_id = ${workspaceId}
      LIMIT 1
    `);
    return rows[0] || null;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function getExperianCredential(connectionId: string) {
  try {
    const rows = await db.$queryRaw<Array<{ secretRef: string }>>(Prisma.sql`
      SELECT secret_ref AS "secretRef"
      FROM experian_connection_credentials
      WHERE connection_id = ${connectionId}
      LIMIT 1
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        409,
        "EXPERIAN_REAUTHORIZATION_REQUIRED",
        "The Experian connection requires authorization again.",
      );
    }
    return decryptExperianCredential<ExperianCredential>(rows[0].secretRef);
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function disconnectExperianConnection(workspaceId: string) {
  try {
    return await db.$transaction(async (transaction) => {
      const existing = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM experian_connections WHERE workspace_id = ${workspaceId} LIMIT 1
      `);
      if (!existing[0]) return null;
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM experian_connection_credentials WHERE connection_id = ${existing[0].id}
      `);
      const rows = await transaction.$queryRaw<ExperianConnectionRecord[]>(Prisma.sql`
        UPDATE experian_connections
        SET state = 'DISCONNECTED', disconnected_at = CURRENT_TIMESTAMP,
            last_health_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
            granted_scopes = ARRAY[]::TEXT[], approved_capabilities = ARRAY[]::TEXT[]
        WHERE id = ${existing[0].id}
        RETURNING
          id, workspace_id AS "workspaceId", auth_mode AS "authMode", environment,
          state, external_account_reference AS "externalAccountReference",
          display_label AS "displayLabel", granted_scopes AS "grantedScopes",
          approved_capabilities AS "approvedCapabilities", safe_metadata AS "safeMetadata",
          last_read_verified_at AS "lastReadVerifiedAt", last_health_at AS "lastHealthAt",
          disconnected_at AS "disconnectedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      `);
      return rows[0] || null;
    });
  } catch (error) {
    return storeUnavailable(error);
  }
}
