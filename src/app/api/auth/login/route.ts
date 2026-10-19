import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  signSession,
  setSessionCookie,
  resolveAccessDestination,
  type IssuedSessionPayload,
  type SessionPayload,
} from "@/lib/auth";
import { emitAuditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  GatewayRequestError,
  loginWithGateway,
  shouldUseSupabaseGateway,
  wrapGatewayToken,
} from "@/lib/supabase-gateway";

const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  password: z.string().min(1, "Password is required").max(256),
});

const INVALID_CREDENTIALS = { error: "Invalid credentials" };

type CanonicalUser = Awaited<ReturnType<typeof findCanonicalUser>>;

async function findCanonicalUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    include: {
      entitlements: { where: { isActive: true } },
      kycApplications: { orderBy: { createdAt: "desc" }, take: 1 },
      portfolioMemberships: { take: 1, orderBy: { assignedAt: "desc" } },
    },
  });
}

function canonicalSessionPayload(
  user: NonNullable<CanonicalUser>,
): IssuedSessionPayload {
  const latestKyc = user.kycApplications[0] ?? null;
  return {
    userId: user.id,
    email: user.email,
    role: user.role as IssuedSessionPayload["role"],
    kycStatus: (latestKyc?.status ??
      "not_started") as IssuedSessionPayload["kycStatus"],
    entitlements: user.entitlements.map((entitlement) => entitlement.slug),
    sessionVersion: user.sessionVersion,
    kycApplicationId: latestKyc?.id ?? undefined,
    portfolioId: user.portfolioMemberships[0]?.portfolioId ?? undefined,
    organizationId: user.organizationId ?? undefined,
  };
}

function validGatewaySession(session: SessionPayload): session is IssuedSessionPayload {
  return (
    Number.isSafeInteger(session.sessionVersion) &&
    Number(session.sessionVersion) >= 0 &&
    session.authSource === "supabase_gateway"
  );
}

async function issueCanonicalSession(
  user: NonNullable<CanonicalUser>,
  ipAddress: string,
  userAgent: string,
  source: "local_password",
) {
  if (!user.isActive || user.status === "suspended") {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  const sessionPayload = canonicalSessionPayload(user);
  const token = await signSession(sessionPayload);
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await emitAuditLog({
    userId: user.id,
    action: "login",
    resource: "user",
    resourceId: user.id,
    metadata: {
      email: user.email,
      source,
      sessionVersion: user.sessionVersion,
    },
    ipAddress,
    userAgent,
  });

  const response = NextResponse.json({
    success: true,
    role: sessionPayload.role,
    kycStatus: sessionPayload.kycStatus,
    redirect: resolveAccessDestination(sessionPayload),
  });
  return setSessionCookie(response, token);
}

function issueGatewaySession(session: IssuedSessionPayload, token: string) {
  const response = NextResponse.json(
    {
      success: true,
      role: session.role,
      kycStatus: session.kycStatus,
      redirect: resolveAccessDestination(session),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  return setSessionCookie(response, wrapGatewayToken(token));
}

async function localLogin(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string,
) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      entitlements: { where: { isActive: true } },
      kycApplications: { orderBy: { createdAt: "desc" }, take: 1 },
      portfolioMemberships: { take: 1, orderBy: { assignedAt: "desc" } },
    },
  });

  const placeholderHash =
    "$2a$12$C6UzMDM.H6dfI/f/IKxGhuM6NXk0RvPhgZQ1.0Y8wIJtZk4jAr8s2";
  const passwordValid = await bcrypt.compare(
    password,
    user?.passwordHash ?? placeholderHash,
  );

  if (!user || !passwordValid) {
    await emitAuditLog({
      userId: user?.id,
      action: "failed_login",
      resource: "auth",
      metadata: {
        email: email.toLowerCase(),
        reason: !user ? "unknown_user" : "bad_password",
      },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  return issueCanonicalSession(user, ipAddress, userAgent, "local_password");
}

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestContext(request);
  const limit = rateLimit(ipAddress, {
    key: "auth:login",
    windowMs: 5 * 60_000,
    max: 10,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  if (!shouldUseSupabaseGateway()) {
    try {
      return await localLogin(email, password, ipAddress, userAgent);
    } catch (error) {
      console.error("[POST /api/auth/login local]", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  }

  try {
    const result = await loginWithGateway(email, password);
    if (
      !validGatewaySession(result.session) ||
      result.session.email.toLowerCase() !== email.toLowerCase()
    ) {
      return NextResponse.json(INVALID_CREDENTIALS, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return issueGatewaySession(result.session, result.token);
  } catch (error) {
    if (error instanceof GatewayRequestError) {
      const status = [400, 401, 403, 429].includes(error.statusCode)
        ? error.statusCode
        : 503;
      return NextResponse.json(
        {
          error: status === 401 ? "Invalid credentials" : error.message,
          code: error.code,
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[POST /api/auth/login gateway]", error);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
