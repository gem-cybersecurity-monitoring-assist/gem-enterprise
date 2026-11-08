import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), selected: vi.fn() }));
const probe = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/supabase-gateway", () => ({ shouldUseSupabaseGateway: mocks.selected }));
vi.mock("@/lib/social-media/publishing/gateway-client", () => ({
  probeSocialPublishingGatewayAdapter: probe.check,
}));
import { getSocialBackendReadiness } from "@/lib/social-media/backend-readiness";
import { GET } from "@/app/api/social-media/readiness/route";

describe("GEM Social runtime authority disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockResolvedValue({ ok: true, session: { role: "admin" } });
    mocks.selected.mockReturnValue(true);
    probe.check.mockResolvedValue(false);
  });

  it("explicitly blocks unsupported social persistence on a Supabase gateway", () => {
    expect(getSocialBackendReadiness(true)).toMatchObject({
      authenticationBackend: "supabase_gateway",
      state: "BLOCKED_GATEWAY_BACKEND",
      connectorAndQueueBackendVerified: false,
      livePublishingCertified: false,
      externalActionTaken: false,
    });
  });

  it("never claims certification based only on a direct database selection", () => {
    expect(getSocialBackendReadiness(false)).toMatchObject({
      authenticationBackend: "prisma",
      state: "DIRECT_DATABASE_UNVERIFIED",
      connectorAndQueueBackendVerified: false,
      livePublishingCertified: false,
    });
  });

  it("reports GATEWAY_ADAPTER_VERIFIED only when the adapter probe passes", () => {
    expect(getSocialBackendReadiness(true, true)).toMatchObject({
      authenticationBackend: "supabase_gateway",
      state: "GATEWAY_ADAPTER_VERIFIED",
      connectorAndQueueBackendVerified: true,
      livePublishingCertified: false,
      externalActionTaken: false,
    });
    // The adapter verifies the backend, not live publishing certification.
    expect(getSocialBackendReadiness(true, true).livePublishingCertified).toBe(false);
    // And the verified state never appears without the probe result.
    expect(getSocialBackendReadiness(true, false).state).toBe(
      "BLOCKED_GATEWAY_BACKEND",
    );
  });

  it("reports the verified adapter state through the readiness route", async () => {
    probe.check.mockResolvedValue(true);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      workflowBackend: {
        state: "GATEWAY_ADAPTER_VERIFIED",
        connectorAndQueueBackendVerified: true,
        livePublishingCertified: false,
      },
      externalActionTaken: false,
    });
    expect(probe.check).toHaveBeenCalledOnce();
  });

  it("only serves authenticated administrators and invokes no publishing APIs", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      workflowBackend: {
        state: "BLOCKED_GATEWAY_BACKEND",
        livePublishingCertified: false,
      },
      externalActionTaken: false,
    });
    expect(mocks.admin).toHaveBeenCalledOnce();
  });

  it("preserves administrator denial before evaluating the persistence backend", async () => {
    mocks.admin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.selected).not.toHaveBeenCalled();
  });

  it("never leaks configured secrets through runtime readiness", async () => {
    vi.stubEnv("X_CLIENT_SECRET", "sentinel-secret-never-expose");
    try {
      const response = await GET();
      const body = await response.text();
      expect(body).not.toContain("sentinel-secret-never-expose");
      expect(body).toContain("BLOCKED_GATEWAY_BACKEND");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("shows an honest blocked state on the provider settings screen", () => {
    const markup = readFileSync(join(process.cwd(), "src/app/app/social-media/settings/page.tsx"), "utf8");
    expect(markup).toContain("Gateway compatibility required");
    expect(markup).toContain("do not certify live posting");
  });
});
