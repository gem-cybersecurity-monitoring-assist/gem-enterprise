import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({ selected: vi.fn() }));
vi.mock("@/lib/supabase-gateway", () => ({
  shouldUseSupabaseGateway: gateway.selected,
}));

import { socialCronGatewayBlock } from "@/lib/social-media/cron-backend-gate";

const routes = [
  {
    path: "src/app/api/social-media/orchestrator/daily/process/route.ts",
    workload: "await assertSocialAutopilotKillSwitchClear(workspaceId)",
  },
  {
    path: "src/app/api/social-media/analytics/sync/route.ts",
    workload: "await runSocialMetricsSync(limit)",
  },
  {
    path: "src/app/api/social-media/publishing/jobs/process/[slot]/route.ts",
    workload: "await processSocialPublishingBatch(10, { slotHour })",
  },
] as const;

describe("social cron gateway authority safety", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a truthful no-store 503 for gateway-selected production", async () => {
    gateway.selected.mockReturnValue(true);
    const response = socialCronGatewayBlock();
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toContain("no-store");
    await expect(response?.json()).resolves.toMatchObject({
      ok: false,
      externalActionTaken: false,
      error: { code: "SOCIAL_GATEWAY_BACKEND_REQUIRED" },
    });
  });

  it("does not block a properly configured direct database backend", () => {
    gateway.selected.mockReturnValue(false);
    expect(socialCronGatewayBlock()).toBeNull();
  });

  it.each(routes)("guards $path after cron authentication and before Prisma work", ({ path, workload }) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    const authPosition = source.indexOf("if (!authorized(request))");
    const guardPosition = source.indexOf("const gatewayBlock = socialCronGatewayBlock()");
    const workloadPosition = source.indexOf(workload);
    expect(authPosition).toBeGreaterThan(-1);
    expect(guardPosition).toBeGreaterThan(authPosition);
    expect(workloadPosition).toBeGreaterThan(guardPosition);
    expect(source).toContain("if (gatewayBlock) return gatewayBlock;");
    expect(source.split("socialCronGatewayBlock();")).toHaveLength(2);
  });
});
