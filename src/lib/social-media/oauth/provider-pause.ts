import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { socialOAuthProviders } from "./config";

/** Telegram uses a bot credential, not OAuth, but has the same pause contract. */
export const socialPauseProviders = [...socialOAuthProviders, "TELEGRAM"] as const;
export type SocialPauseProvider = (typeof socialPauseProviders)[number];

export function parseSocialPauseProvider(input: string): SocialPauseProvider {
  const provider = input.trim().toUpperCase();
  if (!socialPauseProviders.includes(provider as SocialPauseProvider)) {
    throw new TokMetricError(400, "UNSUPPORTED_SOCIAL_PROVIDER", "Unsupported social pause provider.");
  }
  return provider as SocialPauseProvider;
}

/**
 * Provider-scoped publishing pause.
 *
 * A pause stops publishing for one provider inside one workspace without
 * disconnecting the connector or touching the global emergency lock. The
 * control plane exposes pause state in connector payloads; the publishing
 * worker (WS-B) and orchestrator (WS-E) honor it. See
 * docs/social-media/provider-pause-contract.md.
 */

export interface SocialProviderPauseRecord {
  workspaceId: string;
  provider: SocialPauseProvider;
  pausedAt: Date;
  pausedBy: string | null;
  reason: string | null;
}

const MAX_REASON_LENGTH = 500;

function isMissingStore(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    text.includes("social_provider_pauses") &&
    (text.includes("does not exist") || text.includes("42p01") || text.includes("p2010"))
  );
}

function storeUnavailable(error: unknown): never {
  if (isMissingStore(error)) {
    throw new TokMetricError(
      503,
      "SOCIAL_PROVIDER_PAUSE_STORE_NOT_PROVISIONED",
      "The social provider pause store has not been provisioned.",
    );
  }
  throw error;
}

function normalizeReason(reason?: string) {
  const trimmed = reason?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REASON_LENGTH);
}

export async function getPausedSocialProviders(
  workspaceId: string,
): Promise<SocialPauseProvider[]> {
  try {
    const rows = await db.$queryRaw<Array<{ provider: string }>>(Prisma.sql`
      SELECT provider
      FROM social_provider_pauses
      WHERE workspace_id = ${workspaceId}
      ORDER BY provider ASC
    `);
    return rows.map((row) => parseSocialPauseProvider(row.provider));
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function isSocialProviderPaused(
  workspaceId: string,
  provider: SocialPauseProvider,
): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<Array<{ one: number }>>(Prisma.sql`
      SELECT 1 AS one
      FROM social_provider_pauses
      WHERE workspace_id = ${workspaceId}
        AND provider = ${provider}
      LIMIT 1
    `);
    return rows.length > 0;
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function pauseSocialProvider(input: {
  workspaceId: string;
  provider: string;
  pausedBy?: string;
  reason?: string;
}): Promise<SocialProviderPauseRecord> {
  const provider = parseSocialPauseProvider(input.provider);
  const reason = normalizeReason(input.reason);
  const now = new Date();
  try {
    const rows = await db.$queryRaw<SocialProviderPauseRecord[]>(Prisma.sql`
      INSERT INTO social_provider_pauses (
        workspace_id,
        provider,
        paused_at,
        paused_by,
        reason,
        created_at,
        updated_at
      ) VALUES (
        ${input.workspaceId},
        ${provider},
        ${now},
        ${input.pausedBy ?? null},
        ${reason},
        ${now},
        ${now}
      )
      ON CONFLICT (workspace_id, provider)
      DO UPDATE SET
        paused_at = EXCLUDED.paused_at,
        paused_by = EXCLUDED.paused_by,
        reason = EXCLUDED.reason,
        updated_at = EXCLUDED.updated_at
      RETURNING
        workspace_id AS "workspaceId",
        provider,
        paused_at AS "pausedAt",
        paused_by AS "pausedBy",
        reason
    `);
    const record = rows[0];
    if (!record) throw new Error("Social provider pause was not returned after upsert.");
    return { ...record, provider: parseSocialPauseProvider(record.provider) };
  } catch (error) {
    return storeUnavailable(error);
  }
}

export async function unpauseSocialProvider(input: {
  workspaceId: string;
  provider: string;
}): Promise<{ provider: SocialPauseProvider; wasPaused: boolean }> {
  const provider = parseSocialPauseProvider(input.provider);
  try {
    const rows = await db.$queryRaw<Array<{ provider: string }>>(Prisma.sql`
      DELETE FROM social_provider_pauses
      WHERE workspace_id = ${input.workspaceId}
        AND provider = ${provider}
      RETURNING provider
    `);
    return { provider, wasPaused: rows.length > 0 };
  } catch (error) {
    return storeUnavailable(error);
  }
}

/**
 * Admin-only gate for pause management. Pausing a provider changes publishing
 * behavior for the whole workspace, so it requires workspace administrator
 * authority on top of the connector management permission (which callers must
 * check separately via requirePermission).
 */
export function assertSocialProviderPauseAdmin(
  membership: { role?: { name?: string | null } | null } | null,
  session: { role?: string | null },
): void {
  const sessionAdmin = ["admin", "super_admin", "internal"].includes(session.role || "");
  const roleName = membership?.role?.name?.toLowerCase();
  const workspaceAdmin = roleName === "admin" || roleName === "owner";
  if (!sessionAdmin && !workspaceAdmin) {
    throw new TokMetricError(
      403,
      "PERMISSION_DENIED",
      "Provider pause controls require a workspace administrator.",
    );
  }
}
