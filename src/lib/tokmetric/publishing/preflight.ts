import { z } from "zod";
import { db } from "@/lib/db";
import { getTikTokOAuthConfig } from "@/lib/tokmetric/oauth/config";
import { decryptCredential } from "@/lib/tokmetric/oauth/crypto";
import { emitTokMetricAudit, TokMetricError } from "@/lib/tokmetric/security";
import { queryTikTokCreatorInfo } from "./tiktok";

const credentialSchema = z.object({
  provider: z.literal("TIKTOK_CONTENT_POSTING_API"),
  environment: z.enum(["production", "sandbox"]),
  externalAccountId: z.string().min(1),
  accessToken: z.string().min(1),
  grantedScopes: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
});

/** Read-only provider preflight. The caller has already verified membership and publish permission.
 * Unlike publishing initialization this never refreshes, revokes, uploads or queues a post. */
export async function queryReadOnlyTikTokCreatorSettings(input: {
  workspaceId: string;
  connectorId: string;
  actorId: string;
  correlationId: string;
}, database = db) {
  const { environment } = getTikTokOAuthConfig();
  const connector = await database.connector.findFirst({
    where: { id: input.connectorId, workspaceId: input.workspaceId, provider: "TIKTOK_CONTENT_POSTING_API", state: "CONNECTED", disabledAt: null },
    select: { id: true, externalAccountId: true, grantedScopes: true },
  });
  if (!connector) throw new TokMetricError(409, "CONNECTOR_NOT_READY", "Select a connected TikTok Content Posting account.");
  const reference = await database.connectorCredentialReference.findUnique({
    where: { connectorId_referenceType: { connectorId: connector.id, referenceType: `oauth:${environment}` } },
    select: { secretRef: true, expiresAt: true },
  });
  if (!reference) throw new TokMetricError(409, "REAUTHORIZATION_REQUIRED", "Authorize the selected TikTok account for this environment.");
  let credential: z.infer<typeof credentialSchema>;
  try {
    credential = credentialSchema.parse(decryptCredential(reference.secretRef));
  } catch {
    throw new TokMetricError(409, "REAUTHORIZATION_REQUIRED", "Stored TikTok authorization could not be verified.");
  }
  if (credential.environment !== environment || credential.externalAccountId !== connector.externalAccountId) {
    throw new TokMetricError(409, "TIKTOK_AUTHORIZATION_MISMATCH", "Stored authorization does not match this account and environment.");
  }
  if (!credential.grantedScopes.includes("video.publish") || !connector.grantedScopes.includes("video.publish")) {
    throw new TokMetricError(403, "TIKTOK_SCOPE_NOT_AUTHORIZED", "TikTok video.publish authorization is required.");
  }
  const expiries = [reference.expiresAt?.getTime(), credential.expiresAt ? Date.parse(credential.expiresAt) : undefined];
  if (expiries.some(value => value !== undefined && (!Number.isFinite(value) || value <= Date.now()))) {
    throw new TokMetricError(409, "REAUTHORIZATION_REQUIRED", "TikTok authorization has expired. Reconnect before querying creator settings.");
  }
  const creator = await queryTikTokCreatorInfo(credential.accessToken);
  await emitTokMetricAudit({
    workspaceId: input.workspaceId, actorId: input.actorId, correlationId: input.correlationId,
    action: "tokmetric.tiktok.creator_info_preflight", entityType: "connector", entityId: connector.id,
    outcome: "success", sourceChannel: "website", metadata: { privacyLevelOptions: creator.privacyLevelOptions, externalPublishingActionTaken: false },
  }, database);
  return creator;
}
