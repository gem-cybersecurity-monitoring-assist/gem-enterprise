import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  homeForRole,
  isRoleAllowedForPortal,
  portalForRole,
} from "@/lib/authPortal";

const source = (path: string) => readFileSync(path, "utf8");

describe("strict role portal isolation", () => {
  it("accepts only the role assigned to each public portal", () => {
    expect(isRoleAllowedForPortal("client", "client")).toBe(true);
    expect(isRoleAllowedForPortal("analyst", "team")).toBe(true);
    expect(isRoleAllowedForPortal("admin", "admin")).toBe(true);
    expect(isRoleAllowedForPortal("internal", "admin")).toBe(true);
    expect(isRoleAllowedForPortal("super_admin", "super_admin")).toBe(true);

    expect(isRoleAllowedForPortal("admin", "client")).toBe(false);
    expect(isRoleAllowedForPortal("client", "admin")).toBe(false);
    expect(isRoleAllowedForPortal("super_admin", "admin")).toBe(false);
    expect(isRoleAllowedForPortal("admin", "super_admin")).toBe(false);
  });

  it("keeps admin and super admin landing centers distinct", () => {
    expect(homeForRole("admin")).toBe("/app/admin");
    expect(homeForRole("internal")).toBe("/app/admin");
    expect(homeForRole("super_admin")).toBe("/app/super-admin");
    expect(portalForRole("admin")).toBe("admin");
    expect(portalForRole("super_admin")).toBe("super_admin");
  });

  it("binds the browser form and server login handler to the selected portal", () => {
    const portal = source("src/components/auth/RoleLoginPortal.tsx");
    const login = source("src/app/api/auth/login/route.ts");

    expect(portal).toContain("password: data.password, portal");
    expect(portal).not.toContain("canUseRequestedDestination");
    expect(login).toContain(
      'portal: z.enum(["client", "team", "admin", "super_admin"])',
    );
    expect(login).toContain("isRoleAllowedForPortal");
    expect(login).toContain("ROLE_PORTAL_MISMATCH");
  });

  it("does not let staff continuation fall through to the client workspace", () => {
    const continuation = source("src/app/access/continue/page.tsx");
    expect(continuation).toContain('if (session.role !== "client")');
    expect(continuation).toContain("redirect(resolveAccessDestination(session))");
  });

  it("routes assigned clients through the workspace directory instead of auto-opening one membership", () => {
    const continuation = source("src/app/access/continue/page.tsx");
    expect(continuation).toContain("workspaceAccess.workspaces.length > 0");
    expect(continuation).toContain('redirect("/app/workspace")');
    expect(continuation).not.toContain('redirect(`/app/workspace?workspace=');
  });

  it("keeps top-level and nested Workspace OS routes client-only", () => {
    const workspace = source("src/app/app/workspace/page.tsx");
    const project = source(
      "src/app/app/workspace/projects/[projectId]/[[...environment]]/page.tsx",
    );

    expect(workspace).toContain('if (gate.session.role !== "client")');
    expect(project).toContain('if (gate.session.role !== "client")');
    expect(workspace).toContain("redirect(resolveAccessDestination(gate.session))");
    expect(project).toContain("redirect(resolveAccessDestination(gate.session))");
  });

  it("restores the reference directory-first navigation model", () => {
    const workspace = source("src/app/app/workspace/page.tsx");
    const directory = source("src/components/workspace/WorkspaceDirectory.tsx");

    expect(workspace).toContain("!requestedWorkspaceId && resolution.workspaces.length > 0");
    expect(workspace).toContain("Manage every service in one flow.");
    expect(workspace).toContain('<WorkspaceDirectory workspaces={resolution.workspaces} />');
    expect(workspace).toContain('href="/app/workspace"');
    expect(workspace).toContain("All workspaces");
    expect(directory).toContain("selectedId?: string | null");
  });

  it("protects the super admin center separately and never leaves its home on the shared admin root", () => {
    const proxy = source("src/proxy.ts");
    expect(proxy).toContain(
      'const SUPER_ADMIN_PREFIXES = ["/app/super-admin"]',
    );
    expect(proxy).toContain('session.role !== "super_admin"');
    expect(proxy).toContain('pathname === "/app/admin" && session.role === "super_admin"');
    expect(proxy).toContain('new URL("/app/super-admin", request.url)');
  });
});
