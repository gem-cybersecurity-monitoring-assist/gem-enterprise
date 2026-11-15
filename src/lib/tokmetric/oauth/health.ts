import { z } from "zod";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { decryptCredential } from "./crypto";
import { getTikTokOAuthConfig } from "./config";

const credentialSchema = z.object({
  accessToken: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
  provider: z.literal("TIKTOK_CONTENT_POSTING_API"),
  externalAccountId: z.string().min(1),
  grantedScopes: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
});
const identitySchema = z.object({
  data: z.object({ user: z.object({ open_id: z.string().min(1) }) }),
  error: z.object({ code: z.literal("ok") }),
});

export type TikTokConnectionCheck = {
  connectorId: string;
  status: "verified" | "authorization_required" | "unavailable" | "not_checked";
  code: string;
  message: string;
  checkedAt: string;
};

// Read-only provider identity verification; never refresh/revoke tokens or post.
// Stored connector state and lastHealthAt are deliberately not rewritten.
export async function verifyTikTokConnections(workspaceId: string, database = db): Promise<TikTokConnectionCheck[]> {
  const { environment } = getTikTokOAuthConfig();
  const connectors = await database.connector.findMany({
    where: { workspaceId, provider: "TIKTOK_CONTENT_POSTING_API" },
    orderBy: { createdAt: "asc" }, take: 11,
  });
  if (connectors.length > 10) throw new TokMetricError(409, "TIKTOK_CHECK_LIMIT", "Verify at most ten TikTok connections per request.");
  return Promise.all(connectors.map(async (connector): Promise<TikTokConnectionCheck> => {
    const result = (status: TikTokConnectionCheck["status"], code: string, message: string) => ({
      connectorId: connector.id, status, code, message, checkedAt: new Date().toISOString(),
    });
    if (connector.disabledAt || connector.state !== "CONNECTED") {
      return result("not_checked", "TIKTOK_CONNECTION_INACTIVE", "Authorize this account before verification.");
    }
    const reference = await database.connectorCredentialReference.findUnique({
      where: { connectorId_referenceType: { connectorId: connector.id, referenceType: `oauth:${environment}` } },
    });
    if (!reference) return result("authorization_required", "TIKTOK_AUTHORIZATION_MISSING", "Authorize this account for the selected environment.");
    let credential: z.infer<typeof credentialSchema>;
    try {
      credential = credentialSchema.parse(decryptCredential(reference.secretRef));
    } catch {
      return result("authorization_required", "TIKTOK_CREDENTIAL_UNAVAILABLE", "Stored authorization could not be verified. Review the account setup.");
    }
    if (credential.environment !== environment || credential.externalAccountId !== connector.externalAccountId) {
      return result("authorization_required", "TIKTOK_AUTHORIZATION_MISMATCH", "Stored authorization does not match this account and environment.");
    }
    if (!credential.grantedScopes.includes("user.info.basic") || !connector.grantedScopes.includes("user.info.basic")) {
      return result("authorization_required", "TIKTOK_SCOPE_REQUIRED", "Account verification requires user.info.basic authorization.");
    }
    const expiries = [reference.expiresAt?.getTime(), credential.expiresAt ? Date.parse(credential.expiresAt) : undefined];
    if (expiries.some(value => value !== undefined && (!Number.isFinite(value) || value <= Date.now()))) {
      return result("authorization_required", "TIKTOK_TOKEN_EXPIRED", "Authorization has expired. Reconnect TikTok to verify it.");
    }
    try {
      const response = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id", {
        method: "GET", headers: { Authorization: `Bearer ${credential.accessToken}` },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401 || response.status === 403) {
        return result("authorization_required", "TIKTOK_AUTHORIZATION_REJECTED", "TikTok rejected this authorization. Reconnect or review app access.");
      }
      const parsed = identitySchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) {
        return result("unavailable", "TIKTOK_CHECK_UNAVAILABLE", "TikTok did not return a verifiable identity. Try again or review app access.");
      }
      if (parsed.data.data.user.open_id !== connector.externalAccountId) {
        return result("authorization_required", "TIKTOK_IDENTITY_MISMATCH", "TikTok returned a different account. Reconnect the intended account.");
      }
      return result("verified", "TIKTOK_IDENTITY_VERIFIED", "TikTok confirmed the saved account identity. Publishing readiness is checked separately.");
    } catch {
      return result("unavailable", "TIKTOK_CHECK_UNAVAILABLE", "The TikTok identity check could not complete. Try again.");
    }
  }));
}
