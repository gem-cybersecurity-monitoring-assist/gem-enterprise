import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), account: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.account } } }));
import { POST } from "@/app/api/social-media/gateway-health/route";
import { probeSocialPublishingGatewayAdapter } from "@/lib/social-media/publishing/gateway-client";

const owner = { userId: "owner-1", email: "owner@example.test", role: "super_admin", authSource: "supabase_gateway", sessionVersion: 2 };
const secret = "fake-diagnostic-adapter-secret-for-tests-only";
const target = "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1/gem-social-publishing-gateway";
const handler: (request: Request) => Promise<Response> = POST;
const call = (payload: unknown = {}) => handler(new Request("http://localhost/api/social-media/gateway-health", { method: "POST", body: JSON.stringify(payload) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("GEM_SUPABASE_GATEWAY_BASE_URL", "");
  vi.stubEnv("GEM_SUPABASE_GATEWAY_ANON_KEY", "fake-publishable-key");
  vi.stubEnv("SOCIAL_GATEWAY_ADAPTER_SECRET", secret);
  vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "false");
  vi.stubEnv("SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED", "false");
  mocks.session.mockResolvedValue(owner);
  mocks.fetch.mockResolvedValue(Response.json({ ok: true, rpcCount: 14 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("owner gateway diagnostics", () => {
  it("authenticates the fixed health action with flags off and returns only safe fields", async () => {
    const res = await call({ action: "load_credential", connectorId: "another-account", url: "https://other.invalid", secret: "ignored" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ state: "HEALTHY", rpcCount: 14, expectedRpcCount: 14, adapterEnabled: false, livePublishingEnabled: false, publishingPermissionChanged: false });
    expect(new Date(body.checkedAt).toISOString()).toBe(body.checkedAt);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(target, expect.objectContaining({ method: "POST", body: '{"action":"health"}', headers: { Authorization: `Bearer ${secret}`, apikey: "fake-publishable-key", "Content-Type": "application/json" }, cache: "no-store" }));
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(process.env.SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED).toBe("false");
    expect(process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED).toBe("false");
    mocks.fetch.mockClear();
    expect(await probeSocialPublishingGatewayAdapter()).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(["admin", "internal", "analyst", "client"])("denies %s before any gateway request", async role => {
    mocks.session.mockResolvedValue({ ...owner, role });
    expect((await call()).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("denies anonymous requests", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("reconciles local owner claims against current account role", async () => {
    mocks.session.mockResolvedValue({ ...owner, authSource: "local" });
    mocks.account.mockResolvedValue({ id: owner.userId, email: owner.email, role: "admin", isActive: true, status: "active", sessionVersion: 2, organizationId: null });
    expect((await call()).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects a suspended local owner", async () => {
    mocks.session.mockResolvedValue({ ...owner, authSource: "local" });
    mocks.account.mockResolvedValue({ id: owner.userId, email: owner.email, role: "super_admin", isActive: false, status: "suspended", sessionVersion: 2, organizationId: null });
    expect((await call()).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("reports missing Vercel configuration without making a request", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_ADAPTER_SECRET", "");
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: "SETUP_REQUIRED", code: "VERCEL_ADAPTER_SECRET_MISSING", rpcCount: null });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    "https://another-project.supabase.co/functions/v1",
    "https://slzdjoqpzbkwzuaexlkj.supabase.co.attacker.invalid/functions/v1",
    "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1?override=true",
    "http://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1",
  ])("rejects wrong target %s before sending credentials", async base => {
    vi.stubEnv("GEM_SUPABASE_GATEWAY_BASE_URL", base);
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: "SETUP_REQUIRED", code: "GATEWAY_TARGET_MISMATCH" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("accepts the exact original target with a trailing slash", async () => {
    vi.stubEnv("GEM_SUPABASE_GATEWAY_BASE_URL", "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1/");
    expect((await call()).status).toBe(200);
    expect(mocks.fetch.mock.calls[0][0]).toBe(target);
  });
  it.each([
    [503, "SOCIAL_PUBLISHING_GATEWAY_NOT_CONFIGURED", "SETUP_REQUIRED"],
    [401, "UNAUTHORIZED", "AUTHENTICATION_FAILED"],
    [403, "FORBIDDEN", "AUTHENTICATION_FAILED"],
    [503, "SOCIAL_PUBLISHING_STORE_NOT_PROVISIONED", "INCOMPLETE_RPC_INVENTORY"],
    [500, secret, "UNAVAILABLE"],
  ])("redacts gateway HTTP %i/%s", async (status, code, state) => {
    mocks.fetch.mockResolvedValue(Response.json({ error: secret, code }, { status: Number(status) }));
    const log = vi.spyOn(console, "error");
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.state).toBe(state);
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it.each([null, [], {}, { ok: "true", rpcCount: 14 }, { ok: false, rpcCount: 14 }, { ok: true, rpcCount: "14" }, { ok: true, rpcCount: -1 }, { ok: true, rpcCount: 14.5 }, { ok: true, rpcCount: Number.MAX_SAFE_INTEGER + 1 }])("rejects malformed successful health payload %j", async payload => {
    mocks.fetch.mockResolvedValue(Response.json(payload));
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ state: "UNAVAILABLE", code: "GATEWAY_INVALID_HEALTH_RESPONSE", rpcCount: null });
  });
  it("reports partial RPC inventory as incomplete", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ ok: true, rpcCount: 13 }));
    expect(await (await call()).json()).toMatchObject({ state: "INCOMPLETE_RPC_INVENTORY", rpcCount: 13 });
  });
  it.each(["network", "timeout", "invalidJson", "authException"])("redacts %s failures", async failure => {
    if (failure === "network") mocks.fetch.mockRejectedValue(new Error(secret));
    if (failure === "timeout") mocks.fetch.mockRejectedValue(Object.assign(new Error(secret), { name: "AbortError" }));
    if (failure === "invalidJson") mocks.fetch.mockResolvedValue(new Response(secret));
    if (failure === "authException") mocks.session.mockRejectedValue(new Error(secret));
    const res = await call();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain(secret);
  });
});
