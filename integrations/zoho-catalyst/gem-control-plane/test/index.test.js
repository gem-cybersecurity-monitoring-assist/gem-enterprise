"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../index");

async function withServer(run) {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("Advanced I/O route policy fails closed", async () => {
  const previousKey = process.env.GEM_AGENT_API_KEY;
  delete process.env.GEM_AGENT_API_KEY;

  try {
    await withServer(async (baseUrl) => {
      const unknown = await fetch(`${baseUrl}/not-exposed`);
      assert.equal(unknown.status, 404);
      assert.equal((await unknown.json()).status, "BLOCKED_BY_POLICY");

      const wrongMethod = await fetch(`${baseUrl}/health`, { method: "POST" });
      assert.equal(wrongMethod.status, 405);
      assert.equal(wrongMethod.headers.get("allow"), "GET");

      const invalidView = await fetch(`${baseUrl}/context?view=arbitrary`);
      assert.equal(invalidView.status, 400);
      assert.equal((await invalidView.json()).error, "invalid_context_view");

      const missingCredential = await fetch(`${baseUrl}/health`);
      assert.equal(missingCredential.status, 503);
      assert.equal((await missingCredential.json()).status, "BLOCKED_BY_CREDENTIAL");
    });
  } finally {
    if (previousKey === undefined) delete process.env.GEM_AGENT_API_KEY;
    else process.env.GEM_AGENT_API_KEY = previousKey;
  }
});
