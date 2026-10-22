import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { isSameOriginWorkspaceRequest } from "@/lib/organizationWorkspace";
import {
  forbidden,
  getRequestContext,
  isStaffRole,
  requireSession,
} from "@/lib/api/auth-helpers";
import {
  assignServiceRequest,
  getServiceRequestForAdmin,
  REQUEST_LIFECYCLE_STATUSES,
  ServiceRequestDomainError,
  transitionServiceRequest,
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

type Gate = Awaited<ReturnType<typeof requireSession>>;

function actorFromGate(gate: Extract<Gate, { ok: true }>) {
  return { userId: gate.session.userId, role: gate.session.role };
}

const patchSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("assign"),
      assigneeUserId: z.string().trim().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("transition"),
      toStatus: z.enum(REQUEST_LIFECYCLE_STATUSES),
      note: z.string().trim().max(1000).optional(),
    })
    .strict(),
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden(
      "An active account is required for service-request administration.",
    );
  }
  if (!isStaffRole(gate.session.role)) return forbidden();

  const { id } = await context.params;

  try {
    const request = await getServiceRequestForAdmin(id, actorFromGate(gate));
    return json({ ok: true, request });
  } catch (error) {
    return domainError(error, "[GET /api/admin/requests/:id]");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden(
      "An active account is required for service-request administration.",
    );
  }
  if (!isStaffRole(gate.session.role)) return forbidden();

  if (!isSameOriginWorkspaceRequest(request.headers.get("origin"), request.nextUrl.origin)) {
    return forbidden("An explicit same-origin request is required.", "SAME_ORIGIN_REQUIRED");
  }
  const requestContext = getRequestContext(request);
  const limit = await rateLimit(`${gate.session.userId}:${requestContext.ipAddress}`, {
    key: "admin:service-requests:write", windowMs: 60_000, max: 20,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds, limit.unavailable);

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      400,
    );
  }

  const actor = actorFromGate(gate);

  try {
    if (parsed.data.action === "assign") {
      const result = await assignServiceRequest(
        id,
        parsed.data.assigneeUserId,
        actor,
        requestContext,
      );
      return json({ ok: true, request: result });
    }

    const result = await transitionServiceRequest(
      id,
      parsed.data.toStatus,
      actor,
      { ...requestContext, note: parsed.data.note },
    );
    return json({ ok: true, request: result });
  } catch (error) {
    return domainError(error, "[PATCH /api/admin/requests/:id]");
  }
}
