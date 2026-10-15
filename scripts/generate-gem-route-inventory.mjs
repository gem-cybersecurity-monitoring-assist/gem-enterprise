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
    route_records: routes.length, external_origins: origins.length, env_example_key_names: envKeyNames.length, cron_entries: cronJobs.length,
    safety: "Local source inventory only. No network, deployment, provider calls, write endpoints, DB mutations, or secret values." },
  routes, redirects, rewrites, cron_jobs: cronJobs, external_origins: origins, environment_key_names_only: envKeyNames,
  package_scripts: pkg.scripts || {},
  sitemap_note: "Compare explicit sitemap allowlist with the route register; sitemap is not the complete application inventory.",
  verification_fields: ["requirement_status","behavior_status","data_mode","auth_level","provider_dependency","deployment_status","owner","blocker","evidence_link","acceptance_test","rollback_plan"]
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "GEM_ROUTE_INVENTORY.local.json"), JSON.stringify(inventory, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_ROUTE_INVENTORY.local.csv"), csv(routes, ["record_id","record_type","path","source_file","domain","source_branch","source_commit","implementation_status","behavior_status","deployment_status","requirement_status","notes"]), "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_EXTERNAL_ORIGINS.local.csv"), csv(origins, ["origin","hostname","protocol","evidence_files","evidence_count","sample_contexts","classification","runtime_status","next_action"]), "utf8");
fs.writeFileSync(path.join(outputDir, "GEM_REDIRECT_REWRITE_CRON.local.json"), JSON.stringify({ metadata: inventory.metadata, redirects, rewrites, cron_jobs: cronJobs }, null, 2) + "\n", "utf8");
console.log("GEM local inventory generated.");
console.log("Commit: " + commit);
console.log("Source files scanned: " + files.length);
console.log("Page files: " + pageFiles.length);
console.log("Route-handler files: " + handlerFiles.length);
console.log("External origins to classify: " + origins.length);
console.log(".env.example key names only: " + envKeyNames.length);
console.log("Configured cron entries: " + cronJobs.length);
console.log("Outputs: docs/generated/GEM_ROUTE_INVENTORY.local.{json,csv}");
console.log("         docs/generated/GEM_EXTERNAL_ORIGINS.local.csv");
console.log("         docs/generated/GEM_REDIRECT_REWRITE_CRON.local.json");
