import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  account: vi.fn(),
  membership: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionFromRequest: mocks.session }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.account },
    workspaceMember: { findUnique: mocks.membership },
  },
}));

import {
  requireActiveTokMetricSession,
  requireTokMetricSession,
  requireWorkspaceAccess,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const request = new NextRequest("http://localhost/api/social-media/connectors");
const gateway = { userId: "admin-1", role: "admin", authSource: "supabase_gateway" };
const local = { userId: "admin-1", role: "admin", authSource: "local" };

describe("TokMetric persistence authority boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue(gateway);
  });

  it("rejects a real gateway-authenticated session before social database work", async () => {
    await expect(requireTokMetricSession(request)).rejects.toMatchObject({
      status: 503, code: "TOKMETRIC_GATEWAY_BACKEND_REQUIRED",
    });
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.membership).not.toHaveBeenCalled();
  });

  it("rejects gateway session before Prisma-based active-user lookup", async () => {
    await expect(requireActiveTokMetricSession(request)).rejects.toMatchObject({
      status: 503, code: "TOKMETRIC_GATEWAY_BACKEND_REQUIRED",
    });
    expect(mocks.account).not.toHaveBeenCalled();
  });

  it("rejects workspace calls even if a future caller bypasses session setup", async () => {
    await expect(requireWorkspaceAccess("workspace-a", gateway as never)).rejects.toMatchObject({
      status: 503, code: "TOKMETRIC_GATEWAY_BACKEND_REQUIRED",
    });
    expect(mocks.membership).not.toHaveBeenCalled();
  });

  it("preserves unauthenticated denial", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(requireTokMetricSession(request)).rejects.toMatchObject({
      status: 401, code: "UNAUTHENTICATED",
    });
  });

  it("preserves local sessions and original role/status checks", async () => {
    mocks.session.mockResolvedValue(local);
    await expect(requireTokMetricSession(request)).resolves.toMatchObject(local);
    mocks.account.mockResolvedValue({ status: "active", isActive: true });
    await expect(requireActiveTokMetricSession(request)).resolves.toMatchObject(local);
    expect(mocks.account).toHaveBeenCalledOnce();
    mocks.membership.mockResolvedValue(null);
    await expect(requireWorkspaceAccess("workspace-a", local as never)).resolves.toBeNull();
    expect(mocks.membership).toHaveBeenCalledOnce();
  });

  it("sends a no-store 503 without returning sensitive auth details", async () => {
    let failure: unknown;
    try { await requireTokMetricSession(request); } catch (error) { failure = error; }
    const response = tokMetricErrorResponse(failure, "cid-1");
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "TOKMETRIC_GATEWAY_BACKEND_REQUIRED", correlationId: "cid-1" },
    });
  });
});
