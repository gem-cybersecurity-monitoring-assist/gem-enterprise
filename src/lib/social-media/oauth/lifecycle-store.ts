import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  GatewayRequestError,
  shouldUseSupabaseGateway,
} from "@/lib/supabase-gateway";
import { socialPublishingGateway } from "@/lib/social-media/publishing/gateway-client";
import { TokMetricError } from "@/lib/tokmetric/security";
import { decryptSocialCredential, encryptSocialCredential } from "./crypto";
import { parseSocialConnectorProvider } from "./config";
import type { SocialCredentialLifecycleResult } from "./lifecycle";
import type { SocialConnectorRecord, StoredSocialCredential } from "./store";

const REFRESH_CLAIM_TTL_MS = 45_000;

interface ConnectorCredentialRow extends SocialConnectorRecord {
  secretRef: string;
  credentialExpiresAt: Date | null;
  credentialRefreshExpiresAt: Date | null;
  credentialRotatedAt: Date | null;
}

function isMissingStore(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    (text.includes("social_connectors") || text.includes("social_connector_credentials")) &&
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

// Gateway errors keep the edge function's status + stable code (so a 404
// SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND from the RPC survives the hop
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

// Row shape the gem_social_load_connector_credential RPC returns (JSON:
// camelCase keys, ISO timestamp strings). Mirrors ConnectorCredentialRow
// above so the gateway branch can run the same decrypt + consistency
// check the Prisma branch runs.
interface GatewayCredentialRow {
  id: string;
  workspaceId: string;
  provider: string;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  grantedScopes: string[];
  safeMetadata: Record<string, unknown>;
  lastHealthAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  secretRef: string;
  credentialExpiresAt: Date | null;
  credentialRefreshExpiresAt: Date | null;
  credentialRotatedAt: Date | null;
}

function reviveCredentialRow(
  raw: Record<string, unknown>,
): GatewayCredentialRow {
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
    provider: String(raw.provider ?? ""),
    state: String(raw.state ?? ""),
    displayName: String(raw.displayName ?? ""),
    externalAccountId: toNullableString(raw.externalAccountId),
    grantedScopes: Array.isArray(raw.grantedScopes)
      ? (raw.grantedScopes.filter(
          (entry): entry is string => typeof entry === "string",
        ) as string[])
      : [],
    safeMetadata:
      isRecord(raw.safeMetadata) && !Array.isArray(raw.safeMetadata)
        ? raw.safeMetadata
        : {},
    lastHealthAt: toDate(raw.lastHealthAt),
    disabledAt: toDate(raw.disabledAt),
    createdAt,
    updatedAt,
    secretRef: String(raw.secretRef ?? ""),
    credentialExpiresAt: toDate(raw.credentialExpiresAt),
    credentialRefreshExpiresAt: toDate(raw.credentialRefreshExpiresAt),
    credentialRotatedAt: toDate(raw.credentialRotatedAt),
  };
}

export async function loadSocialConnectorCredential(input: {
  workspaceId: string;
  connectorId: string;
}, scopedDatabase?: typeof db) {
  if (!scopedDatabase && shouldUseSupabaseGateway()) {
    return loadSocialConnectorCredentialViaGateway(input);
  }
  return loadSocialConnectorCredentialPrisma(input, scopedDatabase);
}

