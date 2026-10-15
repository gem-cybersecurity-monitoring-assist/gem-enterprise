import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { listSocialConnectors } from "./store";

export { listSocialConnectors };

export async function disconnectSocialConnector(input: {
  workspaceId: string;
  connectorId: string;
}) {
  return db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE social_connectors
      SET
        state = 'DISCONNECTED',
        disabled_at = CURRENT_TIMESTAMP,
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
    return { connectorId: rows[0].id, externalRevocationAttempted: false };
  });
}
