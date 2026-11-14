import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enforceEmergencyLocks, TokMetricError } from "@/lib/tokmetric/security";
import { encryptSocialCredential } from "./crypto";
import type { SocialOAuthProvider, SocialOAuthProviderConfig } from "./config";
import type { DiscoveredSocialAccount } from "./discovery";
import { evaluateSocialCredentialLifecycle } from "./lifecycle";
import type { SocialConnectorRecord } from "./store";

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

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function expandExplicitMetaDestinations(
  provider: SocialOAuthProvider,
  accounts: DiscoveredSocialAccount[],
) {
  if (provider !== "META") return accounts;
  const expanded: DiscoveredSocialAccount[] = [];
  for (const account of accounts) {
    expanded.push(account);
    if (account.accountType !== "META_PAGE") continue;
    const instagramId = metadataString(
      account.safeMetadata,
      "instagramBusinessAccountId",
    );
    if (!instagramId) continue;
    const username = metadataString(account.safeMetadata, "instagramUsername");
    expanded.push({
      externalAccountId: instagramId,
      displayName: username
        ? `Instagram @${username}`
        : `${account.displayName} Instagram`,
      accountType: "INSTAGRAM_PROFESSIONAL",
      username,
      safeMetadata: {
        facebookPageId: account.externalAccountId,
        instagramBusinessAccountId: instagramId,
        instagramUsername: username || null,
        linkedFacebookPageName: account.displayName,
        linkedFacebookPagePresent: true,
      },
      credential: {
        ...account.credential,
        externalAccountId: instagramId,
      },
    });
  }
  return expanded;
}

export async function persistDiscoveredSocialConnectors(input: {
  workspaceId: string;
  provider: SocialOAuthProvider;
  config: SocialOAuthProviderConfig;
  accounts: DiscoveredSocialAccount[];
}, scopedDatabase?: typeof db) {
  const database = scopedDatabase ?? db;
  await enforceEmergencyLocks(input.workspaceId, "connector", scopedDatabase);
  const accounts = expandExplicitMetaDestinations(
    input.provider,
    input.accounts,
  );
  if (accounts.length === 0) {
    throw new TokMetricError(
      422,
      "SOCIAL_ACCOUNT_DISCOVERY_EMPTY",
      "No eligible provider account was discovered.",
    );
  }

  const now = new Date();
  try {
    return await database.$transaction(async (transaction) => {
      const persisted: SocialConnectorRecord[] = [];
      for (const account of accounts) {
        const connectorId = randomUUID();
        const credentialId = randomUUID();
        const encrypted = encryptSocialCredential(account.credential);
        const expiresAt = account.credential.expiresAt
          ? new Date(account.credential.expiresAt)
          : null;
        const refreshExpiresAt = account.credential.refreshExpiresAt
          ? new Date(account.credential.refreshExpiresAt)
          : null;
        const lifecycle = evaluateSocialCredentialLifecycle(input.config, account.credential);
        const safeMetadata = {
          ...account.safeMetadata,
          provider: input.provider,
          accountType: account.accountType,
          username: account.username || null,
          tokenLifecycle: lifecycle.lifecycle,
          expiresAt: lifecycle.expiresAt,
          refreshExpiresAt: lifecycle.refreshExpiresAt,
          refreshTokenPresent: lifecycle.refreshTokenPresent,
          refreshSupported: lifecycle.refreshSupported,
          providerProbePerformed: true,
          externalPublishingEnabled: false,
        };

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
            ${lifecycle.connectorState},
            ${account.displayName},
            ${account.externalAccountId},
            ${account.externalAccountId},
            ${account.credential.grantedScopes},
            CAST(${JSON.stringify(safeMetadata)} AS jsonb),
            ${now},
            ${now},
            ${now}
          )
          ON CONFLICT (workspace_id, provider, external_account_key)
          DO UPDATE SET
            state = EXCLUDED.state,
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
        if (!connector) {
          throw new Error("Social connector was not returned after account persistence.");
        }

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
        persisted.push(connector);
      }
      return persisted;
    });
  } catch (error) {
    return storeUnavailable(error);
  }
}
