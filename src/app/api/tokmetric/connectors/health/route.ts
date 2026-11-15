import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSocialConnectorSession, requireSocialConnectorWorkspace, tokMetricConnectorDatabase } from "@/lib/social-media/connector-authority";
import { correlationId, emitTokMetricAudit, requirePermission, tokMetricErrorResponse } from "@/lib/tokmetric/security";
import { verifyTikTokConnections } from "@/lib/tokmetric/oauth/health";

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireSocialConnectorSession(request, true);
    const database = tokMetricConnectorDatabase(session) ?? db;
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "workspaceId is required", correlationId: cid } }, { status: 400 });
    const membership = await requireSocialConnectorWorkspace(workspaceId, session, database);
    requirePermission(membership, "manage", "connectors");
    const checks = await verifyTikTokConnections(workspaceId, database);
    await emitTokMetricAudit({ workspaceId, actorId: session.userId, action: "tokmetric.connector.identity_checked", entityType: "connector", correlationId: cid, outcome: checks.length > 0 && checks.every(check => check.status === "verified") ? "success" : "review_required", metadata: { checks }, sourceChannel: "website" }, database);
    return NextResponse.json({ ok: true, correlationId: cid, checks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
