// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SaaSAssignedWorkspaces } from "@/components/command-center/SaaSAssignedWorkspaces";

const workspace = (counts: { members: number | null; connectors: number | null; approvalRecords: number | null }) => ({
  id: "ws-1",
  name: "Verified workspace",
  organization: { id: "org-1", name: "Verified organization" },
  role: { name: "Member" },
  counts,
  controls: {
    globalEmergencyLock: false,
    connectorDisabled: false,
    publishingDisabled: true,
    advertisingDisabled: true,
    shopWriteDisabled: true,
  },
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("displays unknown gateway aggregates without claiming there are zero members", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({
      workspaces: [workspace({ members: null, connectors: null, approvalRecords: null })],
    }),
  }));
  render(<SaaSAssignedWorkspaces />);
  await screen.findByText("Verified workspace");
  expect(screen.getByText("— means this count is not yet verified by the workspace gateway.")).toBeTruthy();
  expect(screen.getAllByText("—")).toHaveLength(3);
  expect(screen.queryByText("0")).toBeNull();
});

it("keeps a legitimately measured zero for the configured direct-data path", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({
      workspaces: [workspace({ members: 0, connectors: 2, approvalRecords: 0 })],
    }),
  }));
  render(<SaaSAssignedWorkspaces />);
  await screen.findByText("Verified workspace");
  expect(screen.getAllByText("0")).toHaveLength(2);
  expect(screen.getByText("2")).toBeTruthy();
  expect(screen.queryByText("— means this count is not yet verified by the workspace gateway.")).toBeNull();
});
