import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { saasAreaOrder, saasAreaArchitecture } from "@/lib/saasAreaArchitecture";
import { saasCapabilityCatalog } from "@/lib/saasCapabilityCatalog";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("GEM SaaS expanded architecture", () => {
  it("provides five full-size functional divisions backed by the original catalog", () => {
    expect(saasAreaOrder).toEqual(["owner", "operations", "client", "community", "market"]);
    for (const area of saasAreaOrder) {
      const definition = saasAreaArchitecture[area];
      expect(definition.title.length).toBeGreaterThan(8);
      expect(definition.steps).toHaveLength(3);
      expect(saasCapabilityCatalog.some((item) => item.area === area && item.href)).toBe(true);
    }
  });

  it("preserves the original authenticated management center and makes architecture prominent", () => {
    const page = source("src/app/app/command-center/saas/page.tsx");
    expect(page).toContain("SaaS Management Center");
    expect(page).toContain("max-w-[1820px]");
    expect(page).toContain("<SaaSArchitectureDeck />");
    expect(page).toContain("<SaaSManagementWorkspace />");
    expect(page).toContain("<SaaSOperationalSnapshot />");
    expect(page.indexOf("<SaaSArchitectureDeck />")).toBeLessThan(page.indexOf("<SaaSManagementWorkspace />"));
  });

  it("requires real administrator authorization before rendering an area page", () => {
    const page = source("src/app/app/command-center/saas/areas/[area]/page.tsx");
    expect(page).toContain("await requireAdmin()");
    expect(page).toContain("if (!gate.ok)");
    expect(page).toContain("notFound()");
    expect(page).toContain("saasCapabilityCatalog.filter");
    expect(page).toContain("max-w-[1820px]");
    expect(page).toContain('robots: { index: false');
    expect(page).not.toContain("db.$executeRaw");
  });

  it("expands just the SaaS shell without altering other application screens", () => {
    const shell = source("src/app/app/layout.tsx");
    expect(shell).toContain('pathname.startsWith("/app/command-center/saas")');
    expect(shell).toContain('isSaaSSurface ? "p-0" : "p-4 sm:p-6"');
    expect(shell).toContain('"SaaS architecture"');
    expect(shell).toContain('ADMIN_ROLES.has(viewerRole ?? "")');
  });

  it("keeps mobile responsiveness and larger visual cards for tools and market preview", () => {
    const toolbox = source("src/components/command-center/SaaSManagementWorkspace.tsx");
    const preview = source("src/app/app/command-center/saas/market-preview/page.tsx");
    expect(toolbox).toContain("min-h-[190px]");
    expect(toolbox).toContain("min-h-[300px]");
    expect(toolbox).toContain("Search platform modules");
    expect(preview).toContain("max-w-[1820px]");
    expect(preview).toContain("NOT OPEN FOR SALES");
    expect(saasCapabilityCatalog.find((item) => item.id === "subscriptions")?.readiness).toBe("planned");
  });
});
