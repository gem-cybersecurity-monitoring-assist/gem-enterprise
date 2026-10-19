#!/usr/bin/env node
// Local-only anonymous route-access probe. Sends cookie-less GET requests to a loopback
// server and compares each page's response with the access rules declared in src/proxy.ts.
// No writes, no credentials, no non-loopback hosts. API probing is opt-in (--include-api)
// because some GET handlers read data; point it only at a disposable, non-production server.
//
//   node scripts/generate-gem-route-inventory.mjs
//   node scripts/verify-local-route-access.mjs --base http://127.0.0.1:3000 [--include-api]
//
// Output: docs/generated/GEM_ROUTE_ACCESS.local.csv (gitignored). Exit code 1 when a protected
// page is served to an anonymous visitor (directly or through a dotted dynamic segment).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const base = new URL(option("--base", "http://127.0.0.1:3000"));
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || !["http:", "https:"].includes(base.protocol)) {
  console.error(`Refusing to probe ${base.origin}: only loopback servers are allowed.`);
  process.exit(2);
}
const includeApi = flag("--include-api");
const timeoutMs = Number(option("--timeout-ms", "20000"));

const inventoryPath = path.join(root, "docs", "generated", "GEM_ROUTE_INVENTORY.local.json");
if (!fs.existsSync(inventoryPath)) {
  console.error("Missing docs/generated/GEM_ROUTE_INVENTORY.local.json. Run node scripts/generate-gem-route-inventory.mjs first.");
  process.exit(2);
}
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

// Read the rule arrays from src/proxy.ts so expectations follow the source, not a copy.
const proxySource = fs.readFileSync(path.join(root, "src", "proxy.ts"), "utf8");
function stringArray(name) {
  const body = proxySource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1];
  if (body == null) throw new Error(`Could not find ${name} in src/proxy.ts`);
  const spreads = [...body.matchAll(/\.\.\.([A-Z_]+)/g)].flatMap((m) => stringArray(m[1]));
  return [...[...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]), ...spreads];
}
const PROTECTED = stringArray("PROTECTED_PREFIXES");
const ADMIN = stringArray("ADMIN_PREFIXES");
const REVIEW = stringArray("REVIEW_PREFIXES");
const PUBLIC = stringArray("ALWAYS_PUBLIC");
const matches = (p, prefixes) => prefixes.some((x) => p === x || p.startsWith(`${x}/`));
function expectedLogin(p) {
  if (p.startsWith("/app/admin/workspace-access") || p.startsWith("/app/admin/plan-workspaces")) return "/super-admin-login";
  if (matches(p, ADMIN)) return "/admin-login";
  if (matches(p, REVIEW)) return "/team-login";
  return "/client-login";
}

function concrete(template, sample) {
  return template.replace(/\/\*$/, "").replace(/:[A-Za-z0-9_]+/g, sample) || "/";
}
function handlerHasGet(sourceFile) {
  const src = fs.readFileSync(path.join(root, sourceFile), "utf8");
  return /export\s+(async\s+)?function\s+GET\b|export\s+const\s+GET\b|export\s*\{[^}]*\bGET\b/.test(src);
}

async function probe(urlPath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(urlPath, base), { redirect: "manual", signal: controller.signal, headers: { accept: "text/html,application/json" } });
    await res.arrayBuffer().catch(() => {});
    return { status: res.status, location: res.headers.get("location") || "" };
  } catch (error) {
    return { status: 0, location: "", error: error.name === "AbortError" ? "timeout" : error.message };
  } finally {
    clearTimeout(timer);
  }
}

function judgePage(urlPath, result) {
  const protectedRoute = matches(urlPath, PROTECTED) && !PUBLIC.includes(urlPath);
  if (!protectedRoute) {
    const ok = result.status > 0 && result.status < 500;
    return { expected: "anonymous allowed", verdict: ok ? "PASS" : "REVIEW" };
  }
  const login = expectedLogin(urlPath.split("?")[0]);
  if ([307, 308].includes(result.status)) {
    const target = new URL(result.location, base);
    const ok = target.pathname === login;
    return { expected: `redirect to ${login}`, verdict: ok ? "PASS" : "REVIEW" };
  }
  if (result.status === 404) return { expected: `redirect to ${login}`, verdict: "PASS_NOT_FOUND" };
  if (result.status >= 200 && result.status < 300) return { expected: `redirect to ${login}`, verdict: "FAIL_SERVED_ANONYMOUSLY" };
  return { expected: `redirect to ${login}`, verdict: "REVIEW" };
}

function judgeApi(result) {
  if ([401, 403].includes(result.status)) return { expected: "deny or public", verdict: "DENIES_ANONYMOUS" };
  if (result.status === 405) return { expected: "deny or public", verdict: "METHOD_NOT_ALLOWED" };
  if (result.status >= 200 && result.status < 400) return { expected: "deny or public", verdict: "SERVED_ANONYMOUSLY_CLASSIFY" };
  if (result.status >= 500 || result.status === 0) return { expected: "deny or public", verdict: "ERROR_REVIEW" };
  return { expected: "deny or public", verdict: "REVIEW" };
}

const rows = [];
const pages = inventory.routes.filter((r) => r.record_type === "PAGE");
for (const route of pages) {
  const dynamic = /[:*]/.test(route.path);
  const cases = [{ variant: "sample", urlPath: concrete(route.path, "verify-sample") }];
  // A "." in the path makes the proxy treat the request as a static asset and skip auth.
  if (dynamic && matches(concrete(route.path, "x"), PROTECTED)) {
    cases.push({ variant: "dotted-segment", urlPath: concrete(route.path, "verify.sample") });
  }
  for (const c of cases) {
    const result = await probe(c.urlPath);
    const judged = judgePage(c.urlPath, result);
    rows.push({ kind: "PAGE", template: route.path, variant: c.variant, url_path: c.urlPath, source_file: route.source_file, status: result.status, location: result.location, ...judged, error: result.error || "" });
  }
}

if (includeApi) {
  for (const route of inventory.routes.filter((r) => r.record_type === "ROUTE_HANDLER")) {
    if (!handlerHasGet(route.source_file)) {
      rows.push({ kind: "API", template: route.path, variant: "no-GET-export", url_path: "", source_file: route.source_file, status: "", location: "", expected: "", verdict: "SKIPPED_NO_GET", error: "" });
      continue;
    }
    const urlPath = concrete(route.path, "verify-sample");
    const result = await probe(urlPath);
    rows.push({ kind: "API", template: route.path, variant: "anonymous-GET", url_path: urlPath, source_file: route.source_file, status: result.status, location: result.location, ...judgeApi(result), error: result.error || "" });
  }
}

const cols = ["kind", "template", "variant", "url_path", "source_file", "status", "location", "expected", "verdict", "error"];
const cell = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const outPath = path.join(root, "docs", "generated", "GEM_ROUTE_ACCESS.local.csv");
fs.writeFileSync(outPath, [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n", "utf8");

const tally = {};
for (const r of rows) tally[`${r.kind} ${r.verdict}`] = (tally[`${r.kind} ${r.verdict}`] || 0) + 1;
console.log(`GEM local route-access probe against ${base.origin} (inventory commit ${inventory.metadata?.source_commit ?? "unknown"})`);
for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k}: ${v}`);
const failures = rows.filter((r) => r.verdict.startsWith("FAIL"));
for (const f of failures) console.log(`  FAIL ${f.url_path} -> ${f.status} (${f.source_file})`);
console.log(`Output: ${path.relative(root, outPath).split(path.sep).join("/")}`);
process.exit(failures.length ? 1 : 0);
