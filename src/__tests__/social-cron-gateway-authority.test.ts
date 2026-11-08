import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({ selected: vi.fn() }));
const probe = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("@/lib/supabase-gateway", () => ({
  shouldUseSupabaseGateway: gateway.selected,
}));
vi.mock("@/lib/social-media/publishing/gateway-client", () => ({
  probeSocialPublishingGatewayAdapter: probe.check,
}));

import { socialCronGatewayBlock } from "@/lib/social-media/cron-backend-gate";

const routes = [
  {
    path: "src/app/api/social-media/orchestrator/daily/process/route.ts",
    workload: "await assertSocialAutopilotKillSwitchClear(workspaceId)",
    scope: "social-autopilot",
  },
  {
    path: "src/app/api/social-media/analytics/sync/route.ts",
    workload: "await runSocialMetricsSync(limit)",
    scope: "social-analytics",
  },
  {
    path: "src/app/api/social-media/publishing/jobs/process/route.ts",
    workload: "await processSocialPublishingBatch(10)",
    scope: "social-publishing",
  },
  {
    path: "src/app/api/social-media/publishing/jobs/process/[slot]/route.ts",
    workload: "await processSocialPublishingBatch(10, { slotHour })",
    scope: "social-publishing",
  },
] as const;

describe("social cron gateway authority safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probe.check.mockResolvedValue(false);
  });

  it("returns a truthful no-store 503 for gateway-selected production", async () => {
    gateway.selected.mockReturnValue(true);
    const response = await socialCronGatewayBlock("social-publishing");
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toContain("no-store");
    await expect(response?.json()).resolves.toMatchObject({
      ok: false,
      externalActionTaken: false,
      error: { code: "SOCIAL_GATEWAY_BACKEND_REQUIRED" },
    });
  });

  it("does not block a properly configured direct database backend", async () => {
    gateway.selected.mockReturnValue(false);
    expect(await socialCronGatewayBlock("social-publishing")).toBeNull();
    expect(probe.check).not.toHaveBeenCalled();
  });

  it("lifts the publishing gate only when the adapter health probe passes", async () => {
    gateway.selected.mockReturnValue(true);
    probe.check.mockResolvedValue(true);
    expect(await socialCronGatewayBlock("social-publishing")).toBeNull();
    expect(probe.check).toHaveBeenCalledOnce();
  });

  it("still blocks the publishing gate when the probe fails", async () => {
    gateway.selected.mockReturnValue(true);
    probe.check.mockResolvedValue(false);
    const response = await socialCronGatewayBlock("social-publishing");
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "SOCIAL_GATEWAY_BACKEND_REQUIRED" },
    });
  });

  it("still blocks the publishing gate when the probe throws", async () => {
    gateway.selected.mockReturnValue(true);
    probe.check.mockRejectedValue(new Error("gateway down"));
    const response = await socialCronGatewayBlock("social-publishing");
    expect(response?.status).toBe(503);
  });

  it("never lifts the gate for analytics or autopilot, which have no adapter", async () => {
    gateway.selected.mockReturnValue(true);
    probe.check.mockResolvedValue(true);
    for (const scope of ["social-analytics", "social-autopilot"] as const) {
      const response = await socialCronGatewayBlock(scope);
      expect(response?.status).toBe(503);
      await expect(response?.json()).resolves.toMatchObject({
        error: { code: "SOCIAL_GATEWAY_BACKEND_REQUIRED" },
      });
    }
    expect(probe.check).not.toHaveBeenCalled();
  });

  it.each(routes)("guards $path after cron authentication and before Prisma work", ({ path, workload, scope }) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    const authPosition = source.indexOf("if (!authorized(request))");
    const guardPosition = source.indexOf(
      `const gatewayBlock = await socialCronGatewayBlock("${scope}")`,
    );
    const workloadPosition = source.indexOf(workload);
    expect(authPosition).toBeGreaterThan(-1);
    expect(guardPosition).toBeGreaterThan(authPosition);
    expect(workloadPosition).toBeGreaterThan(guardPosition);
    expect(source).toContain("if (gatewayBlock) return gatewayBlock;");
    expect(source.split("socialCronGatewayBlock(")).toHaveLength(2);
  });
});
