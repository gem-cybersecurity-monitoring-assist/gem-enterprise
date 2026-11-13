import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizeWorkspacePermissions,
  workspacePermissionCatalog,
} from "@/lib/workspace-access-admin/catalog";

const source = (path: string) => readFileSync(path, "utf8");

const apiSource = source("src/app/api/admin/workspace-access/route.ts");
const pageSource = source("src/app/app/admin/workspace-access/page.tsx");
const componentSource = source("src/components/admin/WorkspaceAccessAdministration.tsx");
const mutationSource = source("src/lib/workspace-access-admin/mutations.ts");
const snapshotSource = source("src/lib/workspace-access-admin/snapshot.ts");

describe("workspace access administration", () => {
  it("is restricted to the platform owner at the page and API boundaries", () => {
    expect(apiSource).toContain("requirePlatformOwner()");
    expect(pageSource).toContain("requirePlatformOwner()");
    expect(apiSource).not.toContain("requireAdmin()");
    expect(pageSource).not.toContain("requireAdmin()");
    expect(pageSource).toContain("/super-admin-login?next=/app/admin/workspace-access");
  });

  it("loads the owner snapshot through the authenticated gateway when Prisma is unavailable", () => {
    expect(pageSource).toContain('gate.session.authSource === "supabase_gateway"');
    expect(pageSource).toContain("getGatewaySessionToken()");
    expect(pageSource).toContain('workspaceGateway<WorkspaceAdministrationSnapshot>(');
    expect(pageSource).toContain('"admin_snapshot"');
  });

  it("requires same-origin, rate-limited, non-cacheable write requests", () => {
    expect(apiSource).toContain('request.headers.get("origin")');
    expect(apiSource).toContain("request.nextUrl.origin");
    expect(apiSource).toContain("SAME_ORIGIN_REQUIRED");
    expect(apiSource).toContain('key: "admin:workspace-access:write"');
    expect(apiSource).toContain("rateLimitedResponse");
    expect(apiSource).toContain('"Cache-Control": "no-store"');
  });

  it("keeps role and membership writes transactional and audited", () => {
    expect(mutationSource.match(/database\.\$transaction/g)?.length).toBe(3);
    expect(mutationSource.match(/tx\.auditLog\.create/g)?.length).toBe(3);
    expect(mutationSource).toContain('action: "admin_action"');
    expect(mutationSource).toContain('resource: "workspace_role"');
    expect(mutationSource).toContain('resource: "workspace_membership"');
    expect(mutationSource).toContain("ipAddress: context.ipAddress");
    expect(mutationSource).toContain("userAgent: context.userAgent");
  });

  it("requires exact workspace and target confirmations plus written reasons", () => {
    expect(mutationSource).toContain("WORKSPACE_CONFIRMATION_MISMATCH");
    expect(mutationSource).toContain("EMAIL_CONFIRMATION_MISMATCH");
    expect(apiSource).toContain("confirmWorkspaceSlug");
    expect(apiSource).toContain("confirmEmail");
    expect(apiSource).toContain("min(12)");
    expect(componentSource).toContain("Confirm target email exactly");
    expect(componentSource).toContain("Confirm workspace slug");
    expect(componentSource).toContain("Written reason");
  });

  it("uses optimistic concurrency and suspension instead of deletion", () => {
    expect(mutationSource).toContain("tx.workspaceMember.updateMany");
    expect(mutationSource).toContain("updatedAt: expectedUpdatedAt");
    expect(mutationSource).toContain("MEMBERSHIP_VERSION_CONFLICT");
    expect(apiSource).toContain('z.enum(["active", "suspended"])');
    expect(mutationSource).not.toContain("workspaceMember.delete");
    expect(componentSource).toContain("suspends the membership");
    expect(componentSource).toContain("does not delete");
  });

  it("does not expose credentials or create access during reads and deployment", () => {
    for (const forbiddenField of [
      "passwordHash",
      "credentialRef",
      "accessToken",
      "refreshToken",
      "apiKey",
    ]) {
      expect(snapshotSource).not.toContain(forbiddenField);
    }
    expect(componentSource).toContain("Human-initiated access only");
    expect(componentSource).toContain("Deployment does not seed roles or assign users");
    expect(componentSource).not.toContain("useEffect(");
    expect(snapshotSource).not.toContain("workspaceMember.create({");
    expect(snapshotSource).not.toContain("role.create({");
  });

  it("limits role permissions to the controlled workspace catalog", () => {
    expect(workspacePermissionCatalog).toHaveLength(13);
    expect(
      workspacePermissionCatalog.every((permission) =>
        ["view", "manage"].includes(permission.action),
      ),
    ).toBe(true);
    expect(
      workspacePermissionCatalog.some((permission) => permission.scope === "workspace"),
    ).toBe(true);
    expect(
      workspacePermissionCatalog.some(
        (permission) => String(permission.scope) === "publishing",
      ),
    ).toBe(false);
    expect(
      workspacePermissionCatalog.some((permission) => String(permission.scope) === "payments"),
    ).toBe(false);
    expect(() =>
      normalizeWorkspacePermissions([{ action: "publish", scope: "publishing" }]),
    ).toThrow(/PERMISSION_NOT_ALLOWED/);
  });

  it("allows connector administration without publishing or wildcard privileges", () => {
    expect(normalizeWorkspacePermissions([{action: "view", scope: "connectors"}, {action: "manage", scope: "connectors"}])).toHaveLength(2);
    expect(() => normalizeWorkspacePermissions([{action: "manage", scope: "*"}])).toThrow(/PERMISSION_NOT_ALLOWED/);
    expect(() => normalizeWorkspacePermissions([{action: "manage", scope: "publishing"}])).toThrow(/PERMISSION_NOT_ALLOWED/);
  });

  it("deduplicates and orders controlled permissions deterministically", () => {
    expect(
      normalizeWorkspacePermissions([
        { action: "view", scope: "workspace" },
        { action: "view", scope: "members" },
        { action: "view", scope: "workspace" },
      ]),
    ).toEqual([
      { action: "view", scope: "members" },
      { action: "view", scope: "workspace" },
    ]);
  });
});
