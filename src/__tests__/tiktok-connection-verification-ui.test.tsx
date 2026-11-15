// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TokMetricConnectorPanel } from "@/components/tokmetric/TokMetricConnectorPanel";
import { TokMetricSetupStatus } from "@/components/tokmetric/TokMetricSetupStatus";

const account = { id: "connector-1", state: "CONNECTED", displayName: "Saved creator", externalAccountId: "account-1", grantedScopes: ["user.info.basic", "video.publish"], lastHealthAt: "2026-11-14T00:00:00Z" };
const connector = { provider: "TIKTOK_CONTENT_POSTING_API", displayName: "TikTok Content Posting API", state: "CONNECTED", requiredScopes: ["user.info.basic", "video.publish"], environment: "production", configurationMissing: [], accounts: [account] };
const fetchMock = vi.fn();
const json = (payload: unknown) => ({ ok: true, json: async () => payload });
const check = (status = "verified", message = "Provider confirmed this account.") => ({ connectorId: account.id, status, message, code: "TEST_RESULT", checkedAt: "2026-11-15T16:00:00Z" });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps failed identity evidence visible in the existing setup-status caller", async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes("/health?")
    ? json({ checks: [check("authorization_required", "TikTok returned a different account.")] })
    : url.includes("/readiness") ? json({ readiness: { livePublishingEnabled: false, workspaces: 1, connectors: [], drafts: 0, approvals: 0, publishJobs: [], analytics: 0, externalTruth: "Posting is disabled." } }) : json({ connectors: [connector] }));
  render(<TokMetricSetupStatus initialTab="connection" />);
  await screen.findByText("Saved creator");
  fireEvent.click(screen.getByRole("button", { name: "Verify connector health" }));
  await screen.findByText("TikTok returned a different account.");
  expect(screen.getByText("Live TikTok identity: Authorization required")).toBeTruthy();
  expect(screen.queryByText("TikTok account identity verified")).toBeNull();
  expect(screen.getByText("BLOCKED — TIKTOK CONNECTION NOT FULLY ACTIVATED")).toBeTruthy();
});

it("clears successful verification when a different workspace is selected", async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes("/health?") ? json({ checks: [check()] }) : json({ connectors: [connector] }));
  render(<TokMetricConnectorPanel />);
  await screen.findByText("Saved creator");
  fireEvent.click(screen.getByRole("button", { name: "Verify TikTok" }));
  await screen.findByText("Live identity: Verified");
  fireEvent.change(screen.getByRole("textbox", { name: "TokMetric workspace ID" }), { target: { value: "workspace-two" } });
  await waitFor(() => expect(screen.queryByText("Live identity: Verified")).toBeNull());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("workspaceId=workspace-two"), expect.anything()));
});

it("ignores a stale non-AbortError after switching workspace", async () => {
  let rejectOld: (error: Error) => void = () => {};
  fetchMock.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; })).mockResolvedValue(json({ connectors: [{ ...connector, accounts: [{ ...account, displayName: "New workspace creator" }] }] }));
  render(<TokMetricConnectorPanel />);
  fireEvent.change(screen.getByRole("textbox", { name: "TokMetric workspace ID" }), { target: { value: "workspace-two" } });
  await screen.findByText("New workspace creator");
  await act(async () => { rejectOld(new Error("Old workspace request failed")); });
  expect(screen.queryByText("Old workspace request failed")).toBeNull();
  expect(screen.getByText("New workspace creator")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Verify TikTok" }).hasAttribute("disabled")).toBe(false);
});

it("aborts pending provider verification on unmount", async () => {
  let verificationSignal: AbortSignal | undefined;
  fetchMock.mockImplementation((url: string, options: RequestInit) => {
    if (url.includes("/health?")) { verificationSignal = options.signal as AbortSignal; return new Promise(() => {}); }
    return Promise.resolve(json({ connectors: [connector] }));
  });
  const view = render(<TokMetricConnectorPanel />);
  await screen.findByText("Saved creator");
  fireEvent.click(screen.getByRole("button", { name: "Verify TikTok" }));
  expect(verificationSignal?.aborted).toBe(false);
  view.unmount();
  expect(verificationSignal?.aborted).toBe(true);
});
