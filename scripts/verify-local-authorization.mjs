#!/usr/bin/env node
// Local-only signed-in authorization check. Seeds synthetic users and records into a
// DISPOSABLE test database, logs in through the real /api/auth/login endpoint, then checks
// role gates, record ownership, session expiry/revocation and anonymous access to non-GET
// API methods. Refuses to run unless the app is on loopback and the database is local and
// its name contains "test".
//
//   POSTGRES_PRISMA_URL=postgresql://...@localhost/gem_authz_test JWT_SECRET=<same as server> \
//   node scripts/verify-local-authorization.mjs --base http://127.0.0.1:3000
//
// Database setup (prisma/migrations cannot build an empty database; see
// docs/GEM_SECURITY_VERIFICATION_20261017.md): create the disposable database, apply
// scripts/verify-local-authorization.supabase-stub.sql, then `prisma db push` a copy of the
// build-promoted schema. SQL-only controls (RLS, triggers, CHECKs) are therefore absent;
// this checks application-layer authorization only. Run `pnpm run build` first so the
// generated Prisma client matches the promoted schema.
//
// Output: docs/generated/GEM_AUTHORIZATION.local.csv (gitignored). Exit 1 on any FAIL.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = new URL(option("--base", "http://127.0.0.1:3000"));
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  console.error(`Refusing ${base.origin}: only loopback servers are allowed.`);
  process.exit(2);
}
const dbUrl = process.env.POSTGRES_PRISMA_URL || "";
let dbOk = false;
try {
  const u = new URL(dbUrl);
  const socketHost = u.searchParams.get("host") || "";
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || socketHost.startsWith("/");
  dbOk = local && /test/i.test(u.pathname.slice(1));
} catch {}
if (!dbOk) {
  console.error("Refusing to seed: POSTGRES_PRISMA_URL must point at a local database whose name contains 'test'.");
  process.exit(2);
}
if ((process.env.JWT_SECRET || "").length < 32) {
  console.error("JWT_SECRET (same value as the server under test, >= 32 chars) is required to mint negative-case tokens.");
  process.exit(2);
}

const db = new PrismaClient();
const run = crypto.randomBytes(4).toString("hex");
const rows = [];
const origin = base.origin;

function record(group, name, actual, expected, detail = "") {
  const pass = expected.includes(actual);
  rows.push({ group, name, expected: expected.join("|"), actual, verdict: pass ? "PASS" : "FAIL", detail });
}

async function call(method, urlPath, { cookie, body, headers = {} } = {}) {
  const init = { method, redirect: "manual", headers: { accept: "application/json", ...headers } };
  if (cookie) init.headers.cookie = `gem_session=${cookie}`;
  if (method !== "GET" && method !== "HEAD") {
    init.headers.origin = origin;
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body ?? {});
  }
  try {
    const res = await fetch(new URL(urlPath, base), { ...init, signal: AbortSignal.timeout(20000) });
    const text = await res.text().catch(() => "");
    return { status: res.status, location: res.headers.get("location") || "", text, setCookie: res.headers.get("set-cookie") || "" };
  } catch (error) {
    return { status: 0, location: "", text: String(error.message), setCookie: "" };
  }
}
const locPath = (r) => (r.location ? new URL(r.location, base).pathname : "");

// ---- seed synthetic users and records -------------------------------------------------
const roles = {
  clientA: { role: "client", organizationId: `org-a-${run}` },
  clientB: { role: "client", organizationId: `org-b-${run}` },
  analyst: { role: "analyst" },
  admin: { role: "admin" },
  superAdmin: { role: "super_admin" },
  suspended: { role: "client", status: "suspended" },
};
const users = {};
for (const [key, spec] of Object.entries(roles)) {
  const password = crypto.randomBytes(12).toString("base64url");
  const user = await db.user.create({
    data: {
      email: `${key.toLowerCase()}-${run}@example.test`,
      passwordHash: await bcrypt.hash(password, 10),
      role: spec.role,
      status: spec.status ?? "active",
      organizationId: spec.organizationId ?? null,
      isActive: true,
      isEmailVerified: true,
    },
  });
  users[key] = { ...user, password };
}
const ticketA = await db.supportTicket.create({ data: { userId: users.clientA.id, subject: "Synthetic ticket", description: "Synthetic authorization test record" } });
const keyA = await db.apiKey.create({ data: { userId: users.clientA.id, keyHash: crypto.randomBytes(32).toString("hex"), keyPrefix: "gem_test", label: "synthetic" } });
const notifA = await db.notification.create({ data: { userId: users.clientA.id, title: "Synthetic", body: "Synthetic notification" } });
const meetingA = await db.meetingRequest.create({ data: { requesterId: users.clientA.id, topic: "Synthetic meeting", proposedAt: new Date(Date.now() + 86400000) } });

