"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ALLOWED_ROUTES, callGem, cleanBaseUrl } = require("../bridge");

test("only approved GEM agent routes are exposed", () => {
  assert.deepEqual(ALLOWED_ROUTES, {
    health: "/api/agent/health",
    context: "/api/agent/context",
  });
});

test("base URL is normalized", () => {
  assert.equal(cleanBaseUrl("https://example.test///"), "https://example.test");
});

test("missing agent credential fails closed before network access", async () => {
  const previous = process.env.GEM_AGENT_API_KEY;
  delete process.env.GEM_AGENT_API_KEY;
  let called = false;
  try {
    await assert.rejects(
      () => callGem("health", {}, async () => {
        called = true;
        throw new Error("should not run");
      }),
      (error) => error && error.code === "GEM_AGENT_NOT_CONFIGURED",
    );
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.GEM_AGENT_API_KEY;
    else process.env.GEM_AGENT_API_KEY = previous;
  }
});

test("unsupported operation is denied before network access", async () => {
  const previous = process.env.GEM_AGENT_API_KEY;
  process.env.GEM_AGENT_API_KEY = "x".repeat(32);
  let called = false;
  try {
    await assert.rejects(
      () => callGem("arbitrary", {}, async () => {
        called = true;
        throw new Error("should not run");
      }),
      (error) => error && error.code === "GEM_OPERATION_NOT_ALLOWED",
    );
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.GEM_AGENT_API_KEY;
    else process.env.GEM_AGENT_API_KEY = previous;
  }
});

test("approved request sends only the server-side GEM credential", async () => {
  const previousKey = process.env.GEM_AGENT_API_KEY;
  const previousBase = process.env.GEM_AGENT_API_BASE_URL;
  process.env.GEM_AGENT_API_KEY = "k".repeat(32);
  process.env.GEM_AGENT_API_BASE_URL = "https://gem.example";

  try {
    const result = await callGem("context", { view: "platform" }, async (url, options) => {
      assert.equal(url.toString(), "https://gem.example/api/agent/context?view=platform");
      assert.equal(options.method, "GET");
      assert.equal(options.headers["x-gem-agent-key"], "k".repeat(32));
      assert.equal(options.headers["x-gem-bridge"], "zoho-catalyst");
      return {
        status: 200,
        ok: true,
        async json() {
          return { ok: true, status: "operational" };
        },
      };
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  } finally {
    if (previousKey === undefined) delete process.env.GEM_AGENT_API_KEY;
    else process.env.GEM_AGENT_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.GEM_AGENT_API_BASE_URL;
    else process.env.GEM_AGENT_API_BASE_URL = previousBase;
  }
});
