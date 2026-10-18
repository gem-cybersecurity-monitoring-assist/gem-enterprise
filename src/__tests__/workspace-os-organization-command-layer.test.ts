import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Workspace OS organization command layer", () => {
  it("adds searchable organization-level wayfinding without replacing existing operating surfaces", () => {
    const commandLayer = source("src/components/workspace/OrganizationWorkspaceCommandLayer.tsx");
    const operatingSystem = source("src/components/workspace/OrganizationWorkspaceOperatingSystem.tsx");

    expect(operatingSystem).toContain("OrganizationWorkspaceCommandLayer");
    expect(operatingSystem).toContain("WorkspaceOSModuleDirectory");
    expect(operatingSystem).toContain("WorkspaceProjectDirectory");
    expect(operatingSystem).toContain('id="workspace-team"');
    expect(operatingSystem).toContain('id="workspace-weekly-reporting"');
    expect(commandLayer).toContain('event.key === "/"');
    expect(commandLayer).toContain('event.key.toLowerCase() === "k"');
    expect(commandLayer).toContain('aria-haspopup="dialog"');
  });

  it("builds destinations only from authoritative projects, module states, and existing GEM routes", () => {
    const commandLayer = source("src/components/workspace/OrganizationWorkspaceCommandLayer.tsx");

    expect(commandLayer).toContain("projects.map((project)");
    expect(commandLayer).toContain("modules.map((module)");
    expect(commandLayer).toContain('module.state === "AVAILABLE"');
    expect(commandLayer).toContain('module.state === "SETUP_IN_PROGRESS"');
    expect(commandLayer).toContain("The module remains fail-closed.");
    expect(commandLayer).toContain('automations: "/app/ai-services"');
    expect(commandLayer).toContain('integrations: "/app/integrations"');
    expect(commandLayer).toContain('href: scoped("/app/integrations", workspaceId)');
    expect(commandLayer).not.toContain('href: scoped("/app/command-center/integrations", workspaceId)');
    expect(commandLayer).toContain('/app/social-media/video');
    expect(commandLayer).toContain('/app/command-center/integrations/news');
    expect(commandLayer).toContain('/app/support');
  });

  it("preserves membership and permission-controlled organization mutations", () => {
    const operatingSystem = source("src/components/workspace/OrganizationWorkspaceOperatingSystem.tsx");

    expect(operatingSystem).toContain('const permits = (scope: string)');
    expect(operatingSystem).toContain('/api/workspace/projects');
    expect(operatingSystem).toContain('/api/workspace/members');
    expect(operatingSystem).toContain('/api/workspace/weekly-updates');
    expect(operatingSystem).toContain('permits("projects")');
    expect(operatingSystem).toContain('permits("members")');
    expect(operatingSystem).toContain('permits("weekly_updates")');
  });

  it("keeps unavailable modules explicit and does not grant new authority", () => {
    const commandLayer = source("src/components/workspace/OrganizationWorkspaceCommandLayer.tsx");

    expect(commandLayer).toContain("Not activated. The module remains fail-closed.");
    expect(commandLayer).toContain("Workspace setup is in progress; provider and permission gates remain authoritative.");
    expect(commandLayer).toContain("Visibility here never grants a new role, workspace, provider authorization, or entitlement.");
    expect(commandLayer).toContain('role="status" aria-live="polite"');
    expect(commandLayer).toContain("ThemeToggle");
  });
});