async function login(key) {
  const r = await call("POST", "/api/auth/login", { body: { email: users[key].email, password: users[key].password } });
  const token = r.setCookie.match(/gem_session=([^;]+)/)?.[1] || "";
  return { status: r.status, token };
}
const s = {};
for (const key of ["clientA", "clientB", "analyst", "admin", "superAdmin"]) {
  const r = await login(key);
  record("login", `${key} logs in`, r.status, [200], r.token ? "cookie issued" : "no cookie");
  s[key] = r.token;
}
record("login", "suspended account cannot log in", (await login("suspended")).status, [403]);
record("login", "wrong password rejected", (await call("POST", "/api/auth/login", { body: { email: users.clientA.email, password: "wrong-password-123" } })).status, [401]);

// ---- role gates ----------------------------------------------------------------------
for (const urlPath of ["/api/admin/users", "/api/admin/stats"]) {
  record("role", `${urlPath} anonymous`, (await call("GET", urlPath)).status, [401]);
  record("role", `${urlPath} client`, (await call("GET", urlPath, { cookie: s.clientA })).status, [403]);
  record("role", `${urlPath} analyst`, (await call("GET", urlPath, { cookie: s.analyst })).status, [403]);
  record("role", `${urlPath} admin`, (await call("GET", urlPath, { cookie: s.admin })).status, [200]);
  record("role", `${urlPath} super_admin`, (await call("GET", urlPath, { cookie: s.superAdmin })).status, [200]);
}
const missingRequest = `/api/admin/requests/missing-${run}`;
record("role", "staff request detail: client", (await call("GET", missingRequest, { cookie: s.clientA })).status, [403]);
record("role", "staff request detail: analyst passes gate", (await call("GET", missingRequest, { cookie: s.analyst })).status, [404]);
{
  const r = await call("GET", "/app/admin", { cookie: s.clientA });
  record("role", "page /app/admin as client redirects to dashboard", `${r.status} ${locPath(r)}`, ["307 /app/dashboard"]);
  record("role", "page /app/admin as admin renders", (await call("GET", "/app/admin", { cookie: s.admin })).status, [200]);
  const rv = await call("GET", "/review", { cookie: s.clientA });
  record("role", "page /review as client redirects to dashboard", `${rv.status} ${locPath(rv)}`, ["307 /app/dashboard"]);
}
record("role", "bootstrap-status full detail: client gets minimal", JSON.parse((await call("GET", "/api/system/bootstrap-status", { cookie: s.clientA })).text || "{}").detailsRequireAdministrator === true ? "minimal" : "full", ["minimal"]);
record("role", "bootstrap-status full detail: admin gets full", JSON.parse((await call("GET", "/api/system/bootstrap-status", { cookie: s.admin })).text || "{}").deployment ? "full" : "minimal", ["full"]);

// ---- record ownership ----------------------------------------------------------------
const ticketPath = `/api/support/tickets/${ticketA.id}/messages`;
record("ownership", "ticket messages: owner reads", (await call("GET", ticketPath, { cookie: s.clientA })).status, [200]);
record("ownership", "ticket messages: other client reads", (await call("GET", ticketPath, { cookie: s.clientB })).status, [403, 404]);
record("ownership", "ticket messages: anonymous reads", (await call("GET", ticketPath)).status, [401]);
record("ownership", "ticket messages: admin reads", (await call("GET", ticketPath, { cookie: s.admin })).status, [200]);
record("ownership", "ticket messages: other client posts", (await call("POST", ticketPath, { cookie: s.clientB, body: { message: "intrusion" } })).status, [403, 404]);

