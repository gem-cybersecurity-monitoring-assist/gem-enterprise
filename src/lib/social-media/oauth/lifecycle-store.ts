import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { decryptSocialCredential, encryptSocialCredential } from "./crypto";
import { parseSocialOAuthProvider } from "./config";
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

export async function loadSocialConnectorCredential(input: {
  workspaceId: string;
  connectorId: string;
}) {
  try {
    const rows = await db.$queryRaw<ConnectorCredentialRow[]>(Prisma.sql`
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
    const provider = parseSocialOAuthProvider(row.provider);
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

export async function claimSocialConnectorCredentialRefresh(input: {
  workspaceId: string;
  connectorId: string;
  expectedCredentialRotatedAt: string | null;
}) {
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
    const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
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
}) {
  try {
    await db.$executeRaw(Prisma.sql`
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
}) {
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
    providerProbePerformed: false,
    externalPublishingEnabled: false,
  };
  const metadataJson = JSON.stringify(metadata);

  try {
    return await db.$transaction(async (transaction) => {
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
