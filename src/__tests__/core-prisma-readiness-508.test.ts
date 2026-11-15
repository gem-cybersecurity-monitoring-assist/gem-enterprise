import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hasCorePrismaRuntimeConfig } from "@/lib/core-prisma-readiness";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), resolve: vi.fn(), token: vi.fn(), gateway: vi.fn(),
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
vi.mock("@/lib/auth", () => ({ getGatewaySessionToken: mocks.token }));
vi.mock("@/lib/supabase-gateway", () => ({ workspaceGateway: mocks.gateway }));
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
  mocks.token.mockResolvedValue(null);
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


const workspace = {
  id: "workspace-a",
  name: "Authorized workspace",
  organization: { id: "org-1", name: "Authorized organization" },
  role: { name: "Member" },
  counts: { members: 2, connectors: 1, approvalRecords: 0 },
  controls: {
    globalEmergencyLock: false,
    publishingDisabled: true,
    advertisingDisabled: true,
    shopWriteDisabled: true,
    connectorDisabled: false,
  },
};
const gatewaySession = () => {
  mocks.session.mockResolvedValue({
    ok: true, accountStatus: "active",
    session: { userId: "user-1", role: "client", authSource: "supabase_gateway" },
  });
  mocks.token.mockResolvedValue("signed-in-session-token");
  mocks.gateway.mockResolvedValue({ workspaces: [workspace] });
};

describe("project-bound gateway workspace access without generic Prisma", () => {
  it("returns actual assigned workspaces from existing gateway and no Prisma access", async () => {
    gatewaySession();
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", "postgresql://example.invalid/social");
    const result = await workspacesGet(request());
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toMatchObject({
      workspaces: [workspace],
      selectedWorkspaceId: "workspace-a",
    });
    expect(mocks.gateway).toHaveBeenCalledExactlyOnceWith("access", "signed-in-session-token");
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(databaseMethods().every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it("denies selecting a workspace not returned by the authoritative gateway", async () => {
    gatewaySession();
    const result = await workspacesGet(new NextRequest("https://example.test/api/workspaces?workspaceId=another-tenant"));
    expect(result.status).toBe(403);
    expect(await result.json()).toMatchObject({ code: "WORKSPACE_ACCESS_DENIED" });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("does not call the gateway for unauthenticated or inactive sessions", async () => {
    gatewaySession();
    mocks.session.mockResolvedValue({ ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await workspacesGet(request())).status).toBe(401);
    mocks.session.mockResolvedValue({
      ok: true, accountStatus: "suspended",
      session: { authSource: "supabase_gateway", userId: "user-1" },
    });
    expect((await workspacesGet(request())).status).toBe(403);
    expect(mocks.gateway).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("fails closed when the verified session token is unavailable", async () => {
    gatewaySession();
    mocks.token.mockResolvedValue(null);
    const result = await workspacesGet(request());
    expect(result.status).toBe(503);
    expect(mocks.gateway).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it.each(["missing", "malformed", "duplicate", "invalid-count", "incomplete-control"])(
    "rejects %s gateway membership readbacks without disclosing workspace records", async failure => {
      gatewaySession();
      if (failure === "missing") mocks.gateway.mockResolvedValue({});
      if (failure === "malformed") mocks.gateway.mockResolvedValue({ workspaces: [{ id: "someone-else" }] });
      if (failure === "duplicate") mocks.gateway.mockResolvedValue({ workspaces: [workspace, workspace] });
      if (failure === "invalid-count") mocks.gateway.mockResolvedValue({
        workspaces: [{ ...workspace, counts: { members: -1, connectors: 1, approvalRecords: 0 } }],
      });
      if (failure === "incomplete-control") mocks.gateway.mockResolvedValue({
        workspaces: [{ ...workspace, controls: { publishingDisabled: true } }],
      });
      const result = await workspacesGet(request());
      expect(result.status).toBe(503);
      expect(JSON.stringify(await result.json())).not.toContain("Authorized organization");
      expect(mocks.resolve).not.toHaveBeenCalled();
    },
  );

  it("handles remote gateway failure without fallback to other tenant datasource", async () => {
    gatewaySession();
    mocks.gateway.mockRejectedValue(new Error("private provider details"));
    const result = await workspacesGet(request());
    expect(result.status).toBe(503);
    expect(JSON.stringify(await result.json())).not.toContain("private provider details");
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(databaseMethods().every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it("honors an empty authoritative membership set without fabricating membership", async () => {
    gatewaySession();
    mocks.gateway.mockResolvedValue({ workspaces: [] });
    const result = await workspacesGet(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ workspaces: [], selectedWorkspaceId: null });
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
