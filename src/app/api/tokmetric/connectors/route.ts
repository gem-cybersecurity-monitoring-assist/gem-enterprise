import { requireSocialConnectorSession, requireSocialConnectorWorkspace } from "@/lib/social-media/connector-authority";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { correlationId, parseJson, requirePermission, tokMetricErrorResponse } from "@/lib/tokmetric/security";
import { disconnectConnector, listWorkspaceConnectors } from "@/lib/tokmetric/oauth/connectors";

const disconnectSchema = z.object({ workspaceId: z.string().min(1), connectorId: z.string().min(1), revoke: z.boolean().default(false) });

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireSocialConnectorSession(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "workspaceId is required", correlationId: cid } }, { status: 400 });
    await requireSocialConnectorWorkspace(workspaceId, session);
    const connectors = await listWorkspaceConnectors(workspaceId);
    return NextResponse.json({ ok: true, correlationId: cid, connectors });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}

export async function DELETE(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireSocialConnectorSession(request);
    const body = await parseJson(request, disconnectSchema);
    const membership = await requireSocialConnectorWorkspace(body.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await disconnectConnector({ workspaceId: body.workspaceId, connectorId: body.connectorId, actorId: session.userId, correlationId: cid, revoke: body.revoke });
    return NextResponse.json({ ok: true, correlationId: cid });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
