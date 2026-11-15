import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireSession, serverError, serviceUnavailable } from "@/lib/api/auth-helpers";
import { getGatewaySessionToken } from "@/lib/auth";
import { hasCorePrismaRuntimeConfig } from "@/lib/core-prisma-readiness";
import { resolveWorkspaceAccess, type AccessibleWorkspace } from "@/lib/workspaceAccess";
import { workspaceGateway } from "@/lib/supabase-gateway";

export const dynamic = "force-dynamic";

// The existing project-bound Workspace Gateway is authoritative for gateway
// sessions. Reject malformed readbacks instead of displaying invented,
// cross-tenant or incomplete workspace records.
type WorkspaceSummary = Pick<AccessibleWorkspace, "id" | "name" | "controls"> & {
  organization: Pick<AccessibleWorkspace["organization"], "id" | "name">;
  role: Pick<AccessibleWorkspace["role"], "name">;
  counts: { members: number | null; connectors: number | null; approvalRecords: number | null };
};

function verifiedGatewayWorkspaces(value: unknown): WorkspaceSummary[] | null {
  if (!value || typeof value !== "object") return null;
  const rows = (value as { workspaces?: unknown }).workspaces;
  if (!Array.isArray(rows) || !rows.every((row) => {
    if (!row || typeof row !== "object") return false;
    const workspace = row as Record<string, unknown>;
    const organization = workspace.organization as Record<string, unknown> | undefined;
    const role = workspace.role as Record<string, unknown> | undefined;
    const counts = workspace.counts as Record<string, unknown> | undefined;
    const controls = workspace.controls as Record<string, unknown> | undefined;
    return typeof workspace.id === "string" && workspace.id.trim().length > 0
      && typeof workspace.name === "string"
      && !!organization && typeof organization.id === "string"
      && typeof organization.name === "string"
      && !!role && typeof role.name === "string"
      && !!counts && ["members", "connectors", "approvalRecords"].every((key) => {
        const count = counts[key];
        return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
      })
      && !!controls
      && ["globalEmergencyLock", "publishingDisabled", "advertisingDisabled",
          "shopWriteDisabled", "connectorDisabled"].every((key) => typeof controls[key] === "boolean");
  })) return null;
  const ids = rows.map((row: { id: string }) => row.id);
  if (new Set(ids).size !== ids.length) return null;
  // Never return gateway-owned extra properties or credential-like fields.
  return rows.map((row: WorkspaceSummary) => ({
    id: row.id,
    name: row.name,
    organization: { id: row.organization.id, name: row.organization.name },
    role: { name: row.role.name },
    // Current gem-workspace-gateway/access emits hardcoded 0 for these
    // three aggregates. Do not present those placeholders as verified data.
    // Keep direct-Prisma membership counts intact on the separate local path.
    counts: { members: null, connectors: null, approvalRecords: null },
    controls: {
      globalEmergencyLock: row.controls.globalEmergencyLock,
      publishingDisabled: row.controls.publishingDisabled,
      advertisingDisabled: row.controls.advertisingDisabled,
      shopWriteDisabled: row.controls.shopWriteDisabled,
      connectorDisabled: row.controls.connectorDisabled,
    },
  }));
}

function workspaceResponse(workspaces: WorkspaceSummary[], requestedWorkspaceId: string | null) {
  const selected = requestedWorkspaceId
    ? workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? null
    : workspaces[0] ?? null;
  if (requestedWorkspaceId && !selected) {
    return forbidden(
      "The requested workspace is not assigned to this account.",
      "WORKSPACE_ACCESS_DENIED",
    );
  }
  return NextResponse.json(
    { workspaces, selectedWorkspaceId: selected?.id ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden("An active account is required for workspace access.");
  }

  const requestedWorkspaceId = request.nextUrl.searchParams.get("workspaceId");

  // Match /app/workspace gateway authority. The gateway revalidates the
  // signed-in user and active workspace membership. The namespaced social
  // datasource is never promoted into a generic Prisma connection.
  if (gate.session.authSource === "supabase_gateway") {
    const token = await getGatewaySessionToken();
    if (!token) return serviceUnavailable("Authenticated workspace data is unavailable.");
    try {
      const result: unknown = await workspaceGateway("access", token);
      const workspaces = verifiedGatewayWorkspaces(result);
      if (!workspaces) return serviceUnavailable("Authenticated workspace data could not be verified.");
      return workspaceResponse(workspaces, requestedWorkspaceId);
    } catch {
      return serviceUnavailable("Authenticated workspace data is unavailable.");
    }
  }

  // Local sessions use the existing core Prisma datasource only.
  if (!hasCorePrismaRuntimeConfig()) {
    return serviceUnavailable("Workspace data backend is not configured.");
  }

  try {
    const resolution = await resolveWorkspaceAccess(gate.session.userId, requestedWorkspaceId);
    if (resolution.requestedDenied) {
      return forbidden(
        "The requested workspace is not assigned to this account.",
        "WORKSPACE_ACCESS_DENIED",
      );
    }
    return workspaceResponse(resolution.workspaces, requestedWorkspaceId);
  } catch (error) {
    console.error("[GET /api/workspaces] workspace resolution failed", error);
    return serverError("Workspace service unavailable");
  }
}
