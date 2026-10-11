import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({ selected: vi.fn(), status: vi.fn() }));
const database = vi.hoisted(() => ({ raw: vi.fn() }));

vi.mock("@/lib/supabase-gateway", () => ({
  shouldUseSupabaseGateway: gateway.selected,
  bootstrapGatewayStatus: gateway.status,
}));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: database.raw } }));

import { GET } from "@/app/api/v1/production/health/route";

describe("production health respects selected persistence authority", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports gateway healthy only after a successful configured gateway probe", async () => {
    gateway.selected.mockReturnValue(true);
    gateway.status.mockResolvedValue({ configured: true });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "healthy",
      databaseBackend: "supabase_gateway",
      verificationScope: {
        checked: "gateway_bootstrap",
        checkedSuccessfully: true,
        transactionalWorkflowsTested: false,
        providerPublishingTested: false,
      },
    });
    expect(database.raw).not.toHaveBeenCalled();
  });

  it("fails closed for a gateway probe failure", async () => {
    gateway.selected.mockReturnValue(true);
    gateway.status.mockRejectedValue(new Error("gateway unavailable"));
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      verificationScope: {
        checked: "gateway_bootstrap",
        checkedSuccessfully: false,
        transactionalWorkflowsTested: false,
        providerPublishingTested: false,
      },
    });
    expect(database.raw).not.toHaveBeenCalled();
  });

  it("reports degraded if gateway has no configured administrator", async () => {
    gateway.selected.mockReturnValue(true);
    gateway.status.mockResolvedValue({ configured: false });
    const response = await GET();
    expect(response.status).toBe(503);
  });

  it("preserves a direct database check when Prisma is selected", async () => {
    gateway.selected.mockReturnValue(false);
    database.raw.mockResolvedValue([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      databaseBackend: "prisma",
      verificationScope: {
        checked: "direct_database_connection",
        checkedSuccessfully: true,
        transactionalWorkflowsTested: false,
        providerPublishingTested: false,
      },
    });
    expect(database.raw).toHaveBeenCalledOnce();
    expect(gateway.status).not.toHaveBeenCalled();
  });

  it("reports degraded when a selected direct database fails", async () => {
    gateway.selected.mockReturnValue(false);
    database.raw.mockRejectedValue(new Error("db offline"));
    expect((await GET()).status).toBe(503);
  });
});
