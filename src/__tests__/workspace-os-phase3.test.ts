import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Workspace OS phase 3 integration surfaces", () => {
  it("preserves governed integration readiness while adding catalogue UX", () => {
    const page = source("src/app/app/command-center/integrations/page.tsx");
    const catalog = source("src/components/command-center/WorkspaceIntegrationCatalog.tsx");
    expect(page).toContain("getSocialMediaProviderReadiness");
    expect(page).toContain("WorkspaceIntegrationCatalog");
    expect(page).toContain("configured provider is not an authorized provider");
    expect(catalog).toContain('placeholder="Search integrations"');
    expect(catalog).toContain('aria-pressed={category===item}');
  });

  it("keeps project and workspace context on governed destinations", () => {
    const catalog = source("src/components/command-center/WorkspaceIntegrationCatalog.tsx");
    expect(catalog).toContain('params.set("workspace", workspaceId)');
    expect(catalog).toContain('params.set("project", projectId)');
    expect(catalog).toContain("Open governed surface");
  });

  it("uses the shared Radix dialog for focus-managed integration details", () => {
    const catalog = source("src/components/command-center/WorkspaceIntegrationCatalog.tsx");
    expect(catalog).toContain("DialogContent");
    expect(catalog).toContain("DialogTitle");
    expect(catalog).toContain("DialogDescription");
  });

  it("represents prototype modules as real GEM surfaces rather than fake state", () => {
    const page = source("src/app/app/command-center/integrations/page.tsx");
    for (const label of [
      "Native News Automation",
      "Social Media Operations",
      "Content and Video Studio",
      "TokMetric",
      "GEM AI Support",
      "GEM Sentinel Intelligence",
    ]) {
      expect(page).toContain(label);
    }
  });

  it("expands the catalogue with governed provider and delivery connectors", () => {
    const page = source("src/app/app/command-center/integrations/page.tsx");
    const registry = source("src/lib/workspaceIntegrationCatalog.ts");
    expect(page).toContain("...socialProviders.map");
    expect(page).toContain("providerReadiness(provider.state)");
    expect(page).toContain("governedIntegrationCatalog.map");
    for (const label of [
      'title: "GitHub"',
      'title: "Vercel"',
      'title: "Cloudflare"',
      'title: "Supabase"',
      'title: "ComfyUI"',
      'title: "OBS Studio"',
    ]) {
      expect(registry).toContain(label);
    }
  });
});
