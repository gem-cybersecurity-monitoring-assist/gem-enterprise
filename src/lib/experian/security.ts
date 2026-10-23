import { NextRequest } from "next/server";
import {
  enforceEmergencyLocks,
  requireActiveTokMetricSession,
  requirePermission,
  requireWorkspaceAccess,
  TokMetricError,
} from "@/lib/tokmetric/security";

export function requireTrustedExperianNavigation(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new TokMetricError(
      403,
      "CROSS_SITE_AUTHORIZATION_BLOCKED",
      "Experian authorization must start from Financial Shield.",
    );
  }
}

export function requireSameOriginExperianMutation(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new TokMetricError(403, "CROSS_SITE_REQUEST_BLOCKED", "Cross-site request was blocked.");
  }
  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) {
        throw new TokMetricError(403, "ORIGIN_MISMATCH", "Request origin was not accepted.");
      }
    } catch (error) {
      if (error instanceof TokMetricError) throw error;
      throw new TokMetricError(403, "ORIGIN_MISMATCH", "Request origin was not accepted.");
    }
  }
}

export async function authorizeExperianWorkspace(request: NextRequest, workspaceId: string) {
  const session = await requireActiveTokMetricSession(request);
  const membership = await requireWorkspaceAccess(workspaceId, session);
  requirePermission(membership, "manage", "connectors");
  await enforceEmergencyLocks(workspaceId, "connector");
  return session;
}
