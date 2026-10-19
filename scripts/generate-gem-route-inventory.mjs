#!/usr/bin/env node
// Read-only GEM inventory generator. No network, deployment, provider calls, or secret reads.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const outputDir = path.join(root, "docs", "generated");
const excluded = new Set([".git", ".next", "node_modules", "coverage", "dist", "build", ".vercel"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".yaml", ".yml", ".toml", ".html", ".css", ".xml", ".txt", ".prisma", ".sql"]);
function rel(file) { return path.relative(root, file).split(path.sep).join("/"); }
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".env") && e.name !== ".env.example") continue;
    if (excluded.has(e.name) || ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
function routeFromFile(file) {
  let s = rel(file).replace(/^src\/app/, "").replace(/\/(page|route)\.(tsx?|jsx?)$/, "");
  if (!s) s = "/";
  return s.replace(/\/\[\[\.\.\.([^\]]+)\]\]/g, "/*").replace(/\/\[\.\.\.([^\]]+)\]/g, "/*").replace(/\/\[([^\]]+)\]/g, "/:$1");
}
function cell(v) {
  const s = String(v == null ? "" : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csv(rows, cols) { return [cols.map(cell).join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\r\n") + "\r\n"; }
function originOf(value) {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "example.com" || u.hostname.endsWith(".example.com")) return null;
    return { origin: u.origin, hostname: u.hostname, protocol: u.protocol.slice(0, -1) };
  } catch { return null; }
}
function envKeys(content) { return content.split(/\r?\n/).map(x => x.match(/^\s*([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean); }
function lineAt(content, index) {
  const a = content.lastIndexOf("\n", index) + 1, b = content.indexOf("\n", index);
  return content.slice(a, b < 0 ? content.length : b).trim().slice(0, 200);
}
const files = walk(root);
const appFiles = files.filter(f => rel(f).startsWith("src/app/"));
const pageFiles = appFiles.filter(f => /\/page\.(tsx?|jsx?)$/.test(f));
const handlerFiles = appFiles.filter(f => /\/route\.(tsx?|jsx?)$/.test(f));
let commit = "UNKNOWN";
try {
  const head = fs.readFileSync(path.join(root, ".git", "HEAD"), "utf8").trim();
  if (/^[a-f0-9]{40}$/i.test(head)) commit = head;
  else if (head.startsWith("ref: ")) {
    const p = path.join(root, ".git", head.slice(5));
    if (fs.existsSync(p)) commit = fs.readFileSync(p, "utf8").trim();
  }
} catch {}
function routeRow(file, type) {
  const route = routeFromFile(file);
  return { record_id: type + ":" + route + ":" + rel(file), record_type: type, path: route, source_file: rel(file),
    domain: route.split("/").filter(Boolean)[0] || "public-root", source_branch: "working-copy", source_commit: commit,
    implementation_status: "SOURCE_FILE_PRESENT", behavior_status: "UNTESTED", deployment_status: "NOT_VERIFIED",
    requirement_status: "RECONCILE_AGAINST_PRODUCT_DEFINITION",
    notes: type === "PAGE" ? "Page file exists; rendering, auth, data source and production behavior not verified." : "Handler file exists; HTTP methods, auth, persistence and side effects require review." };
}
const routes = pageFiles.map(f => routeRow(f, "PAGE")).concat(handlerFiles.map(f => routeRow(f, "ROUTE_HANDLER")))
  .sort((a,b) => a.path.localeCompare(b.path) || a.source_file.localeCompare(b.source_file));
const nextConfig = fs.existsSync(path.join(root, "next.config.js")) ? fs.readFileSync(path.join(root, "next.config.js"), "utf8") : "";
const vercel = fs.existsSync(path.join(root, "vercel.json")) ? JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")) : {};
const pkg = fs.existsSync(path.join(root, "package.json")) ? JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) : {};
const envPath = path.join(root, ".env.example");
const envKeyNames = fs.existsSync(envPath) ? [...new Set(envKeys(fs.readFileSync(envPath, "utf8")))].sort() : [];
const redirects = [...nextConfig.matchAll(/\{\s*source:\s*['"]([^'"]+)['"],\s*destination:\s*['"]([^'"]+)['"],\s*permanent:\s*(true|false)/g)]
  .map(m => ({ source: m[1], destination: m[2], permanent: m[3] === "true", source_file: "next.config.js", status: "CONFIGURED_NOT_RUNTIME_VERIFIED" }));
const rewrites = [...nextConfig.matchAll(/\{\s*source:\s*['"]([^'"]+)['"],\s*destination:\s*['"]([^'"]+)['"]\s*\}/g)]
  .map(m => ({ source: m[1], destination: m[2], source_file: "next.config.js", status: "REQUIRES_MANUAL_CLASSIFICATION" }));
const cronJobs = (vercel.crons || []).map(c => ({ path: c.path, schedule: c.schedule, source_file: "vercel.json", status: "CONFIGURED_NOT_RUNTIME_VERIFIED" }));
const proxyPath = path.join(root, "src", "proxy.ts");
const proxySource = fs.existsSync(proxyPath) ? fs.readFileSync(proxyPath, "utf8") : "";
function parseProxyArray(name, active = new Set()) {
  if (active.has(name)) return [];
  const next = new Set(active); next.add(name);
  const match = proxySource.match(new RegExp("\\bconst\\s+" + name + "\\s*=\\s*\\[([\\s\\S]*?)\\];"));
  if (!match) return [];
  const values = [];
  const tokenPattern = /"([^"]+)"|'([^']+)'|\.\.\.\s*([A-Z][A-Z0-9_]*)/g;
  let token;
  while ((token = tokenPattern.exec(match[1])) !== null) {
    if (token[3]) values.push(...parseProxyArray(token[3], next));
    else values.push(token[1] ?? token[2]);
  }
  return [...new Set(values)];
}
const proxyRouting = [];
function addProxyRouting(rule_type, pattern, condition, authorization_behavior, notes) {
  proxyRouting.push({
    record_id: "PROXY:" + rule_type + ":" + pattern,
    rule_type, pattern, source_file: "src/proxy.ts", source_branch: "working-copy", source_commit: commit,
    condition, authorization_behavior, behavior_status: "SOURCE_ONLY_NOT_RUNTIME_VERIFIED", notes
  });
}
for (const pattern of parseProxyArray("ALWAYS_PUBLIC")) {
  addProxyRouting("ALWAYS_PUBLIC_ALLOWLIST", pattern,
    "Exact pathname; evaluated after static/API bypass, except auth routes",
    "Proxy allows anonymous page request",
    "Source allowlist entry only; API handlers must enforce their own authorization.");
}
for (const pattern of parseProxyArray("PROTECTED_PREFIXES")) {
  addProxyRouting("PROTECTED_PREFIX", pattern,
    "Exact pathname or pathname starts with prefix plus slash",
    "Session required; unauthenticated requests redirect according to loginPathFor",
    "Proxy gate only; verify API handlers independently for authentication, permission and tenant isolation.");
}
for (const pattern of parseProxyArray("ADMIN_PREFIXES")) {
  addProxyRouting("ADMIN_ROLE_GATE", pattern,
    "Exact pathname or pathname starts with prefix plus slash",
    "Requires role admin, super_admin or internal",
    "Source rule only; validate role access at runtime.");
}
for (const pattern of parseProxyArray("REVIEW_PREFIXES")) {
  addProxyRouting("REVIEW_ROLE_GATE", pattern,
    "Exact pathname or pathname starts with prefix plus slash",
    "Requires role analyst, admin, super_admin or internal",
    "Source rule only; validate role access at runtime.");
}
addProxyRouting("STATIC_API_DOT_BYPASS", "/_next*; /api/*; any pathname containing a dot",
  "isStaticOrApiPath(pathname)",
  "Proxy returns NextResponse.next without its session gate; ATR rewrite also skips these paths",
  "Dotted paths bypass this proxy gate; verify sensitive routes and API handlers have independent server-side authorization.");
addProxyRouting("ATR_HOST_REWRITE", "/*",
  "isAtrManagedHost(host) and path is not static/API",
  "Rewrites pathname using toAtrInternalPath(pathname)",
  "Host-dependent rewrite is source-derived; verify allowed hosts and destinations at runtime.");
addProxyRouting("AUTH_ROUTE_HANDLING", "/login; /client-login; /team-login; /admin-login; /super-admin-login",
  "Exact pathname and isAuthRoute(pathname)",
  "Authenticated session redirects to resolveAccessDestination; anonymous auth page receives portal/protection headers",
  "Test redirects with anonymous and each supported role.");
addProxyRouting("PROTECTED_IDENTITY_HEADERS", "Protected prefixes",
  "After session and role checks",
  "Forwards protected marker, user id/email/role, KYC status, entitlements and optional KYC/portfolio/organization IDs as request headers",
  "Confirm downstream code trusts identity headers only when inserted by this proxy and does not accept spoofed client values.");
addProxyRouting("FALLTHROUGH", "Other page pathnames",
  "No prior matching public, auth or protected rule",
  "NextResponse.next()",
  "Test unmatched page access against the intended route policy.");

const originMap = new Map();
for (const file of files) {
  const relative = rel(file);
  if (relative.startsWith("docs/generated/")) continue;
  if (path.extname(file) && !extensions.has(path.extname(file))) continue;
  let content;
  try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
  const re = /https?:\/\/[A-Za-z0-9._~:%\-]+(?::\d+)?(?:\/[^\s"'<>)]*)?/g;
  for (const m of content.matchAll(re)) {
    const parsed = originOf(m[0]);
    if (!parsed) continue;
    if (!originMap.has(parsed.origin)) originMap.set(parsed.origin, { ...parsed, files: new Set(), count: 0, contexts: new Set() });
    const item = originMap.get(parsed.origin);
    item.files.add(relative); item.count++;
    if (item.contexts.size < 4) item.contexts.add(lineAt(content, m.index));
  }
}
const origins = [...originMap.values()].map(o => ({
  origin: o.origin, hostname: o.hostname, protocol: o.protocol, evidence_files: [...o.files].sort().join(";"),
  evidence_count: o.count, sample_contexts: [...o.contexts].join(" | "), classification: "REVIEW_REQUIRED",
  runtime_status: "NOT_VERIFIED", next_action: "Identify owner, purpose, data class, auth, contract, and safe test."
})).sort((a,b) => a.origin.localeCompare(b.origin));
const inventory = {
  metadata: { generated_at: generatedAt, repository: "support371/gem-enterprise", source_branch: "working-copy", source_commit: commit,
    source_files_scanned: files.length, app_router_page_files: pageFiles.length, app_router_handler_files: handlerFiles.length,
    route_records: routes.length, external_origins: origins.length, env_example_key_names: envKeyNames.length, cron_entries: cronJobs.length, proxy_routing_records: proxyRouting.length,
    safety: "Local source inventory only. No network, deployment, provider calls, write endpoints, DB mutations, or secret values." },
  routes, redirects, rewrites, cron_jobs: cronJobs, proxy_routing: proxyRouting, external_origins: origins, environment_key_names_only: envKeyNames,
  package_scripts: pkg.scripts || {},
  sitemap_note: "Compare explicit sitemap allowlist with the route register; sitemap is not the complete application inventory.",
  verification_fields: ["requirement_status","behavior_status","data_mode","auth_level","provider_dependency","deployment_status","owner","blocker","evidence_link","acceptance_test","rollback_plan"]
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "GEM_ROUTE_INVENTORY.local.json"), JSON.stringify(inventory, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_ROUTE_INVENTORY.local.csv"), csv(routes, ["record_id","record_type","path","source_file","domain","source_branch","source_commit","implementation_status","behavior_status","deployment_status","requirement_status","notes"]), "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_EXTERNAL_ORIGINS.local.csv"), csv(origins, ["origin","hostname","protocol","evidence_files","evidence_count","sample_contexts","classification","runtime_status","next_action"]), "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_REDIRECT_REWRITE_CRON.local.json"), JSON.stringify({ metadata: inventory.metadata, redirects, rewrites, cron_jobs: cronJobs }, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_PROXY_ROUTING.local.csv"), csv(proxyRouting, ["record_id","rule_type","pattern","source_file","source_branch","source_commit","condition","authorization_behavior","behavior_status","notes"]), "utf8");
console.log("GEM local inventory generated.");
console.log("Commit: " + commit);
console.log("Source files scanned: " + files.length);
console.log("Page files: " + pageFiles.length);
console.log("Route-handler files: " + handlerFiles.length);
console.log("External origins to classify: " + origins.length);
console.log(".env.example key names only: " + envKeyNames.length);
console.log("Configured cron entries: " + cronJobs.length);
console.log("Proxy routing/access records: " + proxyRouting.length);
console.log("Outputs: docs/generated/GEM_ROUTE_INVENTORY.local.{json,csv}");
console.log("         docs/generated/GEM_EXTERNAL_ORIGINS.local.csv");
console.log("         docs/generated/GEM_REDIRECT_REWRITE_CRON.local.json");
console.log("         docs/generated/GEM_PROXY_ROUTING.local.csv");
