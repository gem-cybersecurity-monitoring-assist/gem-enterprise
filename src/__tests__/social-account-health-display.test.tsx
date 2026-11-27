// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SocialConnectorPanel } from "@/components/social-media/SocialConnectorPanel";
import type { SafeSocialOAuthReadiness } from "@/lib/social-media/oauth/readiness";

const provider: SafeSocialOAuthReadiness = {
  provider: "X", displayName: "X Company", readyToAuthorize: true, missing: [],
  requestedScopes: ["users.read"], pkce: true, accountDiscovery: "PROVIDER_VERIFIED",
  refreshMode: "STANDARD", authorizationFoundationVersion: "2026-07-22.3",
  credentialStoragePolicy: "ENCRYPTED_SERVER_ONLY", authorizationStatePolicy: "SIGNED_SINGLE_USE",
  externalPublishingEnabled: false,
};
const connector = {
  id: "connector-x", workspaceId: "workspace-1", provider: "X", state: "CONNECTED",
  displayName: "Saved X account", externalAccountId: "123", grantedScopes: ["users.read"],
  safeMetadata: { tokenLifecycle: "HEALTHY", expiresAt: "2020-01-01T00:00:00Z", refreshTokenPresent: true },
  lastHealthAt: null, disabledAt: null,
};
function response(payload: unknown) { return { ok: true, json: async () => payload }; }
function setup() {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ connectors: [connector] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<SocialConnectorPanel providers={[provider]} workspaceId="workspace-1" />);
  return fetchMock;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("social account health controls", () => {
  it("distinguishes past expiry from a saved connected record", async () => {
    setup();
    await screen.findByText("Saved state: Connected");
    expect(screen.getByText("Credential lifecycle: Expired — verification or recovery required")).toBeTruthy();
    expect(screen.queryByText("Credential lifecycle: Healthy")).toBeNull();
  });
  it("performs an explicit read-only identity check without rotating credentials", async () => {
    const fetchMock = setup();
    await screen.findByText("Saved X account");
    fetchMock.mockResolvedValueOnce(response({ readOnlyProbe: true, connectorId: "connector-x", healthy: false, checkedAt: "2026-11-27T00:00:00Z" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify identity (read-only)" }));
    await screen.findByText(/Read-only identity check: Failed/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/social-media/connectors/connector-x/test?workspaceId=workspace-1");
    expect(fetchMock.mock.calls[1][1].method).toBeUndefined();
  });
  it("does not rotate a stored credential without confirmation", async () => {
    const fetchMock = setup();
    await screen.findByText("Saved X account");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Check credential health" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects an unrelated connector probe response", async () => {
    const fetchMock = setup();
    await screen.findByText("Saved X account");
    fetchMock.mockResolvedValueOnce(response({ readOnlyProbe: true, connectorId: "wrong", healthy: true, checkedAt: "2026-11-27T00:00:00Z" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify identity (read-only)" }));
    await waitFor(() => expect(screen.getByText("The account identity check returned an invalid result.")).toBeTruthy());
    expect(screen.queryByText(/Read-only identity check: Passed/)).toBeNull();
  });
});
