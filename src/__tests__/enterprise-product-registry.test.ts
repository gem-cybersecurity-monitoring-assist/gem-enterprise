import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  enterpriseProducts,
  getEnterpriseProduct,
  isApprovedExternalProductUrl,
  IWW_PRODUCTION_ORIGIN,
  IWW_WORKSPACE_LAUNCH_URL,
} from "@/lib/enterpriseProductRegistry";

const authMocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: authMocks.requireAdmin }));

import { GET } from "@/app/api/platform-products/route";

describe("enterprise product registry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps IWW on its independent production, repository, auth, and data boundaries", () => {
    const iww = getEnterpriseProduct("iww");
    expect(iww).toMatchObject({
      boundary: "independent_saas",
      repository: "support371/infinite-wealth-wellbeing",
      launchHref: IWW_WORKSPACE_LAUNCH_URL,
    });
    expect(iww?.authentication).toContain("Dedicated IWW Supabase Auth");
    expect(iww?.dataAuthority).toContain("Dedicated IWW Supabase project");
    expect(IWW_WORKSPACE_LAUNCH_URL).toBe(`${IWW_PRODUCTION_ORIGIN}/workspaces`);
  });

  it("only accepts the exact HTTPS IWW production origin for external product links", () => {
    expect(isApprovedExternalProductUrl(IWW_WORKSPACE_LAUNCH_URL)).toBe(true);
    expect(isApprovedExternalProductUrl(`${IWW_PRODUCTION_ORIGIN}/platform`)).toBe(true);
    expect(isApprovedExternalProductUrl("http://infinite-wealth-wellbeing.vercel.app/workspaces")).toBe(false);
    expect(isApprovedExternalProductUrl("https://infinite-wealth-wellbeing.vercel.app.attacker.example/workspaces")).toBe(false);
    expect(isApprovedExternalProductUrl("https://example.com/workspaces")).toBe(false);
  });

  it("does not expose launch links for products whose independent boundary is not ready", () => {
    const planned = enterpriseProducts.filter((product) => product.readiness === "PLANNED");
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((product) => product.launchHref === null)).toBe(true);
  });

  it("fails closed when the platform-products API gate denies access", async () => {
    authMocks.requireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns only boundary metadata to an authorized administrator", async () => {
    authMocks.requireAdmin.mockResolvedValue({ ok: true, session: { userId: "admin-1", role: "admin" }, accountStatus: "active", claimsChanged: false });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.boundaryPolicy).toEqual({ sharedSessions: false, sharedDatabases: false, sharedServiceKeys: false, launcherGrantsAccess: false });
    expect(JSON.stringify(body)).not.toMatch(/service.role|secret|password|token/i);
  });
});
