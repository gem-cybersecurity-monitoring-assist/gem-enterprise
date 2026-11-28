import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  account: vi.fn(), membership: vi.fn(), scoped: vi.fn(),
  workspaces: vi.fn(), versions: vi.fn(), assets: vi.fn(),
  connector: vi.fn(), credential: vi.fn(), decrypt: vi.fn(), audit: vi.fn(),
  globalRead: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { workspace: { findMany: mocks.globalRead }, connector: { findFirst: mocks.globalRead } } }));
vi.mock("@/lib/social-media/connector-authority", () => ({
  requireSocialConnectorSession: mocks.account, requireSocialConnectorWorkspace: mocks.membership, tokMetricConnectorDatabase: mocks.scoped,
}));
vi.mock("@/lib/tokmetric/oauth/crypto", () => ({ decryptCredential: mocks.decrypt }));
vi.mock("@/lib/tokmetric/security", async (original) => ({
  ...await original<typeof import("@/lib/tokmetric/security")>(), emitTokMetricAudit: mocks.audit,
}));
import { GET } from "@/app/api/tokmetric/publishing/context/route";
import { POST } from "@/app/api/tokmetric/publishing/creator-info/route";
import { TokMetricError } from "@/lib/tokmetric/security";

const database = {
  workspace: { findMany: mocks.workspaces },
  contentVersion: { findMany: mocks.versions },
  mediaAsset: { findMany: mocks.assets },
  connector: { findFirst: mocks.connector },
  connectorCredentialReference: { findUnique: mocks.credential },
};
const session = { userId: "owner", role: "super_admin", authSource: "supabase_gateway" };
const stored = {
  provider: "TIKTOK_CONTENT_POSTING_API", environment: "production", externalAccountId: "test-account",
  accessToken: "mock-access-token", grantedScopes: ["user.info.basic", "video.publish"], expiresAt: "2099-01-01T00:00:00Z",
};
const request = (origin = "https://example.com") => new NextRequest("https://example.com/api/tokmetric/publishing/creator-info", {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ workspaceId: "ws-1", connectorId: "conn-1" }),
});
function providerResponse() {
  return new Response(JSON.stringify({
    data: { creator_username: "test", creator_nickname: "Test Creator", privacy_level_options: ["SELF_ONLY"], comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 120 },
    error: { code: "ok" },
  }), { status: 200 });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TIKTOK_ENVIRONMENT", "production");
  vi.stubEnv("TOKMETRIC_LIVE_PUBLISHING_ENABLED", "true");
  mocks.account.mockResolvedValue(session);
  mocks.scoped.mockReturnValue(database);
  mocks.membership.mockResolvedValue({ role: { permissions: [{ action: "publish", scope: "content" }] } });
  mocks.workspaces.mockResolvedValue([]);
  mocks.versions.mockResolvedValue([]);
  mocks.assets.mockResolvedValue([]);
  mocks.connector.mockResolvedValue({ id: "conn-1", externalAccountId: "test-account", grantedScopes: ["video.publish"] });
  mocks.credential.mockResolvedValue({ secretRef: "encrypted-test-value", expiresAt: new Date("2099-01-01") });
  mocks.decrypt.mockReturnValue(stored);
  mocks.audit.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("TikTok gateway publishing preflight", () => {
  it("uses the project-scoped database and active publish membership even for super admin, leaving all publishing disabled", async () => {
    const res = await GET(new NextRequest("https://example.com/api/tokmetric/publishing/context"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, data: { gatewayPreflight: true, gate: { enabled: false, productionEnabled: false, sandboxEnabled: false, mode: "disabled" } } });
    expect(mocks.account).toHaveBeenCalledWith(expect.anything(), true);
    expect(mocks.workspaces).toHaveBeenCalledWith(expect.objectContaining({ where: {
      organization: { status: "active" }, members: { some: { userId: "owner", status: "active", role: { permissions: { some: { action: "publish", scope: { in: ["content", "*"] } } } } } },
    } }));
    expect(mocks.globalRead).not.toHaveBeenCalled();
  });
  it("fails closed if the scoped authority is unavailable", async () => {
    mocks.account.mockRejectedValue(new TokMetricError(503, "SOCIAL_CONNECTOR_BACKEND_REQUIRED", "Scoped backend unavailable."));
    const res = await GET(new NextRequest("https://example.com/api/tokmetric/publishing/context"));
    expect(res.status).toBe(503);
    expect(mocks.workspaces).not.toHaveBeenCalled();
    expect(mocks.globalRead).not.toHaveBeenCalled();
  });
  it("does not expose a content version belonging to a different content record", async () => {
    mocks.workspaces.mockResolvedValue([{ id: "ws-1", contents: [{ id: "content-1", currentVersionId: "version-1" }], connectors: [], publishJobs: [] }]);
    mocks.versions.mockResolvedValue([{ id: "version-1", contentId: "other-content", mediaAssetIds: ["asset-1"] }]);
    mocks.assets.mockResolvedValue([{ id: "asset-1", workspaceId: "ws-1" }]);
    const res = await GET(new NextRequest("https://example.com/api/tokmetric/publishing/context"));
    expect((await res.json()).data.workspaces[0].contents).toEqual([]);
  });
  it("queries creator options with the existing encrypted credential without rotating or uploading", async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse()); vi.stubGlobal("fetch", fetchMock);
    const res = await POST(request());
    const payload = await res.json();
    expect(res.status).toBe(200);
    expect(payload.data.privacyLevelOptions).toEqual(["SELF_ONLY"]);
    expect(JSON.stringify(payload)).not.toContain(stored.accessToken);
    expect(mocks.membership).toHaveBeenCalledWith("ws-1", session, database);
    expect(mocks.connector).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conn-1", workspaceId: "ws-1", provider: "TIKTOK_CONTENT_POSTING_API", state: "CONNECTED", disabledAt: null } }));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", expect.objectContaining({ method: "POST" }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "tokmetric.tiktok.creator_info_preflight" }), database);
    expect(mocks.globalRead).not.toHaveBeenCalled();
  });
  it.each([
    { environment: "sandbox" }, { externalAccountId: "wrong-account" },
    { grantedScopes: ["user.info.basic"] }, { expiresAt: "2020-01-01T00:00:00Z" },
  ])("rejects stale or mismatched credentials without a provider request: %j", async override => {
    mocks.decrypt.mockReturnValue({ ...stored, ...override });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("denies revoked membership and missing publish permission before loading credentials", async () => {
    mocks.membership.mockRejectedValueOnce(new TokMetricError(403, "WORKSPACE_FORBIDDEN", "Membership required."));
    expect((await POST(request())).status).toBe(403);
    mocks.membership.mockResolvedValueOnce({ role: { permissions: [{ action: "read", scope: "content" }] } });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.connector).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin creator settings request before authentication", async () => {
    expect((await POST(request("https://different.example"))).status).toBe(403);
    expect(mocks.account).not.toHaveBeenCalled();
  });
});