const keyPath = `/api/developers/keys/${keyA.id}`;
record("ownership", "api key: other client revokes", (await call("DELETE", keyPath, { cookie: s.clientB })).status, [403, 404]);
record("ownership", "api key still active after foreign revoke", (await db.apiKey.findUnique({ where: { id: keyA.id } })).revokedAt ? "revoked" : "active", ["active"]);
record("ownership", "api key: owner revokes", (await call("DELETE", keyPath, { cookie: s.clientA })).status, [200]);

const meetingPath = `/api/meetings/${meetingA.id}`;
record("ownership", "meeting: other client cancels", (await call("PATCH", meetingPath, { cookie: s.clientB, body: { status: "CANCELLED" } })).status, [403, 404]);
record("ownership", "meeting unchanged after foreign cancel", (await db.meetingRequest.findUnique({ where: { id: meetingA.id } })).status, ["REQUESTED"]);

await call("PATCH", "/api/notifications", { cookie: s.clientB, body: { ids: [notifA.id] } });
record("ownership", "notification: other client cannot mark read", (await db.notification.findUnique({ where: { id: notifA.id } })).isRead ? "read" : "unread", ["unread"]);

// ---- session expiry and revocation ---------------------------------------------------
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const claims = { userId: users.clientA.id, email: users.clientA.email, role: "client", kycStatus: "not_started", entitlements: [], sessionVersion: 0, authSource: "local" };
const mint = (exp, { key = secret, aud = "gem-client" } = {}) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(exp).setIssuer("gem-enterprise").setAudience(aud).setJti(crypto.randomUUID()).sign(key);
const tokens = {
  expired: await mint(Math.floor(Date.now() / 1000) - 60),
  badSignature: await mint("1h", { key: new TextEncoder().encode("x".repeat(40)) }),
  wrongAudience: await mint("1h", { aud: "someone-else" }),
  forgedAdminRole: await new SignJWT({ ...claims, role: "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").setIssuer("gem-enterprise").setAudience("gem-client").sign(secret),
};
for (const [name, token] of Object.entries(tokens).filter(([n]) => n !== "forgedAdminRole")) {
  record("session", `${name} token: requireSession route`, (await call("GET", "/api/requests", { cookie: token })).status, [401]);
  record("session", `${name} token: getSession route`, (await call("GET", "/api/notifications", { cookie: token })).status, [401]);
  const p = await call("GET", "/app/dashboard", { cookie: token });
  record("session", `${name} token: protected page`, `${p.status} ${locPath(p)}`, ["307 /client-login"]);
}
record("session", "validly signed token claiming admin, DB role client", (await call("GET", "/api/admin/users", { cookie: tokens.forgedAdminRole })).status, [401, 403]);

const revoked = (await login("clientA")).token;
await db.user.update({ where: { id: users.clientA.id }, data: { sessionVersion: { increment: 1 } } });
record("session", "revoked (sessionVersion bumped): requireSession route", (await call("GET", "/api/requests", { cookie: revoked })).status, [401]);
record("session", "revoked: getSession route", (await call("GET", "/api/notifications", { cookie: revoked })).status, [401]);
{
  const p = await call("GET", "/app/dashboard", { cookie: revoked });
  record("session", "revoked: protected page", `${p.status} ${locPath(p)}`, ["307 /client-login"]);
}
await db.user.update({ where: { id: users.admin.id }, data: { status: "suspended" } });
record("session", "admin suspended after login: admin API", (await call("GET", "/api/admin/users", { cookie: s.admin })).status, [401, 403]);
record("session", "admin suspended after login: getSession route", (await call("GET", "/api/notifications", { cookie: s.admin })).status, [401]);
await db.user.update({ where: { id: users.superAdmin.id }, data: { role: "client" } });
record("session", "super_admin downgraded to client after login: admin API", (await call("GET", "/api/admin/users", { cookie: s.superAdmin })).status, [401, 403]);

// ---- anonymous and client access to non-GET API methods --------------------------------
// Handlers that validate the body shape before delegating to an authenticated gateway:
// a well-formed body must still be refused without a session.
const wellFormed = [
  ["POST", "/api/tokmetric/gpt-credentials", { action: "issue", label: "synthetic", reason: "synthetic", expiresInDays: 1 }],
  ["POST", "/api/verify/evidence/operations", { action: "approve_operations" }],
  ["POST", `/api/verify/evidence/retention-policies/authz-${run}/action`, { action: "approve", reason: "synthetic" }],
];
// Their empty-body probe may answer 400 (validation first); the well-formed pass proves auth.
const validatesBeforeAuth = new Set(wellFormed.map(([, p]) => p.replace(`authz-${run}`, ":id")));
const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs", "generated", "GEM_ROUTE_INVENTORY.local.json"), "utf8"));
// Public, token-gated or shared-secret machine endpoints: recorded for review, not judged here.
const publicWrite = /^\/(functions\/|api\/(auth\/(login|logout|forgot-password|reset-password|(operator|workspace)-invitation\/(accept|status))|admin-access|market\/(checkout|stripe\/webhook)|contact|intake\/|newsletter|communications\/unsubscribe|booking\/create|ticket\/create|tiktok\/oauth|social-media\/(oauth|orchestrator)|tokmetric\/(shop\/)?oauth|v1\/ads-bridge|video\/(worker|uploads\/verify)|internal\/|cron\/|webhooks?\/|facebook\/|verify\/applications))/;
const RETIRED = 410;
for (const route of inventory.routes.filter((r) => r.record_type === "ROUTE_HANDLER")) {
  const src = fs.readFileSync(path.join(root, route.source_file), "utf8");
  const methods = ["POST", "PUT", "PATCH", "DELETE"].filter((m) => new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`).test(src));
  const urlPath = route.path.replace(/\/\*$/, "").replace(/:[A-Za-z0-9_]+/g, `authz-${run}`);
  for (const method of methods) {
    const anon = await call(method, urlPath);
    const expected = publicWrite.test(urlPath) ? [anon.status] : [401, 403, RETIRED, ...(validatesBeforeAuth.has(route.path) ? [400] : [])];
    record(publicWrite.test(urlPath) ? "methods-public-or-secret" : "methods-anonymous", `${method} ${route.path}`, anon.status, expected, anon.status >= 200 && anon.status < 300 ? "ACCEPTED_ANONYMOUSLY" : "");
    if (/^\/api\/(admin|v1\/admin)\//.test(route.path)) {
      record("methods-client-on-admin", `${method} ${route.path}`, (await call(method, urlPath, { cookie: s.clientB })).status, [403, RETIRED]);
    }
  }
}

for (const [method, urlPath, body] of wellFormed) {
  record("methods-wellformed-anonymous", `${method} ${urlPath.replace(`authz-${run}`, ":id")}`, (await call(method, urlPath, { body })).status, [401, 403]);
  record("methods-wellformed-client", `${method} ${urlPath.replace(`authz-${run}`, ":id")}`, (await call(method, urlPath, { body, cookie: s.clientB })).status, [401, 403]);
}

await db.$disconnect();
const cols = ["group", "name", "expected", "actual", "verdict", "detail"];
const cell = (v) => {
  const t = String(v ?? "");
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const out = path.join(root, "docs", "generated", "GEM_AUTHORIZATION.local.csv");
fs.writeFileSync(out, [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n");
const tally = {};
for (const r of rows) tally[`${r.group} ${r.verdict}`] = (tally[`${r.group} ${r.verdict}`] || 0) + 1;
console.log(`GEM local authorization check against ${base.origin} (run ${run})`);
for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k}: ${v}`);
for (const r of rows.filter((x) => x.verdict === "FAIL")) console.log(`  FAIL [${r.group}] ${r.name}: expected ${r.expected}, got ${r.actual} ${r.detail}`);
for (const r of rows.filter((x) => x.detail === "ACCEPTED_ANONYMOUSLY")) console.log(`  NOTE anonymous ${r.name} -> ${r.actual}`);
console.log(`Output: ${path.relative(root, out)}`);
process.exit(rows.some((r) => r.verdict === "FAIL") ? 1 : 0);
