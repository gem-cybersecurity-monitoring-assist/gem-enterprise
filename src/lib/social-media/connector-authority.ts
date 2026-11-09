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

export async function requireSocialConnectorSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) throw new TokMetricError(401, "UNAUTHENTICATED", "Authentication is required.");
  if (session.authSource !== "supabase_gateway") return requireActiveTokMetricSession(request);
  if (!hasSocialTransactionalAuthority()) {
    throw new TokMetricError(503, "SOCIAL_CONNECTOR_BACKEND_REQUIRED", "The social connector needs the verified database for this sign-in project.");
  }
  const account = await db.user.findUnique({
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

export async function requireSocialConnectorWorkspace(workspaceId: string, session: SessionPayload) {
  if (session.authSource !== "supabase_gateway") return requireWorkspaceAccess(workspaceId, session);
  if (!hasSocialTransactionalAuthority()) {
    throw new TokMetricError(503, "SOCIAL_CONNECTOR_BACKEND_REQUIRED", "The social connector needs the verified database for this sign-in project.");
  }
  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.userId, status: "active", workspace: { organization: { status: "active" } } },
    include: { role: { include: { permissions: true } } },
  });
  if (!membership) {
    throw new TokMetricError(403, "WORKSPACE_FORBIDDEN", "An active membership in this workspace is required.");
  }
  return membership;
}
