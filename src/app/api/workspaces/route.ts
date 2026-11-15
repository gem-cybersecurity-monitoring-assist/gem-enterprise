import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireSession, serverError, serviceUnavailable } from "@/lib/api/auth-helpers";
import { hasCorePrismaRuntimeConfig } from "@/lib/core-prisma-readiness";
import { resolveWorkspaceAccess } from "@/lib/workspaceAccess";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden("An active account is required for workspace access.");
  }

  // A gateway bootstrap health check is not a transactional workspace store.
  // Fail closed rather than invoking Prisma without an authorized core URL.
  if (!hasCorePrismaRuntimeConfig()) {
    return serviceUnavailable("Workspace data backend is not configured.");
  }

  const requestedWorkspaceId = request.nextUrl.searchParams.get("workspaceId");

  try {
    const resolution = await resolveWorkspaceAccess(
      gate.session.userId,
      requestedWorkspaceId,
    );

    if (resolution.requestedDenied) {
      return forbidden(
        "The requested workspace is not assigned to this account.",
        "WORKSPACE_ACCESS_DENIED",
      );
    }

    return NextResponse.json(
      {
        workspaces: resolution.workspaces,
        selectedWorkspaceId: resolution.selected?.id ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[GET /api/workspaces] workspace resolution failed", error);
    return serverError("Workspace service unavailable");
  }
}
