import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidden,
  isStaffRole,
  requireSession,
} from "@/lib/api/auth-helpers";
import {
  listServiceRequestsForAdmin,
  ServiceRequestDomainError,
} from "@/lib/serviceRequests";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function domainError(error: unknown, scope: string) {
  if (error instanceof ServiceRequestDomainError) {
    return json({ error: error.message, code: error.code }, error.statusCode);
  }
  console.error(scope, error);
  return json({ error: "The service-request admin system is unavailable." }, 500);
}

const querySchema = z
  .object({
    status: z.array(z.string()).optional(),
    type: z.array(z.string()).optional(),
    workspaceId: z.string().trim().min(1).max(128).nullish(),
    organizationId: z.string().trim().min(1).max(128).nullish(),
    search: z.string().trim().min(1).max(200).nullish(),
    assignedTo: z.string().trim().min(1).max(128).nullish(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden(
      "An active account is required for service-request administration.",
    );
  }
  if (!isStaffRole(gate.session.role)) return forbidden();

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    status: params.getAll("status").length ? params.getAll("status") : undefined,
    type: params.getAll("type").length ? params.getAll("type") : undefined,
    workspaceId: params.get("workspaceId"),
    organizationId: params.get("organizationId"),
    search: params.get("search"),
    assignedTo: params.get("assignedTo"),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    const data = parsed.data;
    const result = await listServiceRequestsForAdmin({
      actor: { userId: gate.session.userId, role: gate.session.role },
      statuses: data.status,
      types: data.type,
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      search: data.search,
      assignedTo: data.assignedTo,
      page: data.page,
      pageSize: data.pageSize,
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return domainError(error, "[GET /api/admin/requests]");
  }
}
