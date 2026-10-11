import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: mocks.requireAdmin }));
import * as environment from "@/app/api/v1/platform/environment/route";
import * as plan from "@/app/api/v1/platform/deployment-plan/route";
import * as repository from "@/app/api/v1/platform/repository/route";
import * as sync from "@/app/api/v1/platform/repository/sync/route";

const handlers = [environment.GET, environment.PATCH, plan.GET, plan.POST, repository.GET, repository.POST, sync.POST];
describe("Enterprise platform evidence and administrative boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([401, 403, 503])("preserves the authoritative gate's %s denial on every handler", async status => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
    for (const handler of handlers) expect((await handler()).status).toBe(status);
  });
  it("labels configuration separately from operational verification and timestamps each read", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true });
    for (const handler of [environment.GET, plan.GET, repository.GET]) {
      const response = await handler();
      const data = await response.json();
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(data.evidence).toMatchObject({ source: "server_configuration", operationallyVerified: false });
      expect(Number.isNaN(Date.parse(data.evidence.checkedAt))).toBe(false);
      expect(JSON.stringify(data)).not.toMatch(/"status":"(ready|connected)"/);
    }
  });
  it("does not fabricate a queued job or sync ID when no processor exists", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true });
    const response = await sync.POST();
    const body = await response.json();
    expect(response.status).toBe(501);
    expect(body).toMatchObject({ status: "not_configured", code: "REPOSITORY_SYNC_NOT_IMPLEMENTED" });
    expect(body).not.toHaveProperty("syncId");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
