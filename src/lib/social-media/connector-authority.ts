/**
 * Transactional authority for social connector OAuth (unified
  * /api/social-media/oauth/* AND legacy /api/tokmetric/oauth/* start,
   * callback and connected-account readback).
    *
     * A supabase_gateway session is admitted only when the direct database is
      * explicitly bound to the same Supabase project as gateway sign-in
       * (hasSocialTransactionalAuthority): the Prisma reads/writes below then run
        * as transactions against that project, and the account + workspace
         * membership are re-validated before any connector is stored. Without that
          * binding the routes fail closed with SOCIAL_CONNECTOR_BACKEND_REQUIRED
           * before any database read. Local sessions keep the previous
            * requireActiveTokMetricSession / requireWorkspaceAccess behaviour.
             *
              * This does NOT lift the TokMetric persistence guard in
               * src/lib/tokmetric/security.ts for any other operation: publishing, shop,
                * agents, analytics and the remaining TokMetric routes still reject
                 * supabase_gateway sessions with TOKMETRIC_GATEWAY_BACKEND_REQUIRED.
                  */
import { PrismaClient } from "@prisma/client";
import type { NextRequest } from "next/server";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth";
import { reconcileSessionAuthority } from "@/lib/auth-authority";
import { db } from "@/lib/db";
import {
  requireActiveTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
} from "@/lib/tokmetric/security";
import { hasSocialTransactionalAuthority } from "./transactional-authority";

let tokMetricDatabase: PrismaClient | undefined;

export function tokMetricConnectorDatabase(session: SessionPayload): PrismaClient | undefined {
  const supplied = process.env.GEM_SOCIAL_POSTGRES_PRISMA_URL?.trim();
  if (session.authSource !== "supabase_gateway" || !supplied) return undefined;
  let connection: string | undefined;
  try {
    const url = new URL(supplied);
    if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    if (!url.searchParams.has("sslaccept")) url.searchParams.set("sslaccept", "strict");
    connection = url.toString();
  } catch {
    // The same authority check below rejects missing and invalid URLs.
  }
  if (!connection || !hasSocialTransactionalAuthority(process.env, connection)) {
    throw new TokMetricError(503, "SOCIAL_CONNECTOR_BACKEND_REQUIRED", "The social connector needs the verified database for this sign-in project.");
  }
  return tokMetricDatabase ??= new PrismaClient({ datasourceUrl: connection });
}

export async function requireSocialConnectorSession(request: NextRequest, scopedTokMetric = false) {
  const session = await getSessionFromRequest(request);
  if (!session) throw new TokMetricError(401, "UNAUTHENTICATED", "Authentication is required.");
  if (session.authSource !== "supabase_gateway") return requireActiveTokMetricSession(request);
  const scopedDatabase = scopedTokMetric ? tokMetricConnectorDatabase(session) : undefined;
  if (!scopedDatabase && !hasSocialTransactionalAuthority()) {
    throw new TokMetricError(503, "SOCIAL_CONNECTOR_BACKEND_REQUIRED", "The social connector needs the verified database for this sign-in project.");
  }
  const account = await (scopedDatabase ?? db).user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, organizationId: true, isActive: true, status: true, sessionVersion: true },
  });
  const authority = reconcileSessionAuthority(session, account);
  if (authority.ok === false) throw new TokMetricError(authority.statusCode, authority.code, authority.message);
  if (authority.accountStatus !== "active") {
    throw new TokMetricError(403, "ACCOUNT_NOT_ACTIVE", "An active approved account is required.");
  }
  return authority.session;
}

export async function requireSocialConnectorWorkspace(workspaceId: string, session: SessionPayload, scopedDatabase?: PrismaClient) {
  if (session.authSource !== "supabase_gateway") return requireWorkspaceAccess(workspaceId, session);
  if (!scopedDatabase && !hasSocialTransactionalAuthority()) {
    throw new TokMetricError(503, "SOCIAL_CONNECTOR_BACKEND_REQUIRED", "The social connector needs the verified database for this sign-in project.");
  }
  const membership = await (scopedDatabase ?? db).workspaceMember.findFirst({
    where: { workspaceId, userId: session.userId, status: "active", workspace: { organization: { status: "active" } } },
    include: { role: { include: { permissions: true } } },
  });
  if (!membership) {
    throw new TokMetricError(403, "WORKSPACE_FORBIDDEN", "An active membership in this workspace is required.");
  }
  return membership;
}
