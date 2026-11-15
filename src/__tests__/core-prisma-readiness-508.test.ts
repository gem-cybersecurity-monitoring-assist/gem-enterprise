import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hasCorePrismaRuntimeConfig } from "@/lib/core-prisma-readiness";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), resolve: vi.fn(),
  userCount: vi.fn(), userFindMany: vi.fn(),
  productCount: vi.fn(), entitlementCount: vi.fn(),
  ticketCount: vi.fn(), requestCount: vi.fn(),
  auditCount: vi.fn(), operating: vi.fn(),
}));

vi.mock("@/lib/api/auth-helpers", () => ({
  requireSession: mocks.session,
  forbidden: (message: string, code?: string) =>
    Response.json({ error: message, code }, { status: 403 }),
  serviceUnavailable: (message: string) =>
    Response.json({ error: message }, { status: 503 }),
  serverError: (message: string) => Response.json({ error: message }, { status: 500 }),
}));
vi.mock("@/lib/workspaceAccess", () => ({ resolveWorkspaceAccess: mocks.resolve }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { count: mocks.userCount, findMany: mocks.userFindMany },
    product: { count: mocks.productCount },
    entitlement: { count: mocks.entitlementCount },
    supportTicket: { count: mocks.ticketCount },
    serviceRequest: { count: mocks.requestCount },
    auditLog: { count: mocks.auditCount },
  },
}));
vi.mock("@/lib/commandCenterOperatingLayer", () => ({
  getCommandCenterOperatingLayerSnapshot: mocks.operating,
}));

import { GET as workspacesGet } from "@/app/api/workspaces/route";
import { buildCommandCenterSnapshot } from "@/lib/commandCenterSnapshotService";

function withoutCoreDatabase() {
  for (const key of ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"]) {
    vi.stubEnv(key, "");
  }
}
const request = () => new NextRequest("https://example.test/api/workspaces");
const databaseMethods = () => [
  mocks.userCount, mocks.userFindMany, mocks.productCount, mocks.entitlementCount,
  mocks.ticketCount, mocks.requestCount, mocks.auditCount,
];

beforeEach(() => {
  vi.clearAllMocks();
  withoutCoreDatabase();
  mocks.session.mockResolvedValue({
    ok: true,
    accountStatus: "active",
    session: { userId: "user-1", role: "client" },
  });
  mocks.resolve.mockResolvedValue({
    workspaces: [], selected: null, requestedDenied: false,
  });
  mocks.operating.mockResolvedValue({ source: "unavailable", metrics: null });
  for (const fn of databaseMethods()) fn.mockResolvedValue(0);
  mocks.userFindMany.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("core Prisma configuration must not borrow social connector credentials", () => {
  it.each(["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"])(
    "recognizes only configured core URL alias %s", key => {
      expect(hasCorePrismaRuntimeConfig({ [key]: " postgresql://example.invalid/main " })).toBe(true);
    },
  );
  it("rejects absent, blank, and social-only configuration", () => {
    expect(hasCorePrismaRuntimeConfig({})).toBe(false);
    expect(hasCorePrismaRuntimeConfig({ POSTGRES_PRISMA_URL: "   " })).toBe(false);
    expect(hasCorePrismaRuntimeConfig({
      GEM_SOCIAL_POSTGRES_PRISMA_URL: "postgresql://example.invalid/social",
    })).toBe(false);
  });
});

describe("existing workspace API authorization and unavailable core backend", () => {
  it("keeps the existing unauthorized gate ahead of all backend checks", async () => {
    mocks.session.mockResolvedValue({ ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) });
    const result = await workspacesGet(request());
    expect(result.status).toBe(401);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("keeps inactive accounts denied without querying membership", async () => {
    mocks.session.mockResolvedValue({ ok: true, accountStatus: "suspended", session: { userId: "user-1" } });
    const result = await workspacesGet(request());
    expect(result.status).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("returns a disclosed 503 without querying members when only social storage exists", async () => {
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", "postgresql://example.invalid/social");
    const result = await workspacesGet(request());
    expect(result.status).toBe(503);
    expect((await result.json()).error).toBe("Workspace data backend is not configured.");
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(databaseMethods().every(fn => fn.mock.calls.length === 0)).toBe(true);
  });
  it("preserves the authorized membership read path when a core backend is configured", async () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "postgresql://example.invalid/core");
    const result = await workspacesGet(request());
    expect(result.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith("user-1", null);
    expect((await result.json()).workspaces).toEqual([]);
  });
});

describe("Command Center data fail-closed readiness", () => {
  it("does not attempt any Prisma query or operating-layer query when core URL is missing", async () => {
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", "postgresql://example.invalid/social");
    const snapshot = await buildCommandCenterSnapshot();
    expect(snapshot.source).toBe("unavailable");
    expect(snapshot.metrics).toBeNull();
    expect(snapshot.operatingLayer.source).toBe("unavailable");
    expect(snapshot.message).toMatch(/No live counts were verified/);
    expect(databaseMethods().every(fn => fn.mock.calls.length === 0)).toBe(true);
    expect(mocks.operating).not.toHaveBeenCalled();
  });
  it("retains actual aggregate-read behavior with a configured core URL", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example.invalid/core");
    mocks.userCount.mockResolvedValue(7);
    mocks.productCount.mockResolvedValue(2);
    const snapshot = await buildCommandCenterSnapshot();
    expect(snapshot.source).toBe("database");
    expect(snapshot.metrics?.activeUsers).toBe(7);
    expect(snapshot.metrics?.activeProducts).toBe(2);
    expect(mocks.userCount).toHaveBeenCalledOnce();
    expect(mocks.operating).toHaveBeenCalledOnce();
  });
  it("does not replace failed configured queries with sample metrics", async () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "postgresql://example.invalid/core");
    mocks.userCount.mockRejectedValue(new Error("Test connection unavailable"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const snapshot = await buildCommandCenterSnapshot();
      expect(snapshot.source).toBe("unavailable");
      expect(snapshot.metrics).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
