import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TRUSTED_HOSTS = new Set([
  "www.gemcybersecurityassist.com",
  "support371-gem-enterprise.vercel.app",
]);

/** Only the canonical GEM website/verified alias may be probed. */
export function approvedOrigin(input) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    !TRUSTED_HOSTS.has(url.hostname) ||
    url.port || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("Smoke target must be the canonical HTTPS GEM website or its verified Vercel alias.");
  }
  return url.origin;
}

/** Separate public site availability from authenticated/provider readiness. */
export function assessSnapshot(snapshot) {
  const checks = [];
  const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
  const basic = snapshot.basic?.json || {};
  const deep = snapshot.deep?.json || {};
  const backend = basic.services?.backend;
  const deployment = basic.deployment || {};
  check("Public homepage responds 200", snapshot.home?.status === 200);
  check("Primary health responds 200", snapshot.basic?.status === 200);
  check("Database/gateway health is OK", basic.status === "ok" && basic.services?.database === "ok");
  check("Active deployment is production main", deployment.environment === "production" && deployment.branch === "main");
  check("Deep production health responds healthy", snapshot.deep?.status === 200 && deep.status === "healthy");
  check("Backend authority agrees across probes",
    ["prisma", "supabase_gateway"].includes(backend) &&
    deep.databaseBackend === backend &&
    Array.isArray(deep.services) &&
    deep.services.some((x) => x.name === "database" && x.status === "healthy"));
  check("Health responses prohibit caching",
    snapshot.basic?.cacheControl?.includes("no-store") &&
    snapshot.deep?.cacheControl?.includes("no-store"));
  const warnings = [];
  if (basic.services?.authenticationVerified !== true) {
    warnings.push("AUTHENTICATION_NOT_VERIFIED: configured is not a successful login.");
  }
  if (snapshot.expectedCommit && deployment.commitSha &&
      !snapshot.expectedCommit.startsWith(deployment.commitSha)) {
    warnings.push("DEPLOYMENT_REF_DIFFERS: GitHub ref may be newer than the current production deployment.");
  }
  warnings.push("PUBLISHING_NOT_TESTED: no external provider write, login, OAuth or cron was attempted.");
  warnings.push("MIGRATIONS_NOT_TESTED: health is not Supabase schema/backup validation.");
  return {
    checkedAt: new Date().toISOString(),
    ok: checks.every((x) => x.passed),
    deployedCommit: deployment.commitSha ?? null,
    expectedCommit: snapshot.expectedCommit || null,
    backend: backend ?? "unknown",
    authenticationVerified: basic.services?.authenticationVerified === true,
    serviceActivation: "NOT_VERIFIED",
    checks,
    warnings,
  };
}

async function readPublic(origin, path, json = true) {
  const response = await fetch(origin + path, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { accept: json ? "application/json" : "text/html" },
  });
  const metadata = {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    json: null,
  };
  if (json) {
    const body = await response.text();
    if (body.length > 16384) throw new Error("Unexpectedly large health response.");
    try { metadata.json = JSON.parse(body); }
    catch { throw new Error("Health response is not JSON."); }
  } else {
    await response.body?.cancel();
  }
  return metadata;
}

async function publishSummary(report) {
  console.log(JSON.stringify(report, null, 2));
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = [
    "# GEM production read-only acceptance",
    "",
    "Canonical site: https://www.gemcybersecurityassist.com",
    "",
    ...report.checks.map((x) => (x.passed ? "PASS" : "FAIL") + " — " + x.name),
    "",
    "Backend: " + report.backend,
    "Authentication verified: " + report.authenticationVerified,
    "Live provider publishing: NOT VERIFIED / NOT ATTEMPTED",
    "",
    ...report.warnings.map((x) => "- " + x),
    "",
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"), "utf8");
}

export async function runSmoke() {
  const origin = approvedOrigin(process.env.GEM_SMOKE_URL || "https://www.gemcybersecurityassist.com");
  const [home, basic, deep] = await Promise.all([
    readPublic(origin, "/", false),
    readPublic(origin, "/api/health"),
    readPublic(origin, "/api/v1/production/health"),
  ]);
  const report = assessSnapshot({
    home, basic, deep,
    expectedCommit: process.env.GEM_EXPECTED_COMMIT_SHA || null,
  });
  await publishSummary(report);
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmoke().catch(async (error) => {
    const message = error instanceof Error ? error.message : "Unrecognized smoke-test error";
    const report = {
      ok: false, backend: "unknown", authenticationVerified: false,
      checks: [{ name: "Public health probes completed", passed: false }],
      warnings: ["HEALTH_PROBE_FAILED: " + message, "Live provider operations were not attempted."],
    };
    await publishSummary(report);
    process.exitCode = 1;
  });
}
