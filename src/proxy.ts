import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, resolveAccessDestination } from "@/lib/auth";
import { isAtrManagedHost, toAtrInternalPath } from "@/lib/atrOperationalConfig";

const SUPER_ADMIN_PREFIXES = ["/app/super-admin"];
const ADMIN_PREFIXES = [
  "/app/admin",
  "/app/command-center",
  "/admin",
  "/compliance/admin",
];
const REVIEW_PREFIXES = ["/review"];
const PROTECTED_PREFIXES = [
  "/app",
  "/kyc",
  "/decision",
  "/portal",
  "/access",
  "/account",
  "/billing",
  "/documents",
  "/messages",
  "/requests",
  "/community-hub/members",
  "/community-hub/messages",
  "/community-hub/requests",
  "/community-hub/profile",
  "/community-hub/settings",
  "/community-hub/opportunities",
  ...SUPER_ADMIN_PREFIXES,
  ...ADMIN_PREFIXES,
  ...REVIEW_PREFIXES,
];

const ALWAYS_PUBLIC = [
  "/",
  "/intel",
  "/assets",
  "/community",
  "/hub",
  "/about",
  "/contact",
  "/resources",
  "/services",
  "/company",
  "/get-started",
  "/eligibility",
  "/eligibility/status",
  "/request-access",
  "/privacy",
  "/terms",
  "/compliance-notice",
  "/cookie-policy",
  "/trust-center",
  "/login",
  "/client-login",
  "/team-login",
  "/admin-login",
  "/super-admin-login",
  "/workspace-invitation",
  "/forgot-password",
  "/reset-password",
  "/api/health",
  "/api/routes",
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtected(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

function isSuperAdminRoute(pathname: string): boolean {
  return matchesPrefix(pathname, SUPER_ADMIN_PREFIXES);
}

function isAdminRoute(pathname: string): boolean {
  return matchesPrefix(pathname, ADMIN_PREFIXES);
}

function isReviewRoute(pathname: string): boolean {
  return matchesPrefix(pathname, REVIEW_PREFIXES);
}

function isAuthRoute(pathname: string): boolean {
  return ["/login", "/client-login", "/team-login", "/admin-login", "/super-admin-login"].includes(pathname);
}

function loginPathFor(pathname: string): string {
  if (isSuperAdminRoute(pathname)) return "/super-admin-login";
  if (
    pathname.startsWith("/app/admin/workspace-access") ||
    pathname.startsWith("/app/admin/plan-workspaces")
  ) {
    return "/super-admin-login";
  }
  if (isAdminRoute(pathname)) return "/admin-login";
  if (isReviewRoute(pathname)) return "/team-login";
  return "/client-login";
}

function isStaticOrApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");

  // GEM-controlled ATR host routing. This is intentionally independent of
  // alliancetrustrealty.com so the real-estate division can remain operational
  // while registrar/DNS control of that external domain is unresolved.
  if (isAtrManagedHost(host) && !isStaticOrApiPath(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = toAtrInternalPath(pathname);
    return NextResponse.rewrite(destination);
  }

  if (isStaticOrApiPath(pathname)) {
    return NextResponse.next();
  }

  const authRoute = isAuthRoute(pathname);
  if (ALWAYS_PUBLIC.includes(pathname) && !authRoute) return NextResponse.next();

  let session = null;
  try {
    session = await getSessionFromRequest(request);
  } catch (error) {
    console.error("[middleware] session read failed:", error);
  }

  if (authRoute) {
    if (session) {
      return NextResponse.redirect(new URL(resolveAccessDestination(session), request.url));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-is-portal", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isProtected(pathname)) {
    if (!session) {
      const loginUrl = new URL(loginPathFor(pathname), request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === "/app/admin" && session.role === "super_admin") {
      return NextResponse.redirect(new URL("/app/super-admin", request.url));
    }

    if (isSuperAdminRoute(pathname) && session.role !== "super_admin") {
      return NextResponse.redirect(
        new URL(resolveAccessDestination(session), request.url),
      );
    }

    if (
      isAdminRoute(pathname) &&
      !["admin", "super_admin", "internal"].includes(session.role)
    ) {
      return NextResponse.redirect(new URL("/app/dashboard", request.url));
    }

    if (
      isReviewRoute(pathname) &&
      !["analyst", "admin", "super_admin", "internal"].includes(session.role)
    ) {
      return NextResponse.redirect(new URL("/app/dashboard", request.url));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-email", session.email);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-kyc-status", session.kycStatus);
    requestHeaders.set("x-user-entitlements", session.entitlements.join(","));

    if (session.kycApplicationId) {
      requestHeaders.set("x-kyc-application-id", session.kycApplicationId);
    }
    if (session.portfolioId) requestHeaders.set("x-portfolio-id", session.portfolioId);
    if (session.organizationId) {
      requestHeaders.set("x-organization-id", session.organizationId);
    }
    if (pathname.startsWith("/app") || pathname.startsWith("/access")) {
      requestHeaders.set("x-is-portal", "1");
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|placeholder.svg).*)",
  ],
};
