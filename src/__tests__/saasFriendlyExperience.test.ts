import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { saasCapabilityCatalog } from "@/lib/saasCapabilityCatalog";

const source = (path: string) => readFileSync(path, "utf8");

describe("GEM friendly SaaS management redesign", () => {
  it("puts task-first navigation ahead of detailed system reporting", () => {
    const page = source("src/app/app/command-center/saas/page.tsx");
    expect(page).toContain("Your business. One workspace.");
    expect(page.indexOf("<SaaSManagementWorkspace />")).toBeLessThan(page.indexOf("<SaaSOperationalSnapshot />"));
    expect(page).toContain("<details");
    expect(page).toContain("<SaaSAssignedWorkspaces />");
    expect(page).toContain('robots: { index: false');
  });

  it("has accessible task cards, search, category filters and progressive disclosure", () => {
    const ui = source("src/components/command-center/SaaSManagementWorkspace.tsx");
    expect(ui).toContain("Manage clients");
    expect(ui).toContain("Organizations");
    expect(ui).toContain("Review approvals");
    expect(ui).toContain("Service delivery");
    expect(ui).toContain("Content & campaigns");
    expect(ui).toContain("Monitor platform");
    expect(ui).toContain('aria-label="Search platform modules"');
    expect(ui).toContain('aria-pressed={activeArea === id}');
    expect(ui).toContain("setShowAll");
    expect(ui).toContain("setShowTechnical");
    expect(ui).toContain("Clear filters");
    expect(ui).toContain("sm:grid-cols-2 xl:grid-cols-3");
    expect(ui).toContain("focus-visible:outline");
  });

  it("keeps the original authorized APIs and does not create a new mutation path", () => {
    const ui = source("src/components/command-center/SaaSManagementWorkspace.tsx");
    const page = source("src/app/app/command-center/saas/page.tsx");
    expect(ui).toContain('fetch("/api/command-center/saas-capabilities"');
    expect(ui).toContain('credentials: "same-origin"');
    expect(ui).toContain('cache: "no-store"');
    expect(ui).not.toContain('method: "POST"');
    expect(page).toContain("<SaaSAssignedWorkspaces />");
    expect(page).toContain("<SaaSOperationalSnapshot />");
  });

  it("preserves all existing modules and accurately labels planned capabilities", () => {
    expect(saasCapabilityCatalog).toHaveLength(44);
    expect(saasCapabilityCatalog.find((module) => module.id === "subscriptions")?.readiness).toBe("planned");
    expect(saasCapabilityCatalog.find((module) => module.id === "community")?.readiness).toBe("preview-only");
  });
});
