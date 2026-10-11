import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { getSocialOAuthProviderConfig } from "./config";
import { revokeSocialProviderGrant, type SocialRevocationResult } from "./revocation";
import { loadSocialConnectorCredential } from "./lifecycle-store";
import { listSocialConnectors } from "./store";

export { listSocialConnectors };

function revocationMetadata(result: SocialRevocationResult) {
  return {
    externalRevocationAttempted: true,
    externalRevocationOutcome: result.outcome,
    externalRevocationAt: result.attemptedAt,
    ...(result.error ? { externalRevocationError: result.error } : {}),
  };
}

function revocationUnavailable(): SocialRevocationResult {
  return {
    supported: false,
    outcome: "not_supported",
    attemptedAt: new Date().toISOString(),
    error: "No stored credential available for provider-side revocation.",
  };
}

export interface SocialConnectorDisconnectResult {
  connectorId: string;
  externalRevocationAttempted: true;
  externalRevocationOutcome: SocialRevocationResult["outcome"];
  externalRevocationAt: string;
  externalRevocationError?: string;
}

export async function disconnectSocialConnector(input: {
  workspaceId: string;
  connectorId: string;
}): Promise<SocialConnectorDisconnectResult> {
  // Load the stored credential first so the provider grant can be revoked.
  // A missing credential must not block the local disconnect.
  let revocationInput:
    | { provider: ReturnType<typeof getSocialOAuthProviderConfig>["provider"]; credential: Awaited<ReturnType<typeof loadSocialConnectorCredential>>["credential"] }
    | undefined;
  try {
    const loaded = await loadSocialConnectorCredential(input);
    revocationInput = { provider: loaded.connector.provider, credential: loaded.credential };
  } catch (error) {
    if (
      !(error instanceof TokMetricError) ||
      error.code !== "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND"
    ) {
      throw error;
    }
  }

  // Best-effort: revocation never throws and never blocks local deletion.
  const revocation = revocationInput
    ? await revokeSocialProviderGrant({
        config: getSocialOAuthProviderConfig(revocationInput.provider),
        credential: revocationInput.credential,
      })
    : revocationUnavailable();

  const metadataJson = JSON.stringify(revocationMetadata(revocation));

  const disconnected = await db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE social_connectors
      SET
        state = 'DISCONNECTED',
        disabled_at = CURRENT_TIMESTAMP,
        safe_metadata = safe_metadata || CAST(${metadataJson} AS jsonb),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.connectorId}
        AND workspace_id = ${input.workspaceId}
        AND disabled_at IS NULL
      RETURNING id
    `);
    if (!rows[0]) {
      throw new TokMetricError(404, "SOCIAL_CONNECTOR_NOT_FOUND", "Social connector was not found.");
    }
    await transaction.$executeRaw(Prisma.sql`
      DELETE FROM social_connector_credentials
      WHERE connector_id = ${input.connectorId}
    `);
    return { connectorId: rows[0].id };
  });

  return {
    ...disconnected,
    externalRevocationAttempted: true,
    externalRevocationOutcome: revocation.outcome,
    externalRevocationAt: revocation.attemptedAt,
    ...(revocation.error ? { externalRevocationError: revocation.error } : {}),
  };
}
