import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGatewaySessionToken } from "@/lib/auth";
import { getRequestContext, requirePlatformOwner } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { GatewayRequestError } from "@/lib/supabase-gateway";
import { workspaceOwnerInvitationGateway } from "@/lib/workspace-owner-invitations-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const issueSchema = z
  .object({
    email: z.string().trim().email().max(254),
    confirmEmail: z.string().trim().email().max(254),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    organizationName: z.string().trim().min(2).max(120),
    workspaceName: z.string().trim().min(2).max(120),
    projectName: z.string().trim().min(2).max(120).optional().nullable(),
    projectSummary: z.string().trim().min(10).max(2000).optional().nullable(),
    reason: z.string().trim().min(12).max(500),
    expiresMinutes: z.number().int().min(15).max(10080).default(1440),
  })
  .strict()
  .refine(
    (value) => value.email.toLowerCase() === value.confirmEmail.toLowerCase(),
    { path: ["confirmEmail"], message: "Email confirmation does not match." },
  );

const revokeSchema = z.object({ id: z.string().uuid() }).strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function sameOriginFailure(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).origin !== request.nextUrl.origin) {
      return json({ error: "Cross-origin invitation requests are not allowed.", code: "SAME_ORIGIN_REQUIRED" }, 403);
    }
  } catch {
    return json({ error: "The request origin is invalid.", code: "ORIGIN_INVALID" }, 403);
  }
  return null;
}

async function authorizedToken() {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return { response: gate.response, token: null, userId: null };
  const token = await getGatewaySessionToken();
  if (!token) {
    return {
      response: json({ error: "A Supabase gateway Platform Owner session is required.", code: "GATEWAY_SESSION_REQUIRED" }, 401),
      token: null,
      userId: null,
    };
  }
  return { response: null, token, userId: gate.session.userId };
}

function gatewayError(error: GatewayRequestError) {
  return json({ error: error.message, code: error.code }, error.statusCode);
}

export async function GET() {
  const authorization = await authorizedToken();
  if (authorization.response || !authorization.token) return authorization.response;
  try {
    return json(await workspaceOwnerInvitationGateway("list", authorization.token));
  } catch (error) {
    if (error instanceof GatewayRequestError) return gatewayError(error);
    return json({ error: "Workspace owner invitations are unavailable." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizedToken();
  if (authorization.response || !authorization.token || !authorization.userId) return authorization.response;
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const { ipAddress } = getRequestContext(request);
  const limit = rateLimit(`${authorization.userId}:${ipAddress}`, {
    key: "admin:workspace-owner-invitations:write",
    windowMs: 5 * 60_000,
    max: 10,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invitation details are invalid.", details: parsed.error.flatten().fieldErrors }, 400);
  }

  try {
    return json(
      await workspaceOwnerInvitationGateway("issue", authorization.token, parsed.data),
      201,
    );
  } catch (error) {
    if (error instanceof GatewayRequestError) return gatewayError(error);
    return json({ error: "Workspace owner invitation could not be created." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = await authorizedToken();
  if (authorization.response || !authorization.token || !authorization.userId) return authorization.response;
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const { ipAddress } = getRequestContext(request);
  const limit = rateLimit(`${authorization.userId}:${ipAddress}`, {
    key: "admin:workspace-owner-invitations:write",
    windowMs: 5 * 60_000,
    max: 10,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invitation identifier is invalid." }, 400);

  try {
    return json(await workspaceOwnerInvitationGateway("revoke", authorization.token, parsed.data));
  } catch (error) {
    if (error instanceof GatewayRequestError) return gatewayError(error);
    return json({ error: "Workspace owner invitation could not be revoked." }, 503);
  }
}
