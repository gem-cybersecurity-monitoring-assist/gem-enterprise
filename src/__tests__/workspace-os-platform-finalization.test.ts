import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalRoutes } from "@/lib/siteRoutes";
import { governedIntegrationCatalog } from "@/lib/workspaceIntegrationCatalog";

const source = (path: string) => readFileSync(path, "utf8");

describe("Workspace OS platform finalization", () => {
  it("keeps every Workspace OS module connected to a real or governed destination", () => {
    const directory = source("src/components/workspace/WorkspaceOSModuleDirectory.tsx");
    for (const moduleId of [
      "projects",
      "team",
      "weekly_updates",
      "requests",
      "documents",
      "reports",
      "automations",
      "integrations",
    ]) {
      expect(directory).toContain(`${moduleId}: { href:`);
    }
    expect(directory).toContain('automations: { href: "/app/ai-services"');
    expect(directory).toContain('integrations: { href: "/app/integrations"');
  });

  it("provides a protected and role-aware AI service directory", () => {
    const page = source("src/app/app/ai-services/page.tsx");
    const navigation = source("src/lib/platformNavigation.ts");
    const routes = new Set(canonicalRoutes.map((route) => route.path));

    expect(page).toContain("await requireSession()");
    expect(page).toContain("STAFF_ROLES.has(gate.session.role)");
    expect(page).toContain("Administrator access required");
    expect(page).toContain("GEM AI Concierge");
    expect(page).toContain("AI Content & Video Studio");
    expect(navigation).toContain('href: "/app/ai-services"');
    expect(routes.has("/app/ai-services")).toBe(true);
  });

  it("exposes a broad governed connector registry without claiming authorization", () => {
    expect(governedIntegrationCatalog.length).toBeGreaterThanOrEqual(18);
    expect(new Set(governedIntegrationCatalog.map((integration) => integration.slug)).size)
      .toBe(governedIntegrationCatalog.length);

    const required = [
      "github",
      "vercel",
      "cloudflare",
      "supabase",
      "openai",
      "hugging-face",
      "base44",
      "pinokio",
      "comfyui",
      "obs",
      "google-workspace",
      "zoom",
      "hubspot",
      "stripe",
      "figma",
      "notion",
      "posthog",
      "dropbox",
    ];
    expect(required.every((slug) => governedIntegrationCatalog.some((item) => item.slug === slug))).toBe(true);

    for (const integration of governedIntegrationCatalog) {
      expect(integration.operationalHref.startsWith("/")).toBe(true);
      expect(integration.capabilities.length).toBeGreaterThan(0);
      expect(integration.activationRequirements.length).toBeGreaterThan(0);
      expect(["READY", "PARTIAL", "HUMAN_REQUIRED", "BLOCKED"]).toContain(integration.readiness);
    }
  });

  it("uses the governed connector registry in the command center and provides detail routes", () => {
    const catalogPage = source("src/app/app/command-center/integrations/page.tsx");
    const workspaceCatalogPage = source("src/app/app/integrations/page.tsx");
    const detailPage = source("src/app/app/command-center/integrations/catalog/[connector]/page.tsx");

    expect(catalogPage).toContain("governedIntegrationCatalog.map");
    expect(catalogPage).toContain("/app/command-center/integrations/catalog/${integration.slug}");
    expect(detailPage).toContain("generateStaticParams");
    expect(detailPage).toContain("governedIntegrationBySlug");
    expect(detailPage).toContain("Activation requirements");
    expect(detailPage).toContain("Opening an operating surface does not bypass provider authorization");
    expect(workspaceCatalogPage).toContain("governedIntegrationCatalog.map");
    expect(workspaceCatalogPage).toContain("read-only and never grants an external account or OAuth scope");
  });

  it("keeps the latest Workspace OS command layer on member-safe destinations", () => {
    const commands = source("src/components/workspace/WorkspaceOSCommandLayer.tsx");
    const organizationCommands = source("src/components/workspace/OrganizationWorkspaceCommandLayer.tsx");
    expect(commands).toContain('label: "Workspace integrations"');
    expect(commands).toContain('appendScope("/app/integrations", workspaceId, projectId)');
    expect(commands).not.toContain('appendScope("/app/command-center/integrations", workspaceId, projectId)');
    expect(organizationCommands).toContain('automations: "/app/ai-services"');
    expect(organizationCommands).toContain('integrations: "/app/integrations"');
    expect(organizationCommands).toContain('href: scoped("/app/integrations", workspaceId)');
    expect(organizationCommands).not.toContain('href: scoped("/app/command-center/integrations", workspaceId)');
  });
});
