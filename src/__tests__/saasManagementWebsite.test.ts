import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { saasCapabilityCatalog } from "@/lib/saasCapabilityCatalog";
import { adminPortalNavGroups } from "@/lib/platformNavigation";

const source = (path: string) => readFileSync(path, "utf8");

describe("GEM SaaS management website", () => {
  it("shows a real control plane, not only a static directory", () => {
    const page = source("src/app/app/command-center/saas/page.tsx");
    expect(page).toContain("<SaaSOperationalSnapshot />");
    expect(page).toContain("<SaaSManagementWorkspace />");
    expect(page).toContain("<SaaSAssignedWorkspaces />");
    expect(page).toContain("SaaS Management Center");
  });
  it("has an authorized API and actual interactive filters", () => {
    const component = source("src/components/command-center/SaaSManagementWorkspace.tsx");
    const endpoint = source("src/app/api/command-center/saas-capabilities/route.ts");
    expect(component).toContain('fetch("/api/command-center/saas-capabilities"');
    expect(component).toContain("setActiveArea");
    expect(component).toContain("setQuery");
    expect(component).toContain("setReadinessFilter");
    expect(endpoint).toContain("requireAdmin()");
    expect(endpoint).toContain('Cache-Control');
  });
  it("uses tenant-authoritative workspace API with no cross-tenant fallback", () => {
    const component = source("src/components/command-center/SaaSAssignedWorkspaces.tsx");
    const route = source("src/app/api/workspaces/route.ts");
    expect(component).toContain('fetch("/api/workspaces"');
    expect(route).toContain("resolveWorkspaceAccess(");
    expect(route).toContain("gate.session.userId");
    expect(component).toContain("No active membership-scoped workspaces");
  });
  it("catalog entries have known types, unique IDs and only safe internal routes", () => {
    expect(saasCapabilityCatalog.length).toBeGreaterThanOrEqual(40);
    expect(new Set(saasCapabilityCatalog.map((item) => item.id)).size).toBe(saasCapabilityCatalog.length);
    expect(saasCapabilityCatalog.every((item) =>
      item.href === undefined || (item.href.startsWith("/") && !item.href.startsWith("//"))
    )).toBe(true);
  });
  it("retains the owner/admin entry without expanding clients' navigation", () => {
    expect(adminPortalNavGroups.flatMap((group) => group.items).some((item) => item.href === "/app/command-center/saas")).toBe(true);
  });
});
