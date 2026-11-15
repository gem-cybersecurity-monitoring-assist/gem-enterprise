import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Exercise the actual Deno entry point, replacing only runtime imports and
// external boundaries. No live service, credentials or database is used.
const source = readFileSync("supabase/functions/gem-social-publishing-gateway/index.ts", "utf8");
const executable = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const TEST_SECRET = "test-adapter-secret-do-not-use-in-production";
const configured = {
  SUPABASE_URL: "https://gateway-test.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-placeholder",
  SOCIAL_GATEWAY_ADAPTER_SECRET: TEST_SECRET,
};

function worker(env: Record<string, string> = configured) {
  const rpc = vi.fn().mockResolvedValue({ data: { ok: true, rpcCount: 14 }, error: null });
  const createClient = vi.fn().mockReturnValue({ rpc });
  const errorLog = vi.fn();
  let handler: (request: Request) => Promise<Response>;
  runInNewContext(executable, {
    Deno: { env: { get: (key: string) => env[key] }, serve: (callback: typeof handler) => { handler = callback; } },
    createClient, Request, Response, TextEncoder, console: { error: errorLog },
  });
  expect(handler!).toBeTypeOf("function");
  return { request: (request: Request) => handler(request), rpc, createClient, errorLog };
}

function post(body = '{"action":"health"}', authorization: string | null = `Bearer ${TEST_SECRET}`) {
  return new Request("https://gateway-test.example.test", {
    method: "POST", body,
    headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
  });
}

describe("social publishing edge handler", () => {
  it.each(Object.keys(configured))("registers and returns safe 503 when %s is missing", async (key) => {
    const env: Record<string, string> = { ...configured };
    delete env[key];
    const w = worker(env);
    expect(w.createClient).not.toHaveBeenCalled();
    const response = await w.request(post());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "SOCIAL_PUBLISHING_GATEWAY_NOT_CONFIGURED", error: "The social publishing gateway requires administrator setup." });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(w.createClient).not.toHaveBeenCalled();
    expect(w.rpc).not.toHaveBeenCalled();
  });

  it.each([null, "Bearer wrong-test-credential", "Basic wrong-test-credential"])("rejects unauthorized requests before parsing or database access (%s)", async (authorization) => {
    const w = worker();
    const response = await w.request(post("invalid-json", authorization));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(w.createClient).not.toHaveBeenCalled();
    expect(w.rpc).not.toHaveBeenCalled();
  });

  it("does not allow an empty bearer with an empty configured secret", async () => {
    const w = worker({ ...configured, SOCIAL_GATEWAY_ADAPTER_SECRET: "" });
    expect((await w.request(post(undefined, "Bearer "))).status).toBe(503);
    expect(w.rpc).not.toHaveBeenCalled();
  });

  it.each(["invalid-json", "null", "[]"])("returns 400 for malformed authenticated JSON (%s)", async (body) => {
    const w = worker();
    expect((await w.request(post(body))).status).toBe(400);
    expect(w.createClient).not.toHaveBeenCalled();
  });

  it("runs authenticated health through the existing RPC and caches the client", async () => {
    const w = worker();
    expect(await (await w.request(post())).json()).toEqual({ ok: true, rpcCount: 14 });
    expect((await w.request(post())).status).toBe(200);
    expect(w.createClient).toHaveBeenCalledTimes(1);
    expect(w.createClient).toHaveBeenCalledWith(configured.SUPABASE_URL, configured.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(w.rpc).toHaveBeenCalledWith("gem_social_health", {});
  });

  it("redacts client initialization failures and permits a later successful retry", async () => {
    const w = worker();
    w.createClient.mockImplementationOnce(() => { throw new Error(`private ${configured.SUPABASE_SERVICE_ROLE_KEY}`); });
    const response = await w.request(post());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(configured.SUPABASE_SERVICE_ROLE_KEY);
    expect(JSON.stringify(w.errorLog.mock.calls)).not.toContain(configured.SUPABASE_SERVICE_ROLE_KEY);
    expect(w.rpc).not.toHaveBeenCalled();
    expect((await w.request(post())).status).toBe(200);
  });

  it("redacts raw RPC errors from logs and preserves the stable failure code", async () => {
    const w = worker();
    w.rpc.mockResolvedValue({ data: null, error: { code: "private-code", message: `private ${TEST_SECRET}`, details: configured.SUPABASE_SERVICE_ROLE_KEY } });
    const response = await w.request(post());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SOCIAL_PUBLISHING_GATEWAY_RPC_FAILED");
    expect(w.errorLog.mock.calls).toEqual([["social publishing gateway RPC failed"]]);
  });

  it("redacts unexpected exceptions", async () => {
    const w = worker();
    w.rpc.mockRejectedValue(new Error(`private ${TEST_SECRET}`));
    const response = await w.request(post());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "INTERNAL_ERROR", error: "Internal gateway error" });
    expect(w.errorLog.mock.calls).toEqual([["social publishing gateway request failed"]]);
  });

  it("preserves provisioning failure semantics", async () => {
    const w = worker();
    w.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "missing function" } });
    const response = await w.request(post());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SOCIAL_PUBLISHING_STORE_NOT_PROVISIONED");
  });

  it("keeps CORS preflight and method checks available without configuration", async () => {
    const w = worker({});
    const options = await w.request(new Request("https://gateway-test.example.test", { method: "OPTIONS" }));
    expect(options.status).toBe(200);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("https://www.gemcybersecurityassist.com");
    expect((await w.request(new Request("https://gateway-test.example.test"))).status).toBe(405);
    expect(w.createClient).not.toHaveBeenCalled();
  });

  it("does not initialize a database for unknown or reserved actions", async () => {
    const w = worker();
    expect((await w.request(post('{"action":"unknown"}'))).status).toBe(400);
    expect((await w.request(post('{"action":"count_jobs"}'))).status).toBe(400);
    expect(w.createClient).not.toHaveBeenCalled();
  });
});
