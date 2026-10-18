// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectWorkspaceModuleSurfaces } from "@/components/workspace/ProjectWorkspaceModuleSurfaces";

const baseProps = {
  workspaceId: "workspace-1",
  projectId: "project-1",
  connectors: [],
  approvalCount: 2,
  globalEmergencyLock: false,
  publishingDisabled: true,
  advertisingDisabled: false,
  shopWriteDisabled: false,
  connectorDisabled: false,
};

describe("Workspace OS authoritative project surfaces", () => {
  it("shows persisted connector records in the project tools catalogue", () => {
    render(
      <ProjectWorkspaceModuleSurfaces
        {...baseProps}
        environment="tools"
        connectors={[{
          id: "connector-1",
          provider: "TIKTOK_CONTENT_POSTING",
          state: "CONNECTED",
          displayName: "GEM TikTok",
          externalAccountId: "account-1",
          disabledAt: null,
          lastHealthAt: new Date("2026-08-20T12:00:00Z"),
        }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Governed integration catalogue" })).toBeTruthy();
    expect(screen.getByText("GEM TikTok")).toBeTruthy();
    expect(screen.getByText("CONNECTED")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Workspace integration catalogue/ }).getAttribute("href"))
      .toContain("workspace=workspace-1&project=project-1");
  });

  it("keeps an empty connector catalogue explicitly fail closed", () => {
    render(<ProjectWorkspaceModuleSurfaces {...baseProps} environment="tools" />);
    expect(screen.getByRole("status").textContent).toContain("No connector record is configured");
  });

  it("renders GEM Sentinel from authoritative workspace controls", () => {
    render(<ProjectWorkspaceModuleSurfaces {...baseProps} environment="monitoring" />);
    expect(screen.getByRole("heading", { name: /Workspace readiness and threat-control surface/ })).toBeTruthy();
    expect(screen.getByText("Global emergency lock")).toBeTruthy();
    expect(screen.getByText("External publishing")).toBeTruthy();
    expect(screen.getByText("DISABLED")).toBeTruthy();
    expect(screen.getByText("2 approvals · 0/0 connectors connected")).toBeTruthy();
  });
});
