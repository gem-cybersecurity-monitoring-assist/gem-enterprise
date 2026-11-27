import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandCenterSocialAccounts } from "@/components/social-media/CommandCenterSocialAccounts";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), token: vi.fn(), access: vi.fn(), local: vi.fn(), backend: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/auth", () => ({ getGatewaySessionToken: mocks.token }));
vi.mock("@/lib/supabase-gateway", () => ({ workspaceGateway: mocks.access }));
vi.mock("@/lib/workspaceAccess", () => ({ listAccessibleWorkspaces: mocks.local }));
vi.mock("@/lib/social-media/transactional-authority", () => ({ hasScopedSocialTransactionalAuthority: mocks.backend }));
vi.mock("@/lib/social-media/oauth/readiness", () => ({
  getSafeSocialOAuthReadiness: () => [{ provider: "META" }, { provider: "X" }, { provider: "TIKTOK" }, { provider: "YOUTUBE" }],
}));
vi.mock("@/components/social-media/SocialConnectorPanel", () => ({
  SocialConnectorPanel: ({ workspaceId, providers, allowManualWorkspaceInput }: {
    workspaceId: string; providers: { provider: string }[]; allowManualWorkspaceInput: boolean;
  }) => <div>{workspaceId}:{providers.map((provider) => provider.provider).join(",")}:{String(allowManualWorkspaceInput)}</div>,
}));

describe("Command Center account controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockResolvedValue({ ok: true, session: { userId: "test-admin", authSource: "supabase_gateway" } });
    mocks.token.mockResolvedValue("test-session-placeholder");
    mocks.access.mockResolvedValue({ workspaces: [{ id: "allowed", name: "Authorized workspace" }] });
    mocks.backend.mockReturnValue(true);
  });

  it("mounts existing controls for authorized workspace without expanding YouTube", async () => {
    const html = renderToStaticMarkup(await CommandCenterSocialAccounts({ workspaceId: null }));
    expect(html).toContain("allowed:META,X,TIKTOK:false");
    expect(html).toContain("workspace=allowed");
    expect(html).not.toContain("YOUTUBE");
    expect(mocks.local).not.toHaveBeenCalled();
  });

  it("never mounts controls for a forged or revoked workspace", async () => {
    const html = renderToStaticMarkup(await CommandCenterSocialAccounts({ workspaceId: "revoked" }));
    expect(html).toContain("No authorized workspace is selected");
    expect(html).not.toContain("revoked:");
    expect(html).not.toContain("allowed:META");
  });

  it("fails closed when the gateway backend is unavailable", async () => {
    mocks.backend.mockReturnValue(false);
    const html = renderToStaticMarkup(await CommandCenterSocialAccounts({ workspaceId: "allowed" }));
    expect(html).toContain("No account status is inferred");
    expect(html).not.toContain("allowed:META");
  });

  it("does not query workspace data for denied administrators", async () => {
    mocks.admin.mockResolvedValue({ ok: false });
    expect(await CommandCenterSocialAccounts({ workspaceId: null })).toBeNull();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("does not fall back to local memberships without a gateway session token", async () => {
    mocks.token.mockResolvedValue(null);
    const html = renderToStaticMarkup(await CommandCenterSocialAccounts({ workspaceId: null }));
    expect(html).toContain("requires an active gateway session");
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.local).not.toHaveBeenCalled();
  });

  it("does not fall back to local memberships after a gateway error", async () => {
    mocks.access.mockRejectedValue(new Error("private provider error"));
    const html = renderToStaticMarkup(await CommandCenterSocialAccounts({ workspaceId: null }));
    expect(html).toContain("Authorized workspaces could not be verified");
    expect(html).not.toContain("private provider error");
    expect(mocks.local).not.toHaveBeenCalled();
  });
});
