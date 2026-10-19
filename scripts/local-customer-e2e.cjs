// Disposable local fixtures only. Never point this harness at production.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const base = new URL(process.env.GEM_E2E_BASE_URL || "http://localhost:3000");
const database = new URL(process.env.GEM_E2E_DATABASE_URL || "postgresql://gem_dev@127.0.0.1:55432/gem_development");
const loopback = new Set(["localhost", "127.0.0.1"]);
assert.ok(loopback.has(base.hostname) && loopback.has(database.hostname), "Only loopback services are permitted");
assert.ok(database.pathname === "/gem_development" || database.pathname.startsWith("/gem_e2e_"), "A disposable development database is required");
const db = new PrismaClient({ datasources: { db: { url: database.toString() } } });
const run = `e2e-${randomBytes(8).toString("hex")}`;
const users = [], organizations = [], workspaces = [], roles = [];
let checks = 0;
async function call(path, cookie, method = "GET", data, expected = 200) {
  const response = await fetch(new URL(path, base), {
    method, redirect: "manual",
    headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: base.origin, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.equal(response.status, expected, `${method} ${path} status`);
  checks += 1;
  return { body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function user(name, role = "client") {
  const password = randomBytes(32).toString("hex");
  const fixture = await db.user.create({ data: {
    email: `${run}-${name}@example.invalid`, role, isEmailVerified: true,
    passwordHash: await bcrypt.hash(password, 12),
  } });
  users.push(fixture.id);
  const login = await call("/api/auth/login", null, "POST", { email: fixture.email, password });
  assert.ok(login.cookie?.startsWith("gem_session="));
  return { ...fixture, cookie: login.cookie };
}
async function workspace(name) {
  const org = await db.organization.create({ data: { name: `${run}-${name}`, slug: `${run}-${name}` } });
  organizations.push(org.id);
  const ws = await db.workspace.create({ data: { organizationId: org.id, name, slug: name } });
  workspaces.push(ws.id);
  const role = await db.role.create({ data: { workspaceId: ws.id, name: "e2e-manager", permissions: { create: [
    { action: "manage", scope: "projects" }, { action: "manage", scope: "weekly_updates" },
  ] } } });
  roles.push(role.id);
  return { ...ws, roleId: role.id };
}

(async () => {
  try {
    const customer = await user("customer");
    const outsider = await user("outsider");
    const reviewer = await user("reviewer");
    const staff = await user("staff", "analyst");
    const a = await workspace("tenant-a"), b = await workspace("tenant-b");
    await db.workspaceMember.createMany({ data: [
      { workspaceId: a.id, userId: customer.id, roleId: a.roleId },
      { workspaceId: a.id, userId: reviewer.id, roleId: a.roleId },
      { workspaceId: b.id, userId: outsider.id, roleId: b.roleId },
    ] });
    await call("/api/auth/session", null, "GET", null, 401);
    await call("/api/admin/requests", customer.cookie, "GET", null, 403);
    const created = await call("/api/requests", customer.cookie, "POST", {
      workspaceId: a.id, type: "support", subject: "Local fixture request", description: "Please review this disposable development request.",
    }, 201);
    const request = created.body.request;
    const center = await call(`/api/requests?workspaceId=${a.id}`, customer.cookie);
    assert.ok(center.body.requests.some(item => item.id === request.id));
    await call(`/api/requests?workspaceId=${a.id}`, outsider.cookie, "GET", null, 403);
    const other = await call(`/api/requests?workspaceId=${b.id}`, outsider.cookie);
    assert.ok(!other.body.requests.some(item => item.id === request.id));
    for (const origin of [null, "https://untrusted.example.invalid"]) {
      const rejected = await fetch(new URL(`/api/admin/requests/${request.id}`, base), {
        method: "PATCH", headers: { Cookie: staff.cookie, "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
        body: JSON.stringify({ action: "transition", toStatus: "in_progress" }),
      });
      assert.equal(rejected.status, 403, "Staff mutations require a same-origin request"); checks += 1;
    }
    await call(`/api/admin/requests/${request.id}`, staff.cookie, "PATCH", { action: "assign", assigneeUserId: staff.id });
    await call(`/api/admin/requests/${request.id}`, staff.cookie, "PATCH", { action: "transition", toStatus: "in_progress" });
    await call(`/api/admin/requests/${request.id}`, staff.cookie, "PATCH", { action: "transition", toStatus: "completed", note: "Completed disposable validation." });
    const closed = await db.serviceRequest.findUnique({ where: { id: request.id } });
    assert.equal(closed.status, "completed"); assert.ok(closed.resolvedAt);
    const project = await call("/api/workspace/projects", customer.cookie, "POST", { workspaceId: a.id, name: "Local fixture project", summary: "Disposable project for end-to-end validation." }, 201);
    await call("/api/workspace/projects", outsider.cookie, "POST", { workspaceId: a.id, name: "Unauthorized project", summary: "This creation must be rejected by workspace authorization." }, 403);
    const update = await call("/api/workspace/weekly-updates", customer.cookie, "POST", {
      workspaceId: a.id, projectId: project.body.project.id, weekEnding: "2026-10-03",
      accomplishments: "Completed development checks.", inProgress: "Reviewing remaining evidence.", nextPriorities: "Keep production features gated.", submit: true,
    }, 201);
    const review = { updateId: update.body.update.id, workspaceId: a.id, decision: "APPROVED", reviewNote: "Reviewed disposable evidence." };
    await call("/api/workspace/weekly-updates", customer.cookie, "PATCH", review, 403);
    await call("/api/workspace/weekly-updates", outsider.cookie, "PATCH", review, 403);
    await call("/api/workspace/weekly-updates", reviewer.cookie, "PATCH", review);
    const reviewed = await db.workspaceWeeklyUpdate.findUnique({ where: { id: review.updateId } });
    assert.equal(reviewed.status, "APPROVED"); assert.equal(reviewed.reviewedById, reviewer.id);
    assert.ok(await db.auditLog.count({ where: { userId: { in: users }, resourceId: request.id } }));
    await db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: a.id, userId: customer.id } }, data: { status: "suspended" } });
    await call(`/api/requests?workspaceId=${a.id}`, customer.cookie, "GET", null, 403);
    await db.user.update({ where: { id: customer.id }, data: { sessionVersion: { increment: 1 } } });
    await call("/api/auth/session", customer.cookie, "GET", null, 401);
    console.log(`PASS ${checks} HTTP checks: tenant isolation, staff assignment/closure, project delivery, independent review, audit persistence and revoked access`);
  } finally {
    await db.workspaceWeeklyUpdate.deleteMany({ where: { workspaceId: { in: workspaces } } });
    await db.serviceRequest.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { userId: { in: users } } });
    await db.organization.deleteMany({ where: { id: { in: organizations } } });
    await db.role.deleteMany({ where: { id: { in: roles } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
