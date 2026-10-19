import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, requireSession } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { db } from "@/lib/db";
import { isSameOriginWorkspaceRequest, OrganizationWorkspaceError, requireWorkspacePermission, slugifyOrganization } from "@/lib/organizationWorkspace";
import { getGatewaySessionToken } from "@/lib/auth";
import { GatewayRequestError, workspaceGateway } from "@/lib/supabase-gateway";

const schema = z.object({ workspaceId: z.string().min(1).max(128), name: z.string().trim().min(2).max(120), summary: z.string().trim().min(10).max(2000), status: z.enum(["PLANNED","ACTIVE","PAUSED","COMPLETED"]).default("PLANNED"), progress: z.number().int().min(0).max(100).default(0), targetDate: z.string().date().optional().nullable() }).strict();
export async function POST(request: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response;
  if (!isSameOriginWorkspaceRequest(request.headers.get("origin"), request.nextUrl.origin)) return NextResponse.json({ error: "A same-origin request is required.", code: "SAME_ORIGIN_REQUIRED" }, { status: 403 });
  const { ipAddress, userAgent } = getRequestContext(request);
  const limit = rateLimit(`${gate.session.userId}:${ipAddress}`, { key: "workspace:projects", windowMs: 60_000, max: 20 });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  try {
    if(gate.session.authSource==="supabase_gateway"){const token=await getGatewaySessionToken();if(!token)return NextResponse.json({error:"Gateway session required"},{status:401});return NextResponse.json(await workspaceGateway("create_project",token,parsed.data),{status:201})}
    await requireWorkspacePermission(gate.session.userId, parsed.data.workspaceId, "manage", "projects");
    const project = await db.organizationProject.create({ data: { workspaceId: parsed.data.workspaceId, name: parsed.data.name, summary: parsed.data.summary, status: parsed.data.status, progress: parsed.data.progress, slug: slugifyOrganization(parsed.data.name), ownerUserId: gate.session.userId, targetDate: parsed.data.targetDate ? new Date(`${parsed.data.targetDate}T00:00:00.000Z`) : null } });
    await db.auditLog.create({ data: { userId: gate.session.userId, action: "admin_action", resource: "organization_project", resourceId: project.id, metadata: { operation: "project_created", workspaceId: project.workspaceId, name: project.name }, ipAddress, userAgent } });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if(error instanceof GatewayRequestError)return NextResponse.json({error:error.message,code:error.code},{status:error.statusCode});
    if (error instanceof OrganizationWorkspaceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    return NextResponse.json({ error: "Project creation failed" }, { status: 500 });
  }
}
