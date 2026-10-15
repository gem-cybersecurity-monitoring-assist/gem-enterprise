import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidden,
  getRequestContext,
  requireSession,
} from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  createServiceRequest,
  getServiceRequestCenter,
  ServiceRequestDomainError,
  serviceRequestPriorityIds,
  serviceRequestTypeCatalog,
  serviceRequestTypeIds,
} from "@/lib/serviceRequests";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    workspaceId: z.string().trim().min(1).max(128).nullable().optional(),
    type: z.enum(serviceRequestTypeIds),
    subject: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(3000),
    priority: z.enum(serviceRequestPriorityIds).default("medium"),
  })
  .strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function sameOriginFailure(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return json(
      {
        error: "An explicit same-origin browser request is required.",
        code: "ORIGIN_REQUIRED",
      },
      403,
    );
  }

  try {
    if (new URL(origin).origin !== request.nextUrl.origin) {
      return json(
        {
          error: "Cross-origin service-request submissions are not allowed.",
          code: "SAME_ORIGIN_REQUIRED",
        },
        403,
      );
    }
  } catch {
    return json({ error: "The request origin is invalid.", code: "ORIGIN_INVALID" }, 403);
  }

  return null;
}

function domainError(error: unknown) {
  if (error instanceof ServiceRequestDomainError) {
    return json({ error: error.message, code: error.code }, error.statusCode);
  }

  console.error("[service-requests] request operation failed", error);
  return json({ error: "The service-request system is unavailable." }, 500);
}

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden("An active account is required for service requests.");
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  try {
    const center = await getServiceRequestCenter(gate.session.userId, workspaceId);
    return json({
      ...center,
      requestTypes: serviceRequestTypeCatalog,
      priorities: serviceRequestPriorityIds,
    });
  } catch (error) {
    return domainError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.accountStatus !== "active") {
    return forbidden("An active account is required for service requests.");
  }

  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;

  const context = getRequestContext(request);
  const limit = rateLimit(`${gate.session.userId}:${context.ipAddress}`, {
    key: "service-requests:create",
    windowMs: 10 * 60_000,
    max: 8,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = createSchema.safeParse(body);
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
    const created = await createServiceRequest({
      userId: gate.session.userId,
      workspaceId: data.workspaceId ?? null,
      type: data.type!,
      subject: data.subject!,
      description: data.description!,
      priority: data.priority ?? "medium",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return json({ ok: true, request: created }, 201);
  } catch (error) {
    return domainError(error);
  }
}
