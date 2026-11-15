import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), account: vi.fn(), membership: vi.fn(), connectors: vi.fn(),
  credential: vi.fn(), audit: vi.fn(), scopedClient: vi.fn(), fetch: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionFromRequest: mocks.session }));
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: mocks.account }, workspaceMember: { findFirst: mocks.membership },
  connector: { findMany: mocks.connectors }, connectorCredentialReference: { findUnique: mocks.credential },
  auditEvent: { create: mocks.audit },
} }));
vi.mock("@prisma/client", () => ({ PrismaClient: class { constructor(options: unknown) { return mocks.scopedClient(options); } } }));
import { POST } from "@/app/api/tokmetric/connectors/health/route";
import { encryptCredential } from "@/lib/tokmetric/oauth/crypto";

const session = { userId: "user-1", email: "operator@example.test", role: "admin", kycStatus: "approved", entitlements: [], authSource: "supabase_gateway", sessionVersion: 2 };
const connector = { id: "connector-1", workspaceId: "workspace-1", provider: "TIKTOK_CONTENT_POSTING_API", state: "CONNECTED", disabledAt: null, externalAccountId: "account-1", grantedScopes: ["user.info.basic", "video.publish"] };
const stored = { accessToken: "fake-access-token-for-tests", environment: "production", provider: "TIKTOK_CONTENT_POSTING_API", externalAccountId: "account-1", grantedScopes: ["user.info.basic", "video.publish"] };
const request = (workspace = "workspace-1") => new NextRequest(`http://localhost/api/tokmetric/connectors/health?workspaceId=${workspace}`, { method: "POST" });
const response = async () => (await POST(request())).json();
function setCredential(value = stored) { mocks.credential.mockResolvedValue({ secretRef: encryptCredential(value), expiresAt: null }); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("GEM_AUTH_GATEWAY_ENABLED", "false");
  vi.stubEnv("SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED", "true");
  vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", "");
  vi.stubEnv("POSTGRES_PRISMA_URL", "postgresql://postgres.slzdjoqpzbkwzuaexlkj@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&sslaccept=strict");
  vi.stubEnv("TIKTOK_ENVIRONMENT", "production");
  vi.stubEnv("TOKMETRIC_TOKEN_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  mocks.session.mockResolvedValue(session);
  mocks.account.mockResolvedValue({ id: session.userId, email: session.email, role: "admin", organizationId: null, isActive: true, status: "active", sessionVersion: 2 });
  mocks.membership.mockResolvedValue({ role: { permissions: [{ action: "manage", scope: "connectors" }] } });
  mocks.connectors.mockResolvedValue([connector]);
  setCredential();
  mocks.audit.mockResolvedValue({});
  mocks.fetch.mockResolvedValue(Response.json({ data: { user: { open_id: "account-1" } }, error: { code: "ok" } }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("authorized read-only TikTok verification", () => {
  it("verifies the actual provider identity without leaking credentials or granting publishing", async () => {
    const res = await POST(request());
    const payload = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(payload.checks[0]).toMatchObject({ connectorId: "connector-1", status: "verified", code: "TIKTOK_IDENTITY_VERIFIED" });
    expect(mocks.fetch).toHaveBeenCalledWith("https://open.tiktokapis.com/v2/user/info/?fields=open_id", expect.objectContaining({ method: "GET", cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${stored.accessToken}` }, signal: expect.any(AbortSignal) }));
    expect(mocks.connectors).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-1", provider: "TIKTOK_CONTENT_POSTING_API" }, take: 11 }));
    expect(JSON.stringify(payload)).not.toContain(stored.accessToken);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(stored.accessToken);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "workspace-1", action: "tokmetric.connector.identity_checked", outcome: "success" }) }));
  });

  it.each(["session", "membership", "permission", "backend", "stale", "inactive"])("denies %s before credential access or provider calls", async failure => {
    if (failure === "session") mocks.session.mockResolvedValue(null);
    if (failure === "membership") mocks.membership.mockResolvedValue(null);
    if (failure === "permission") mocks.membership.mockResolvedValue({ role: { permissions: [] } });
    if (failure === "backend") vi.stubEnv("SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED", "false");
    if (failure === "stale") mocks.account.mockResolvedValue({ id: session.userId, email: session.email, role: "admin", isActive: true, status: "active", sessionVersion: 3 });
    if (failure === "inactive") mocks.account.mockResolvedValue({ id: session.userId, email: session.email, role: "admin", isActive: false, status: "inactive", sessionVersion: 2 });
    expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.connectors).not.toHaveBeenCalled();
    expect(mocks.credential).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects missing workspace", async () => {
    expect((await POST(request(""))).status).toBe(400);
    expect(mocks.credential).not.toHaveBeenCalled();
  });

  it.each(["disabled", "disconnected", "missing", "expired", "badExpiry", "wrongEnvironment", "wrongAccount", "wrongProvider", "missingScope", "corrupt"])("does not probe %s authorization", async failure => {
    if (failure === "disabled") mocks.connectors.mockResolvedValue([{ ...connector, disabledAt: new Date() }]);
    if (failure === "disconnected") mocks.connectors.mockResolvedValue([{ ...connector, state: "DISCONNECTED" }]);
    if (failure === "missing") mocks.credential.mockResolvedValue(null);
    if (failure === "expired") setCredential({ ...stored, expiresAt: "2020-01-01T00:00:00.000Z" } as typeof stored);
    if (failure === "badExpiry") setCredential({ ...stored, expiresAt: "invalid" } as typeof stored);
    if (failure === "wrongEnvironment") setCredential({ ...stored, environment: "sandbox" });
    if (failure === "wrongAccount") setCredential({ ...stored, externalAccountId: "another-account" });
    if (failure === "wrongProvider") setCredential({ ...stored, provider: "TIKTOK_LOGIN_KIT" });
    if (failure === "missingScope") setCredential({ ...stored, grantedScopes: ["video.publish"] });
    if (failure === "corrupt") mocks.credential.mockResolvedValue({ secretRef: "bad", expiresAt: null });
    const payload = await response();
    expect(payload.checks[0].status).not.toBe("verified");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500])("handles provider HTTP %i without logging or returning its body", async status => {
    mocks.fetch.mockResolvedValue(Response.json({ error: { code: "private-error", message: stored.accessToken } }, { status }));
    const log = vi.spyOn(console, "error");
    const payload = await response();
    expect(payload.checks[0].status).toBe(status < 429 ? "authorization_required" : "unavailable");
    expect(JSON.stringify(payload)).not.toContain(stored.accessToken);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it.each(["wrongIdentity", "providerError", "missingCode", "invalidJson", "network"])("fails closed for %s", async failure => {
    if (failure === "wrongIdentity") mocks.fetch.mockResolvedValue(Response.json({ data: { user: { open_id: "another" } }, error: { code: "ok" } }));
    if (failure === "providerError") mocks.fetch.mockResolvedValue(Response.json({ error: { code: "access_token_invalid", message: stored.accessToken } }));
    if (failure === "missingCode") mocks.fetch.mockResolvedValue(Response.json({ data: { user: { open_id: "account-1" } } }));
    if (failure === "invalidJson") mocks.fetch.mockResolvedValue(new Response("invalid"));
    if (failure === "network") mocks.fetch.mockRejectedValue(new Error(stored.accessToken));
    const payload = await response();
    expect(payload.checks[0].status).not.toBe("verified");
    expect(JSON.stringify(payload)).not.toContain(stored.accessToken);
  });

  it("limits the provider fanout before any credential access", async () => {
    mocks.connectors.mockResolvedValue(Array.from({ length: 11 }, (_, i) => ({ ...connector, id: String(i) })));
    expect((await POST(request())).status).toBe(409);
    expect(mocks.credential).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("reports no saved connector without fabricating verification", async () => {
    mocks.connectors.mockResolvedValue([]);
    expect((await response()).checks).toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects a namespaced backend for another project before any account access", async () => {
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL!.replace("slzdjoqpzbkwzuaexlkj", "aaaaaaaaaaaaaaaaaaaa"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.connectors).not.toHaveBeenCalled();
    expect(mocks.scopedClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("uses only the pinned scoped database including its audit sink", async () => {
    const scoped = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: session.userId, email: session.email, role: "admin", organizationId: null, isActive: true, status: "active", sessionVersion: 2 }) },
      workspaceMember: { findFirst: vi.fn().mockResolvedValue({ role: { permissions: [{ action: "manage", scope: "connectors" }] } }) },
      connector: { findMany: vi.fn().mockResolvedValue([connector]) },
      connectorCredentialReference: { findUnique: vi.fn().mockResolvedValue({ secretRef: encryptCredential(stored), expiresAt: null }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    mocks.scopedClient.mockReturnValue(scoped);
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL!);
    vi.stubEnv("POSTGRES_PRISMA_URL", "");
    expect((await POST(request())).status).toBe(200);
    expect(scoped.user.findUnique).toHaveBeenCalled();
    expect(scoped.workspaceMember.findFirst).toHaveBeenCalled();
    expect(scoped.connector.findMany).toHaveBeenCalled();
    expect(scoped.connectorCredentialReference.findUnique).toHaveBeenCalled();
    expect(scoped.auditEvent.create).toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.membership).not.toHaveBeenCalled();
    expect(mocks.connectors).not.toHaveBeenCalled();
    expect(mocks.credential).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
