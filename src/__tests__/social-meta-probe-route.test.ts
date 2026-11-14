import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), workspace: vi.fn(), load: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/social-media/connector-authority", () => ({
  requireSocialConnectorSession: mocks.session,
  requireSocialConnectorWorkspace: mocks.workspace,
  tokMetricConnectorDatabase: () => undefined,
}));
vi.mock("@/lib/social-media/oauth/lifecycle-store", () => ({ loadSocialConnectorCredential: mocks.load }));
vi.mock("@/lib/tokmetric/security", async original => ({
  ...await original<typeof import("@/lib/tokmetric/security")>(),
  requirePermission: vi.fn(), emitTokMetricAudit: mocks.audit,
}));
import { TokMetricError } from "@/lib/tokmetric/security";
import { GET } from "@/app/api/social-media/connectors/[id]/test/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ userId: "owner" });
  mocks.workspace.mockResolvedValue({});
  mocks.audit.mockResolvedValue(undefined);
  mocks.load.mockResolvedValue({
    connector: { provider: "META", displayName: "Instagram test", safeMetadata: { accountType: "INSTAGRAM_PROFESSIONAL" } },
    credential: { provider: "META", externalAccountId: "123456789", accessToken: "private-test-token", grantedScopes: ["instagram_basic"] },
  });
  for (const [key, value] of Object.entries({
    META_SOCIAL_OAUTH_ENABLED: "true", META_APP_ID: "test-app", META_APP_SECRET: "test-secret",
    META_GRAPH_API_VERSION: "v27.0", META_OAUTH_REDIRECT_URI: "https://example.com/callback",
    META_SOCIAL_SCOPES: "instagram_basic pages_show_list", SOCIAL_TOKEN_ENCRYPTION_KEY: "test-key",
  })) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Instagram live-test route", () => {
  it("uses the stored account type and exact ID without exposing credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123456789", username: "test_instagram" })));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new NextRequest("https://example.com/api/social-media/connectors/connector-1/test?workspaceId=workspace-1"), {
      params: Promise.resolve({ id: "connector-1" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ healthy: true, accountName: "test_instagram", readOnlyProbe: true, externalPublishingActionTaken: false });
    expect(fetchMock.mock.calls[0][0].pathname).toBe("/v27.0/123456789");
    expect(fetchMock.mock.calls[0][0].searchParams.get("fields")).toBe("id,username,name");
    expect(JSON.stringify(payload)).not.toContain("private-test-token");
  });

  it("does not call Meta or load a credential for a revoked workspace membership", async () => {
    mocks.workspace.mockRejectedValueOnce(new TokMetricError(403, "WORKSPACE_FORBIDDEN", "Membership required."));
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new NextRequest("https://example.com/api/social-media/connectors/connector-1/test?workspaceId=workspace-1"), {
      params: Promise.resolve({ id: "connector-1" }),
    });
    expect(response.status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
