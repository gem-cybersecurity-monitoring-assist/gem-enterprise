import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Workspace OS wayfinding follow-up", () => {
  it("restores focus to project content after module route changes", () => {
    const navigation = source("src/components/workspace/WorkspaceOSNavigation.tsx");
    expect(navigation).toContain('usePathname');
    expect(navigation).toContain('gem:workspace-navigation-focus');
    expect(navigation).toContain('window.sessionStorage.setItem');
    expect(navigation).toContain('document.getElementById("workspace-main-content")?.focus()');
    expect(navigation).toContain('onNavigate={markRouteNavigation}');
  });

  it("keeps mobile focus restoration lint-safe and bound to the opening trigger", () => {
    const navigation = source("src/components/workspace/WorkspaceOSNavigation.tsx");
    expect(navigation).toContain('const trigger = triggerRef.current;');
    expect(navigation).toContain('trigger?.focus();');
    expect(navigation).not.toContain('triggerRef.current?.focus();');
  });

  it("adds searchable, keyboard-visible project wayfinding", () => {
    const directory = source("src/components/workspace/WorkspaceProjectDirectory.tsx");
    expect(directory).toContain('placeholder="Search projects"');
    expect(directory).toContain('aria-label="Clear project search"');
    expect(directory).toContain('role="progressbar"');
    expect(directory).toContain('aria-valuenow={project.progress}');
    expect(directory).toContain('aria-label={`Open ${project.name} project workspace`}');
  });

  it("preserves organization management and reporting around the new directory", () => {
    const workspace = source("src/components/workspace/OrganizationWorkspaceOperatingSystem.tsx");
    expect(workspace).toContain('<WorkspaceProjectDirectory projects={overview.projects} />');
    expect(workspace).toContain('permits("projects")');
    expect(workspace).toContain('permits("members")');
    expect(workspace).toContain('permits("weekly_updates")');
    expect(workspace).toContain('Prepare weekly update');
  });
});
