import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  database: { name: "scoped-social" },
  session: { userId: "owner-1", role: "admin" },
  requireSession: vi.fn(), requireWorkspace: vi.fn(), selectDatabase: vi.fn(),
  lock: vi.fn(), permission: vi.fn(), audit: vi.fn(), createAttempt: vi.fn(),
}));
vi.mock("@/lib/social-media/connector-authority", () => ({
  requireSocialConnectorSession: mocks.requireSession,
  requireSocialConnectorWorkspace: mocks.requireWorkspace,
  tokMetricConnectorDatabase: mocks.selectDatabase,
}));
vi.mock("@/lib/tokmetric/security", async (original) => ({
  ...await original<typeof import("@/lib/tokmetric/security")>(),
  enforceEmergencyLocks: mocks.lock, requirePermission: mocks.permission, emitTokMetricAudit: mocks.audit,
}));
vi.mock("@/lib/social-media/oauth/store", () => ({ createSocialOAuthAuthorizationAttempt: mocks.createAttempt }));
import { GET } from "@/app/api/social-media/oauth/[provider]/start/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue(mocks.session);
  mocks.requireWorkspace.mockResolvedValue({ role: { name: "connector operator" } });
  mocks.selectDatabase.mockReturnValue(mocks.database);
  mocks.createAttempt.mockImplementation(async input => ({ nonce: input.nonce }));
  vi.stubEnv("META_SOCIAL_OAUTH_ENABLED", "true");
  vi.stubEnv("META_APP_ID", "meta-test-app");
  vi.stubEnv("META_GRAPH_API_VERSION", "v27.0");
  vi.stubEnv("META_APP_SECRET", "never-in-response");
  vi.stubEnv("META_OAUTH_REDIRECT_URI", "https://www.gemcybersecurityassist.com/api/social-media/oauth/meta/callback");
  vi.stubEnv("META_SOCIAL_SCOPES", "public_profile pages_show_list pages_read_engagement instagram_basic");
  vi.stubEnv("META_APP_REVIEW_APPROVED", "false");
  vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 3).toString("base64"));
  vi.stubEnv("SOCIAL_OAUTH_STATE_SECRET", "test-state-secret");
});
afterEach(() => vi.unstubAllEnvs());
const request = () => new NextRequest("https://www.gemcybersecurityassist.com/api/social-media/oauth/meta/start?workspaceId=workspace-1");
describe("scoped social authorization", () => {
  it("allows provider-governed account authorization with review pending and uses one database for authority, nonce and audit", async () => {
    const req = request();
    const response = await GET(req, { params: Promise.resolve({ provider: "meta" }) });
    expect(response.status).toBe(307);
    expect(mocks.requireSession).toHaveBeenCalledWith(req, true);
    expect(mocks.requireWorkspace).toHaveBeenCalledWith("workspace-1", mocks.session, mocks.database);
    expect(mocks.lock).toHaveBeenCalledWith("workspace-1", "connector", mocks.database);
    expect(mocks.createAttempt).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "workspace-1", actorId: "owner-1", provider: "META" }), mocks.database);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "social.connector.authorization_started" }), mocks.database);
    const url = new URL(response.headers.get("location")!);
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("scope")).not.toContain("pages_manage_posts");
    expect(response.headers.get("location")).not.toContain("never-in-response");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not create an authorization attempt when membership is revoked", async () => {
    mocks.requireWorkspace.mockRejectedValueOnce(new Error("membership revoked"));
    const response = await GET(request(), { params: Promise.resolve({ provider: "meta" }) });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("fails closed on an emergency lock before creating a provider grant", async () => {
    mocks.lock.mockRejectedValueOnce(new Error("emergency lock"));
    const response = await GET(request(), { params: Promise.resolve({ provider: "meta" }) });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });
});
