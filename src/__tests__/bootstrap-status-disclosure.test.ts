import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ result: null as unknown }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: vi.fn(async () => gate.result) }));
vi.mock("@/lib/supabase-gateway", () => ({
  bootstrapGatewayStatus: vi.fn(async () => ({ configured: true, admin: null })),
  evidenceGatewayHealth: vi.fn(async () => ({ ok: true, service: "x", version: "1", failClosed: true })),
  hasDirectDatabaseConfiguration: vi.fn(() => true),
  shouldUseSupabaseGateway: vi.fn(() => false),
}));

import { GET } from "@/app/api/system/bootstrap-status/route";

const denied = (status: number) => ({ ok: false, response: NextResponse.json({ error: "denied" }, { status }) });

describe("GET /api/system/bootstrap-status disclosure", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "x".repeat(32));
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.example.test");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef");
  });

  it.each([
    ["anonymous", denied(401)],
    ["non-admin", denied(403)],
    ["gate unavailable", denied(503)],
  ])("returns only liveness and readiness to %s callers", async (_label, result) => {
    gate.result = result;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["core", "detailsRequireAdministrator", "evaluatedAt", "ok", "service"]);
    expect(body.core).toEqual({ ready: true });
    expect(JSON.stringify(body)).not.toMatch(/0123456789ab|local_jwt|prisma|automatic|missing/);
  });

  it("returns the full diagnostic to administrators", async () => {
    gate.result = { ok: true, session: { role: "admin" }, accountStatus: "active", claimsChanged: false };
    const body = await (await GET()).json();
    expect(body.deployment.commitSha).toBe("0123456789ab");
    expect(body.core.authenticationSource).toBe("local_jwt");
    expect(body.safety.secretValuesExposed).toBe(false);
    expect(body.detailsRequireAdministrator).toBeUndefined();
  });
});
