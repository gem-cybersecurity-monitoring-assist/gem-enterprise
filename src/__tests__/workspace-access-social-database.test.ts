import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ gate: vi.fn(), scoped: vi.fn(), create: vi.fn(), assign: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({ requirePlatformOwner: mocks.gate, getRequestContext: () => ({ ipAddress: "127.0.0.1", userAgent: "test" }) }));
vi.mock("@/lib/api/rate-limit", () => ({ rateLimit: async () => ({ ok: true }), rateLimitedResponse: vi.fn() }));
vi.mock("@/lib/social-media/connector-authority", () => ({ tokMetricConnectorDatabase: mocks.scoped }));
vi.mock("@/lib/auth", () => ({ getGatewaySessionToken: vi.fn() }));
vi.mock("@/lib/supabase-gateway", () => ({ workspaceGateway: vi.fn(), GatewayRequestError: class extends Error {} }));
vi.mock("@/lib/organizationWorkspace", () => ({ provisionOrganizationWorkspace: vi.fn() }));
vi.mock("@/lib/workspaceAccessAdministration", () => ({ createWorkspaceRole: mocks.create, assignWorkspaceMembership: mocks.assign, updateWorkspaceMembership: mocks.update, getWorkspaceAdministrationSnapshot: vi.fn(), WorkspaceAdministrationError: class extends Error { constructor(message: string, public statusCode: number, public code: string) { super(message); } } }));
import { POST, PATCH } from "@/app/api/admin/workspace-access/route";
const session = { userId: "owner", role: "super_admin", authSource: "supabase_gateway" };
const scoped = {};
function request(body: unknown, method = "POST") { return new NextRequest("https://gem.example/api/admin/workspace-access", { method, headers: { "Content-Type": "application/json", Origin: "https://gem.example" }, body: JSON.stringify(body) }); }
const create = { operation: "create_role", workspaceId: "workspace", confirmWorkspaceSlug: "tokmetric-production", name: "Connector Operator", permissions: [{ action: "manage", scope: "connectors" }], reason: "Owner requested account authorization." };
beforeEach(() => { vi.resetAllMocks(); mocks.gate.mockResolvedValue({ ok: true, session }); mocks.scoped.mockReturnValue(scoped); mocks.create.mockResolvedValue({ id: "role" }); mocks.assign.mockResolvedValue({ id: "member" }); mocks.update.mockResolvedValue({ id: "member" }); });
describe("gateway workspace administration database isolation", () => {
  it("routes reviewed role creation to the verified project database", async () => {
    expect((await POST(request(create))).status).toBe(201);
    expect(mocks.create.mock.calls[0][2]).toBe(scoped);
  });
  it("blocks writes when gateway database binding is unavailable", async () => {
    mocks.scoped.mockReturnValue(undefined);
    const response = await POST(request(create));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("WORKSPACE_ADMIN_BACKEND_REQUIRED");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses the same database for reviewed membership assignment and suspension", async () => {
    expect((await POST(request({ operation: "assign_membership", workspaceId: "workspace", confirmWorkspaceSlug: "tokmetric-production", userId: "owner", confirmEmail: "owner@example.test", roleId: "role", reason: "Owner requested connector access." }))).status).toBe(201);
    expect(mocks.assign.mock.calls[0][2]).toBe(scoped);
    expect((await PATCH(request({ membershipId: "member", expectedUpdatedAt: "2026-11-13T22:00:00Z", confirmEmail: "owner@example.test", status: "suspended", reason: "Owner requested access suspension." }, "PATCH"))).status).toBe(200);
    expect(mocks.update.mock.calls[0][2]).toBe(scoped);
  });
  it("retains owner authorization and exact confirmation requirements", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({error: "Forbidden"}, {status: 403}) });
    expect((await POST(request(create))).status).toBe(403);
    expect(mocks.scoped).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps the local database path when the session is local", async () => {
    mocks.gate.mockResolvedValue({ ok: true, session: { ...session, authSource: "local" } });
    expect((await POST(request(create))).status).toBe(201);
    expect(mocks.scoped).not.toHaveBeenCalled();
    expect(mocks.create.mock.calls[0][2]).toBeUndefined();
  });
});
