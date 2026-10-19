import test from "node:test";
import assert from "node:assert/strict";
import { approvedOrigin, assessSnapshot } from "./production-readonly-smoke.mjs";

const snapshot = () => ({
  home: { status: 200 },
  basic: {
    status: 200, cacheControl: "no-store, max-age=0",
    json: {
      status: "ok",
      deployment: { environment: "production", branch: "main", commitSha: "e78517e63195" },
      services: { database: "ok", backend: "supabase_gateway", authentication: "configured", authenticationVerified: false },
    },
  },
  deep: {
    status: 200, cacheControl: "no-store",
    json: {
      status: "healthy",
      databaseBackend: "supabase_gateway",
      services: [{ name: "database", status: "healthy" }],
    },
  },
  expectedCommit: "e78517e63195ac9d41f94c04c566c2bb838a8881",
});

test("only approved canonical HTTPS hosts are used for outbound probes", () => {
  assert.equal(approvedOrigin("https://www.gemcybersecurityassist.com/"), "https://www.gemcybersecurityassist.com");
  assert.equal(approvedOrigin("https://support371-gem-enterprise.vercel.app"), "https://support371-gem-enterprise.vercel.app");
  for (const url of [
    "http://www.gemcybersecurityassist.com/",
    "https://attacker.example.com/",
    "https://www.gemcybersecurityassist.com@attacker.example.com/",
    "https://www.gemcybersecurityassist.com/api/private",
    "https://www.gemcybersecurityassist.com?token=anything",
  ]) {
    assert.throws(() => approvedOrigin(url));
  }
});

test("reports a healthy website but does not certify authenticated services or publishing", () => {
  const result = assessSnapshot(snapshot());
  assert.equal(result.ok, true);
  assert.equal(result.authenticationVerified, false);
  assert.equal(result.serviceActivation, "NOT_VERIFIED");
  assert.ok(result.warnings.some((x) => x.startsWith("AUTHENTICATION_NOT_VERIFIED")));
  assert.ok(result.warnings.some((x) => x.startsWith("PUBLISHING_NOT_TESTED")));
});

test("marks a failing gateway probe as an error rather than masking it", () => {
  const broken = snapshot();
  broken.basic.status = 503;
  broken.basic.json.status = "degraded";
  broken.basic.json.services.database = "error";
  const result = assessSnapshot(broken);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((x) => x.name === "Database/gateway health is OK" && !x.passed));
});

test("marks mismatched persistence authorities as unhealthy", () => {
  const broken = snapshot();
  broken.deep.json.databaseBackend = "prisma";
  assert.equal(assessSnapshot(broken).ok, false);
});

test("refuses health endpoints that do not prohibit caching", () => {
  const broken = snapshot();
  broken.deep.cacheControl = "public, max-age=300";
  assert.equal(assessSnapshot(broken).ok, false);
});

test("a delayed deployment is a warning rather than proof the public website failed", () => {
  const delayed = snapshot();
  delayed.expectedCommit = "1234567890123456789012345678901234567890";
  const result = assessSnapshot(delayed);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((x) => x.startsWith("DEPLOYMENT_REF_DIFFERS")));
});
