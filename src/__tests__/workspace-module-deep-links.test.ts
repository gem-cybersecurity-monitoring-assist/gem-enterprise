import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clientWorkspaceModules } from "@/lib/clientWorkspaceCatalog";

const catalogSource = readFileSync("src/lib/clientWorkspaceCatalog.ts", "utf8");
const workspacePageSource = readFileSync("src/app/app/workspace/page.tsx", "utf8");
const readinessSource = readFileSync("src/lib/workspaceModuleReadiness.ts", "utf8");

describe("workspace module deep links and client-safe routing", () => {
  it("never routes client modules into admin-gated command-center surfaces", () => {
    for (const entry of clientWorkspaceModules) {
      expect(entry.href.startsWith("/app/command-center")).toBe(false);
    }
    const integrations = clientWorkspaceModules.find((m) => m.id === "integrations");
    const automations = clientWorkspaceModules.find((m) => m.id === "automations");
    expect(integrations?.href).toBe("/app/social-media/accounts");
    expect(automations?.href).toBe("/app/social-media/autopilot");
  });

  it("keeps service labels organization-neutral", () => {
    expect(catalogSource).not.toContain("ATR Property Trust");
    expect(catalogSource).not.toContain("ATR operations");
  });

  it("builds workspace-preserving deep links for anchor modules", () => {
    expect(workspacePageSource).toContain(
      '`/app/workspace?workspace=${selected.id}${module.href}`',
    );
    expect(workspacePageSource).toContain('module.href.startsWith("#")');
  });

  it("keeps automation readiness fail-closed without claiming a missing route", () => {
    expect(readinessSource).not.toContain("routeExists: false");
    expect(readinessSource).toContain("automations: { setupNeeded: true, setupComplete: () => false }");
    expect(readinessSource).toContain("admin-only command-center routes");
  });
});
