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
    expect(catalog).toContain("ConnectorLogo");
    expect(catalog).toContain("providerLogoUrl");
    expect(catalog).toContain("INITIAL_VISIBLE_CONNECTORS");
  });

  it("keeps project and workspace context on governed destinations", () => {
    const catalog = source("src/components/command-center/WorkspaceIntegrationCatalog.tsx");
    expect(catalog).toContain('params.set("workspace", workspaceId)');
    expect(catalog).toContain('params.set("project", projectId)');
    expect(catalog).toContain("Open governed surface");
    expect(catalog).toContain('item.kind === "GEM_SURFACE"');
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
    expect(page).toContain("...socialProviders.map");
    expect(page).toContain("providerReadiness(provider.state)");
    for (const label of [
      "GitHub source control",
      "Vercel deployment",
      "Cloudflare edge services",
      "Supabase data services",
      "ComfyUI render worker",
      "OBS media bridge",
    ]) {
      expect(page).toContain(label);
    }
  });
});