async function loadSocialConnectorCredentialPrisma(input: {
  workspaceId: string;
  connectorId: string;
}, database = db) {
  try {
    const rows = await database.$queryRaw<ConnectorCredentialRow[]>(Prisma.sql`
      SELECT
        connector.id,
        connector.workspace_id AS "workspaceId",
        connector.provider,
        connector.state,
        connector.display_name AS "displayName",
        connector.external_account_id AS "externalAccountId",
        connector.granted_scopes AS "grantedScopes",
        connector.safe_metadata AS "safeMetadata",
        connector.last_health_at AS "lastHealthAt",
        connector.disabled_at AS "disabledAt",
        connector.created_at AS "createdAt",
        connector.updated_at AS "updatedAt",
        credential.secret_ref AS "secretRef",
        credential.expires_at AS "credentialExpiresAt",
        credential.refresh_expires_at AS "credentialRefreshExpiresAt",
        credential.rotated_at AS "credentialRotatedAt"
      FROM social_connectors connector
      INNER JOIN social_connector_credentials credential
        ON credential.connector_id = connector.id
       AND credential.reference_type = 'oauth:production'
      WHERE connector.id = ${input.connectorId}
        AND connector.workspace_id = ${input.workspaceId}
        AND connector.disabled_at IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) {
      throw new TokMetricError(
        404,
        "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND",
        "Active social connector authorization was not found.",
      );
    }
        // Stored connector providers include bot-token providers (Telegram)
    // as well as OAuth providers, so parse with the connector union, not
    // the OAuth-only union. The decrypt + consistency check below still
    // runs unchanged for every provider.
    const provider = parseSocialConnectorProvider(row.provider);
    const credential = decryptSocialCredential<StoredSocialCredential>(row.secretRef);
    if (credential.provider !== provider || credential.externalAccountId !== row.externalAccountId) {
      throw new TokMetricError(
        409,
        "SOCIAL_CONNECTOR_CREDENTIAL_MISMATCH",
        "Stored connector authorization does not match the selected provider account.",
      );
    }
    return {
      connector: {
        id: row.id,
        workspaceId: row.workspaceId,
        provider,
        state: row.state,
        displayName: row.displayName,
        externalAccountId: row.externalAccountId,
        grantedScopes: row.grantedScopes,
        safeMetadata: row.safeMetadata,
        lastHealthAt: row.lastHealthAt,
        disabledAt: row.disabledAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies SocialConnectorRecord,
      credential,
      credentialRotatedAt: row.credentialRotatedAt?.toISOString() || null,
    };
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

/**
 * Gateway branch of loadSocialConnectorCredential. The RPC returns the raw
 * row INCLUDING the secretRef ciphertext, and the existing decrypt +
 * consistency check runs here in Node — the encryption key never leaves
 * Vercel. The TELEGRAM / BOT_TOKEN provider parse is the merged #468 fix
 * (parseSocialConnectorProvider); this branch builds on it.
 */
async function loadSocialConnectorCredentialViaGateway(input: {
  workspaceId: string;
  connectorId: string;
}) {
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "load_credential",
      { workspaceId: input.workspaceId, connectorId: input.connectorId },
    );
    if (!isRecord(body.row)) {
      throw new TokMetricError(
        500,
        "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
        "The social publishing gateway returned an unexpected response.",
      );
    }
    const row = reviveCredentialRow(body.row);
    // Stored connector providers include bot-token providers (Telegram) as
    // well as OAuth providers, so parse with the connector union (#468).
    const provider = parseSocialConnectorProvider(row.provider);
    const credential = decryptSocialCredential<StoredSocialCredential>(
      row.secretRef,
    );
    if (
      credential.provider !== provider ||
      credential.externalAccountId !== row.externalAccountId
    ) {
      throw new TokMetricError(
        409,
        "SOCIAL_CONNECTOR_CREDENTIAL_MISMATCH",
        "Stored connector authorization does not match the selected provider account.",
      );
    }
    return {
      connector: {
        id: row.id,
        workspaceId: row.workspaceId,
        provider,
        state: row.state,
        displayName: row.displayName,
        externalAccountId: row.externalAccountId,
        grantedScopes: row.grantedScopes,
        safeMetadata: row.safeMetadata,
        lastHealthAt: row.lastHealthAt,
        disabledAt: row.disabledAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies SocialConnectorRecord,
      credential,
      credentialRotatedAt: row.credentialRotatedAt
        ? row.credentialRotatedAt.toISOString()
        : null,
    };
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return gatewayError(error);
  }
}

export async function claimSocialConnectorCredentialRefresh(input: {
  workspaceId: string;
  connectorId: string;
  expectedCredentialRotatedAt: string | null;
}, database = db) {
  const claimId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_CLAIM_TTL_MS);
  const expectedRotatedAt = input.expectedCredentialRotatedAt
    ? new Date(input.expectedCredentialRotatedAt)
    : null;
  const claimMetadata = JSON.stringify({
    tokenRefreshClaimId: claimId,
    tokenRefreshClaimedAt: now.toISOString(),
    tokenRefreshClaimExpiresAt: expiresAt.toISOString(),
  });

  try {
    const rows = await database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE social_connectors connector
      SET
        safe_metadata = connector.safe_metadata || CAST(${claimMetadata} AS jsonb),
        updated_at = ${now}
      FROM social_connector_credentials credential
      WHERE connector.id = ${input.connectorId}
        AND connector.workspace_id = ${input.workspaceId}
        AND connector.disabled_at IS NULL
        AND credential.connector_id = connector.id
        AND credential.reference_type = 'oauth:production'
        AND credential.rotated_at IS NOT DISTINCT FROM ${expectedRotatedAt}
        AND (
          connector.safe_metadata->>'tokenRefreshClaimId' IS NULL
          OR connector.safe_metadata->>'tokenRefreshClaimExpiresAt' IS NULL
          OR (connector.safe_metadata->>'tokenRefreshClaimExpiresAt')::timestamptz <= ${now}
        )
      RETURNING connector.id
    `);
    if (!rows[0]) {
      throw new TokMetricError(
        409,
        "SOCIAL_CREDENTIAL_REFRESH_IN_PROGRESS",
        "The connector credential is already being refreshed or changed. Reload before retrying.",
      );
    }
    return { claimId, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}

export async function releaseSocialConnectorCredentialRefreshClaim(input: {
  workspaceId: string;
  connectorId: string;
  claimId: string;
}, database = db) {
  try {
    await database.$executeRaw(Prisma.sql`
      UPDATE social_connectors
      SET
        safe_metadata = safe_metadata
          - 'tokenRefreshClaimId'
          - 'tokenRefreshClaimedAt'
          - 'tokenRefreshClaimExpiresAt',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.connectorId}
        AND workspace_id = ${input.workspaceId}
        AND safe_metadata->>'tokenRefreshClaimId' = ${input.claimId}
    `);
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function recordSocialConnectorLifecycle(input: {
  workspaceId: string;
  connectorId: string;
  lifecycle: SocialCredentialLifecycleResult;
  credential?: StoredSocialCredential;
  expectedCredentialRotatedAt?: string | null;
  refreshClaimId?: string;
  refreshAttempted: boolean;
  refreshSucceeded: boolean;
  concurrentRotationObserved?: boolean;
  liveProbe?: {
    probeOk: boolean;
    probedAt: string;
    accountName: string | null;
    latencyMs: number;
  };
}, database = db) {
  const now = new Date();
  const metadata = {
    tokenLifecycle: input.lifecycle.lifecycle,
    expiresAt: input.lifecycle.expiresAt,
    refreshExpiresAt: input.lifecycle.refreshExpiresAt,
    refreshTokenPresent: input.lifecycle.refreshTokenPresent,
    refreshSupported: input.lifecycle.refreshSupported,
    lastCredentialHealthAt: now.toISOString(),
    tokenRefreshAttempted: input.refreshAttempted,
    tokenRefreshSucceeded: input.refreshSucceeded,
    concurrentRotationObserved: Boolean(input.concurrentRotationObserved),
    providerProbePerformed: Boolean(input.liveProbe),
    ...(input.liveProbe
      ? {
          liveProbeAt: input.liveProbe.probedAt,
          liveProbeOk: input.liveProbe.probeOk,
          liveProbeAccountName: input.liveProbe.accountName,
          liveProbeLatencyMs: input.liveProbe.latencyMs,
        }
      : {}),
    externalPublishingEnabled: false,
  };
  const metadataJson = JSON.stringify(metadata);

  try {
    return await database.$transaction(async (transaction) => {
      if (input.credential) {
        const encrypted = encryptSocialCredential(input.credential);
        const expiresAt = input.credential.expiresAt
          ? new Date(input.credential.expiresAt)
          : null;
        const refreshExpiresAt = input.credential.refreshExpiresAt
          ? new Date(input.credential.refreshExpiresAt)
          : null;
        const expectedRotatedAt = input.expectedCredentialRotatedAt
          ? new Date(input.expectedCredentialRotatedAt)
          : null;
        const updatedCredentials = await transaction.$executeRaw(Prisma.sql`
          UPDATE social_connector_credentials credential
          SET
            secret_ref = ${encrypted},
            expires_at = ${expiresAt},
            refresh_expires_at = ${refreshExpiresAt},
            rotated_at = ${now},
            updated_at = ${now}
          FROM social_connectors connector
          WHERE credential.connector_id = connector.id
            AND credential.reference_type = 'oauth:production'
            AND connector.id = ${input.connectorId}
            AND connector.workspace_id = ${input.workspaceId}
            AND connector.disabled_at IS NULL
            AND credential.rotated_at IS NOT DISTINCT FROM ${expectedRotatedAt}
        `);
        if (updatedCredentials !== 1) {
          throw new TokMetricError(
            409,
            "SOCIAL_CREDENTIAL_ROTATION_CONFLICT",
            "The connector credential changed during token rotation. Reload the connector before retrying.",
          );
        }
      }

      const rows = input.refreshClaimId
        ? await transaction.$queryRaw<SocialConnectorRecord[]>(Prisma.sql`
            UPDATE social_connectors
            SET
              state = ${input.lifecycle.connectorState},
              safe_metadata = (
                safe_metadata
                  - 'tokenRefreshClaimId'
                  - 'tokenRefreshClaimedAt'
                  - 'tokenRefreshClaimExpiresAt'
              ) || CAST(${metadataJson} AS jsonb),
              last_health_at = ${now},
              updated_at = ${now}
            WHERE id = ${input.connectorId}
              AND workspace_id = ${input.workspaceId}
              AND disabled_at IS NULL
              AND safe_metadata->>'tokenRefreshClaimId' = ${input.refreshClaimId}
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
          `)
        : await transaction.$queryRaw<SocialConnectorRecord[]>(Prisma.sql`
            UPDATE social_connectors
            SET
              state = ${input.lifecycle.connectorState},
              safe_metadata = safe_metadata || CAST(${metadataJson} AS jsonb),
              last_health_at = ${now},
              updated_at = ${now}
            WHERE id = ${input.connectorId}
              AND workspace_id = ${input.workspaceId}
              AND disabled_at IS NULL
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
      if (!rows[0]) {
        throw new TokMetricError(
          409,
          input.refreshClaimId
            ? "SOCIAL_CREDENTIAL_REFRESH_CLAIM_LOST"
            : "SOCIAL_CONNECTOR_NOT_FOUND",
          input.refreshClaimId
            ? "The connector refresh claim was lost before lifecycle persistence. Reload before retrying."
            : "Active social connector was not found.",
        );
      }
      return rows[0];
    });
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return storeUnavailable(error);
  }
}
