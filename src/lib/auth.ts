import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import {
  shouldUseSupabaseGateway,
  unwrapGatewayToken,
  verifyGatewaySession,
} from "@/lib/supabase-gateway";

export const SESSION_COOKIE = "gem_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type AuthRole =
  | "client"
  | "analyst"
  | "admin"
  | "super_admin"
  | "internal";
export type KYCStatus =
  | "not_started"
  | "started"
  | "in_progress"
  | "documents_uploaded"
  | "under_review"
  | "manual_review"
  | "approved"
  | "rejected"
  | "expired";

export interface SessionPayload {
  userId: string;
  email: string;
  role: AuthRole;
  kycStatus: KYCStatus;
  entitlements: string[];
  sessionVersion?: number;
  kycApplicationId?: string;
  portfolioId?: string;
  organizationId?: string;
  authSource?: "local" | "supabase_gateway";
  iat?: number;
  exp?: number;
}

export type IssuedSessionPayload = SessionPayload & { sessionVersion: number };

export interface AuthState {
  isAuthenticated: boolean;
  session: SessionPayload | null;
  isAdmin: boolean;
  isApproved: boolean;
  kycStatus: KYCStatus;
}

const AUTH_ROLES: readonly AuthRole[] = [
  "client",
  "analyst",
  "admin",
  "super_admin",
  "internal",
];

function secret() {
  const value = process.env.JWT_SECRET;
  if (value && value.length >= 32) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  return new TextEncoder().encode(
    "development-only-secret-change-before-production",
  );
}

function validSessionVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validRole(value: unknown): value is AuthRole {
  return typeof value === "string" && AUTH_ROLES.includes(value as AuthRole);
}

function validGatewaySession(session: SessionPayload): boolean {
  return (
    Boolean(session.userId) &&
    Boolean(session.email) &&
    validRole(session.role) &&
    validSessionVersion(session.sessionVersion) &&
    session.authSource === "supabase_gateway"
  );
}

export async function signSession(payload: IssuedSessionPayload) {
  if (!validSessionVersion(payload.sessionVersion)) {
    throw new Error(
      "A non-negative session version is required when issuing a session.",
    );
  }
  return new SignJWT({ ...payload, authSource: "local" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer("gem-enterprise")
    .setAudience("gem-client")
    .setJti(crypto.randomUUID())
    .sign(secret());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "gem-enterprise",
      audience: "gem-client",
    });
    const session = payload as unknown as SessionPayload;
    if (
      !session.userId ||
      !session.email ||
      !validRole(session.role) ||
      !validSessionVersion(session.sessionVersion)
    ) {
      return null;
    }
    return { ...session, authSource: "local" };
  } catch {
    return null;
  }
}

async function validateDirectSessionAuthority(
  claims: SessionPayload,
): Promise<SessionPayload | null> {
  if (!validSessionVersion(claims.sessionVersion)) return null;

  try {
    const { db } = await import("@/lib/db");
    const account = await db.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        isActive: true,
        organizationId: true,
        sessionVersion: true,
      },
    });
    if (
      !account ||
      !account.isActive ||
      account.status === "suspended" ||
      !validRole(account.role) ||
      claims.sessionVersion !== account.sessionVersion
    ) {
      return null;
    }
    return {
      ...claims,
      email: account.email,
      role: account.role,
      organizationId: account.organizationId ?? undefined,
      sessionVersion: account.sessionVersion,
      authSource: "local",
    };
  } catch (error) {
    console.error("[auth] direct session authority check failed", error);
    return null;
  }
}

async function resolveSessionToken(
  token: string,
): Promise<SessionPayload | null> {
  const gatewayToken = unwrapGatewayToken(token);
  if (gatewayToken) {
    try {
      const gatewaySession = await verifyGatewaySession(gatewayToken);
      return validGatewaySession(gatewaySession) ? gatewaySession : null;
    } catch {
      return null;
    }
  }

  const local = await verifySession(token);
  if (!local || shouldUseSupabaseGateway()) return null;
  return validateDirectSessionAuthority(local);
}

export async function getSessionCookieValue(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getGatewaySessionToken(): Promise<string | null> {
  const value = await getSessionCookieValue();
  return value ? unwrapGatewayToken(value) : null;
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const token = await getSessionCookieValue();
    return token ? await resolveSessionToken(token) : null;
  } catch {
    return null;
  }
}

export async function createSessionCookie(
  payload: IssuedSessionPayload,
): Promise<string> {
  return signSession(payload);
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? resolveSessionToken(token) : null;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function resolveAccessDestination(session: SessionPayload): string {
  if (session.role === "super_admin") return "/app/super-admin";
  if (["admin", "internal"].includes(session.role)) return "/app/admin";
  if (session.role === "analyst") return "/review/verification";
  if (session.kycStatus === "not_started") return "/kyc/start";
  if (
    ["started", "in_progress", "documents_uploaded"].includes(
      session.kycStatus,
    )
  ) {
    return "/kyc/status";
  }
  if (session.kycStatus === "under_review") return "/decision/pending";
  if (["manual_review", "rejected", "expired"].includes(session.kycStatus)) {
    return "/kyc/status";
  }
  if (session.portfolioId) return `/app/portfolios/${session.portfolioId}`;
  if (session.entitlements.includes("cyber")) return "/app/products/cyber";
  if (session.entitlements.includes("financial")) {
    return "/app/products/financial";
  }
  if (session.entitlements.includes("real-estate")) {
    return "/app/products/real-estate";
  }
  return "/app/dashboard";
}

export function resolveAuthState(session: SessionPayload | null): AuthState {
  return {
    isAuthenticated: Boolean(session),
    session,
    isAdmin: Boolean(
      session &&
        ["admin", "super_admin", "internal"].includes(session.role),
    ),
    isApproved: session?.kycStatus === "approved",
    kycStatus: session?.kycStatus ?? "not_started",
  };
}
