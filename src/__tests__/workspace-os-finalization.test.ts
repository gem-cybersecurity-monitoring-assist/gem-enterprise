import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Workspace OS finalization", () => {
  it("adds the full ARIA tab pattern and keyboard navigation from the approved Workspace OS target", () => {
    const directory = source("src/components/workspace/WorkspaceOSModuleDirectory.tsx");
    expect(directory).toContain('role="tablist"');
    expect(directory).toContain('role="tab"');
    expect(directory).toContain('aria-selected={selected}');
    expect(directory).toContain('role="tabpanel"');
    expect(directory).toContain('event.key === "ArrowRight"');
    expect(directory).toContain('event.key === "ArrowLeft"');
    expect(directory).toContain('event.key === "Home"');
    expect(directory).toContain('event.key === "End"');
    expect(directory).toContain('tabIndex={selected ? 0 : -1}');
  });

  it("keeps module search and live result announcements accessible", () => {
    const directory = source("src/components/workspace/WorkspaceOSModuleDirectory.tsx");
    expect(directory).toContain('placeholder="Search modules"');
    expect(directory).toContain('aria-label="Clear module search"');
    expect(directory).toContain('role="status" aria-live="polite"');
  });

  it("uses authoritative setup states instead of presenting unavailable modules as live", () => {
    const directory = source("src/components/workspace/WorkspaceOSModuleDirectory.tsx");
    expect(directory).toContain('module.state === "SETUP_IN_PROGRESS"');
    expect(directory).toContain('The module remains fail-closed until it is activated.');
    expect(directory).toContain('No separate surface activated');
  });

  it("preserves organization workspace controls while adding module wayfinding", () => {
    const operatingSystem = source("src/components/workspace/OrganizationWorkspaceOperatingSystem.tsx");
    expect(operatingSystem).toContain("WorkspaceOSModuleDirectory");
    expect(operatingSystem).toContain('id="workspace-team"');
    expect(operatingSystem).toContain('id="workspace-weekly-reporting"');
    expect(operatingSystem).toContain('/api/workspace/projects');
    expect(operatingSystem).toContain('/api/workspace/members');
    expect(operatingSystem).toContain('/api/workspace/weekly-updates');
    expect(operatingSystem).toContain('role="status" aria-live="polite"');
  });
});
