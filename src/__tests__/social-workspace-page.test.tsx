import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountsPage from "@/app/app/social-media/accounts/page";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), token: vi.fn(), access: vi.fn(), direct: vi.fn(), find: vi.fn(),
}));
vi.mock("@/lib/api/auth-helpers", () => ({ requireSession: mocks.session, isAdminRole: () => false }));
vi.mock("@/lib/auth", () => ({ getGatewaySessionToken: mocks.token }));
vi.mock("@/lib/supabase-gateway", () => ({ workspaceGateway: mocks.access }));
vi.mock("@/lib/workspaceAccess", () => ({ resolveWorkspaceAccess: mocks.direct }));
vi.mock("@/lib/db", () => ({ db: { workspace: { findFirst: mocks.find } } }));
vi.mock("@/lib/social-media/transactional-authority", () => ({ hasScopedSocialTransactionalAuthority: () => true }));
vi.mock("@/lib/social-media/oauth/readiness", () => ({ getSafeSocialOAuthReadiness: () => [] }));
vi.mock("@/lib/social-media/providers", () => ({ getSocialMediaProviderReadiness: () => [] }));
vi.mock("@/components/social-media/SocialConnectorPanel", () => ({ SocialConnectorPanel: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error("not-found"); },
}));

describe("authorized social workspace choices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ ok: true, accountStatus: "active", session: { userId: "owner", role: "staff", authSource: "supabase_gateway" } });
    mocks.token.mockResolvedValue("test-session-placeholder");
    mocks.access.mockResolvedValue({ workspaces: [{ id: "allowed", name: "Allowed workspace" }] });
  });

  it("uses gateway-authorized choices and does not add a requested non-member workspace", async () => {
    const html = renderToStaticMarkup(await AccountsPage({ searchParams: Promise.resolve({ workspace: "revoked" }) }));
    expect(html).toContain("Allowed workspace");
    expect(html).not.toContain('href="/app/social-media/accounts?workspace=revoked" aria-current="page"');
    expect(html).not.toContain("publishingWorkspace:revoked");
    const chooser = html.split('aria-label="Social workspaces"')[1].split("</nav>")[0];
    expect(chooser).toContain("workspace=allowed");
    expect(chooser).not.toContain("revoked");
    expect(mocks.access).toHaveBeenCalledWith("access", "test-session-placeholder");
    expect(mocks.direct).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("does not fall back to direct database choices when the gateway session credential is missing", async () => {
    mocks.token.mockResolvedValue(null);
    const html = renderToStaticMarkup(await AccountsPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain('aria-label="Social workspaces"');
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.direct).not.toHaveBeenCalled();
  });

  it("uses the existing direct membership resolution and marks its authorized selection", async () => {
    mocks.session.mockResolvedValue({ ok: true, accountStatus: "active", session: { userId: "owner", role: "staff", authSource: "local" } });
    mocks.direct.mockResolvedValue({ workspaces: [{ id: "allowed", name: "Allowed workspace" }], selected: { id: "allowed", name: "Allowed workspace" } });
    const html = renderToStaticMarkup(await AccountsPage({ searchParams: Promise.resolve({ workspace: "allowed" }) }));
    const chooser = html.split('aria-label="Social workspaces"')[1].split("</nav>")[0];
    expect(chooser).toContain("Allowed workspace");
    expect(chooser).toContain('aria-current="page"');
    expect(mocks.direct).toHaveBeenCalledWith("owner", "allowed");
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("redirects an inactive session before exposing workspace choices", async () => {
    mocks.session.mockResolvedValue({ ok: true, accountStatus: "suspended" });
    await expect(AccountsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/admin-login");
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.direct).not.toHaveBeenCalled();
  });
});
