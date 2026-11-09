import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type AuditMetadata = { operation?: unknown; fromStatus?: unknown; toStatus?: unknown };

/**
 * Request history is deliberately recipient-scoped. Staff can use the existing
 * audited admin case view; this endpoint serves only the request owner, with
 * active workspace membership when a request belongs to an organization.
 */
export async function GET(_request: Request, context: Context) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return NextResponse.json({ error: "Active account required." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id?.trim() || id.length > 128) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };

  try {
    const record = await db.serviceRequest.findFirst({
      where: { id, userId: gate.session.userId },
      select: {
        id: true,
        userId: true,
        workspaceId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!record) return NextResponse.json({ error: "Request not found." }, { status: 404, headers });

    if (record.workspaceId) {
      const membership = await db.workspaceMember.findFirst({
        where: {
          workspaceId: record.workspaceId,
          userId: gate.session.userId,
          status: "active",
          workspace: { organization: { status: "active" } },
        },
        select: { id: true },
      });
      if (!membership) return NextResponse.json({ error: "Request not found." }, { status: 404, headers });
    }

    const rows = await db.auditLog.findMany({
      where: { resource: "service_request", resourceId: record.id },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { action: true, metadata: true, createdAt: true },
    });

    const events = rows.flatMap((row) => {
      const metadata = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata))
        ? row.metadata as AuditMetadata
        : {};
      const operation = typeof metadata.operation === "string" ? metadata.operation : null;
      const created = row.action === "case_created";
      const transitioned = operation === "case_status_changed";
      const assigned = operation === "case_assigned";
      if (!created && !transitioned && !assigned) return [];
      return [{
        kind: created ? "created" : transitioned ? "status_changed" : "assigned",
        occurredAt: row.createdAt.toISOString(),
        ...(transitioned && typeof metadata.toStatus === "string"
          ? { status: ["open", "in_progress", "pending_info", "completed", "cancelled"].includes(metadata.toStatus)
              ? metadata.toStatus : "unavailable" }
          : {}),
      }];
    });

    return NextResponse.json({
      ok: true,
      requestId: record.id,
      currentStatus: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      events,
      historyLimitedTo: 100,
    }, { headers });
  } catch (error) {
    console.error("[GET /api/requests/:id/timeline] unavailable", error);
    return NextResponse.json({ error: "Request history temporarily unavailable." }, { status: 503, headers });
  }
}
