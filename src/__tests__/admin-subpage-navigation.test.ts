import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adminPortalNavGroups,
  adminPortalNavItems,
  adminPrimaryNavItems,
} from "@/lib/platformNavigation";
import { operationsRegistry } from "@/lib/saasOperationsRegistry";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("enterprise admin sub-page navigation", () => {
  it("keeps every admin destination in one grouped directory without duplicate routes", () => {
    const routes = adminPortalNavItems.map((item) => item.href);
    expect(new Set(routes).size).toBe(routes.length);
    expect(adminPortalNavGroups.map((group) => group.label)).toEqual([
      "Organizations & access",
      "Identity & decisions",
      "Security operations",
      "Operations & evidence",
    ]);
    expect(routes).toEqual(expect.arrayContaining([
      "/app/admin",
      "/app/admin/users",
      "/app/admin/kyc",
      "/app/admin/api",
      "/app/admin/audit",
      "/app/admin/news",
    ]));
  });

  it("keeps the global sidebar compact while the Admin Center owns the full directory", () => {
    expect(adminPrimaryNavItems.length).toBeLessThan(adminPortalNavItems.length);
    expect(adminPrimaryNavItems.map((item) => item.href)).toEqual([
      "/app/admin",
      "/app/admin/organization-reports",
      "/app/admin/workspace-access",
      "/app/admin/sentinel",
      "/app/admin/api",
      "/app/admin/audit",
    ]);
    const appLayout = source("src/app/app/layout.tsx");
    expect(appLayout).toContain("adminPortalNavGroups");
    expect(appLayout).toContain("navigationForRole");
    expect(appLayout).toContain('href === "/app/admin"');
  });

  it("does not expose owner-only workspace tools in the shared switcher for ordinary admins", () => {
    const ownerOnlyRoutes = adminPortalNavItems
      .filter((item) => item.ownerOnly)
      .map((item) => item.href);
    expect(ownerOnlyRoutes).toEqual([
      "/app/admin/workspace-access",
      "/app/admin/plan-workspaces",
      "/app/admin/sentinel",
    ]);
    const navigation = source("src/components/admin/AdminSectionNavigation.tsx");
    expect(navigation).toContain('viewerRole === "super_admin"');
    expect(navigation).toContain("item.ownerOnly");
    expect(adminPortalNavItems.find((item) => item.href === "/app/admin/sentinel")?.ownerOnly).toBe(true);
  });

  it("uses dedicated API domain pages instead of one dense registry table", () => {
    const overview = source("src/app/app/admin/api/page.tsx");
    const domainPage = source("src/app/app/admin/api/[domain]/page.tsx");
    const domains = new Set(operationsRegistry.map((operation) => operation.domain));
    expect(domains.size).toBeGreaterThan(3);
    expect(overview).toContain("/app/admin/api/${domain}");
    expect(overview).not.toContain("<table");
    expect(domainPage).toContain("getOperationsByDomain(domain)");
    expect(domainPage).toContain("isOperationsDomain(domain)");
    expect(domainPage).toContain("notFound()");
    expect(domainPage).toContain('operation.method === "GET"');
  });

  it("keeps every admin page connected through the shared administration layout", () => {
    const layout = source("src/app/app/admin/layout.tsx");
    expect(layout).toContain("<AdminSectionNavigation />");
    expect(layout).toContain("{children}");
  });

  it("removes fabricated operational activity from the Admin Center overview", () => {
    const page = source("src/app/app/admin/page.tsx");
    expect(page).not.toContain("recentEvents");
    expect(page).not.toContain("System Health");
    expect(page).toContain("adminPortalNavGroups");
    expect(page).toContain("/api/admin/stats");
  });
});
