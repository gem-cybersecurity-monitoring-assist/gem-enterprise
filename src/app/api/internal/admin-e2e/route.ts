import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  e2eProvisionGateway,
  GatewayRequestError,
  runPendingAdminLoginSmoke,
} from "@/lib/supabase-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function derivePassword(token: string): string {
  const digest = createHash("sha256")
    .update(`gem-admin-temp:${token}`)
    .digest("base64url")
    .slice(0, 24);
  return `Gm!7Aa${digest}`;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

async function login(origin: string, email: string, password: string) {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, portal: "admin" }),
    cache: "no-store",
    redirect: "manual",
  });
  const body = await readJson(response);
  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0] || "";
  return { response, body, setCookie, cookie };
}

async function authenticatedGet(origin: string, path: string, cookie: string) {
  const response = await fetch(`${origin}${path}`, {
    headers: { Cookie: cookie },
    cache: "no-store",
    redirect: "manual",
  });
  return { response, text: await response.text() };
}

export async function GET() {
  try {
    const result = await runPendingAdminLoginSmoke<{
      ok: boolean;
      checks: Record<string, boolean>;
      credentialsExposed: boolean;
      persistentTestAccount: boolean;
    }>();

    return NextResponse.json(result, {
      status: result.ok ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof GatewayRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.statusCode,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return NextResponse.json(
      { error: "Administrator smoke run is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token =
    body && typeof body === "object" && "token" in body
      ? String((body as { token: unknown }).token)
      : "";
  if (token.length < 32) {
    return NextResponse.json({ error: "Invalid self-test token" }, { status: 403 });
  }

  const origin = request.nextUrl.origin;
  const suffix = createHash("sha256")
    .update(`e2e:${token}`)
    .digest("hex")
    .slice(0, 24);
  const testEmail = `e2e-${suffix}@example.invalid`;
  const testPassword = `E2e!9Aa${createHash("sha256").update(token).digest("base64url").slice(0, 24)}`;
  const testPasswordHash = await bcrypt.hash(testPassword, 12);
  const realAdminPassword = derivePassword(token);
  let testUserId = "";
  let cleaned = false;

  const checks: Record<string, boolean> = {};

  try {
    const provisioned = await e2eProvisionGateway<{
      ok: boolean;
      userId: string;
      email: string;
    }>("create", {
      e2eToken: token,
      email: testEmail,
      passwordHash: testPasswordHash,
    });
    testUserId = provisioned.userId;
    checks.testProvisioned = provisioned.ok && Boolean(testUserId);

    const testLogin = await login(origin, testEmail, testPassword);
    checks.testLogin =
      testLogin.response.status === 200 && testLogin.body.success === true;
    checks.testCookie =
      testLogin.cookie.startsWith("gem_session=sg1.") &&
      /HttpOnly/i.test(testLogin.setCookie) &&
      /Secure/i.test(testLogin.setCookie);

    const testSession = await authenticatedGet(
      origin,
      "/api/auth/session",
      testLogin.cookie,
    );
    const testSessionBody = JSON.parse(testSession.text || "{}") as Record<
      string,
      unknown
    >;
    checks.testSession =
      testSession.response.status === 200 &&
      testSessionBody.authenticated === true &&
      testSessionBody.role === "admin";

    const testAdminPage = await authenticatedGet(
      origin,
      "/app/admin",
      testLogin.cookie,
    );
    checks.testAdminPortal =
      testAdminPage.response.status === 200 &&
      testAdminPage.text.includes("Admin Center");

    const testUsers = await authenticatedGet(
      origin,
      "/api/admin/users",
      testLogin.cookie,
    );
    const testUsersBody = JSON.parse(testUsers.text || "{}") as {
      users?: unknown[];
    };
    checks.testUsersApi =
      testUsers.response.status === 200 && Array.isArray(testUsersBody.users);

    const testStats = await authenticatedGet(
      origin,
      "/api/admin/stats",
      testLogin.cookie,
    );
    const testStatsBody = JSON.parse(testStats.text || "{}") as Record<
      string,
      unknown
    >;
    checks.testStatsApi =
      testStats.response.status === 200 &&
      typeof testStatsBody.totalUsers === "number";

    const testReadiness = await authenticatedGet(
      origin,
      "/api/verify/pilot-readiness",
      testLogin.cookie,
    );
    const readinessBody = JSON.parse(testReadiness.text || "{}") as Record<
      string,
      unknown
    >;
    checks.testReadinessApi =
      testReadiness.response.status === 200 && Array.isArray(readinessBody.checks);

    const realLogin = await login(
      origin,
      "admin@gemcybersecurityassist.com",
      realAdminPassword,
    );
    checks.realAdminLogin =
      realLogin.response.status === 200 && realLogin.body.success === true;
    checks.realAdminCookie = realLogin.cookie.startsWith("gem_session=sg1.");

    const realSession = await authenticatedGet(
      origin,
      "/api/auth/session",
      realLogin.cookie,
    );
    const realSessionBody = JSON.parse(realSession.text || "{}") as Record<
      string,
      unknown
    >;
    checks.realAdminSession =
      realSession.response.status === 200 &&
      realSessionBody.email === "admin@gemcybersecurityassist.com" &&
      realSessionBody.role === "admin";

    const realAdminPage = await authenticatedGet(
      origin,
      "/app/admin",
      realLogin.cookie,
    );
    checks.realAdminPortal =
      realAdminPage.response.status === 200 &&
      realAdminPage.text.includes("Admin Center");

    const realUsers = await authenticatedGet(
      origin,
      "/api/admin/users",
      realLogin.cookie,
    );
    checks.realAdminUsersApi = realUsers.response.status === 200;
  } catch (error) {
    console.error("[admin-e2e]", error);
  } finally {
    if (testUserId) {
      try {
        const cleanup = await e2eProvisionGateway<{
          ok: boolean;
          cleaned: boolean;
        }>("cleanup", { e2eToken: token, userId: testUserId });
        cleaned = cleanup.ok && cleanup.cleaned;
      } catch (error) {
        console.error("[admin-e2e cleanup]", error);
      }
    }
  }

  checks.cleanup = cleaned;
  const passed =
    Object.keys(checks).length === 12 && Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      ok: passed,
      checks,
      credentialsExposed: false,
      persistentTestAccount: !cleaned,
    },
    {
      status: passed ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
