// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TokMetricWorkspacePage } from "@/components/tokmetric/TokMetricWorkspacePage";
vi.mock("@/components/tokmetric/TikTokShopSellerPanel", () => ({ TikTokShopSellerPanel: () => <section>TikTok Shop remains separate</section> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows saved connection and dated live evidence without a contradictory static account table", async () => {
  const connector = { provider: "TIKTOK_CONTENT_POSTING_API", displayName: "TikTok Content Posting API", state: "CONNECTED", requiredScopes: ["user.info.basic", "video.publish"], environment: "production", configurationMissing: [], accounts: [{ id: "saved-1", displayName: "Existing creator", state: "CONNECTED", externalAccountId: "creator-1", grantedScopes: ["user.info.basic", "video.publish"], lastHealthAt: null }] };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/health?") ? { checks: [{ connectorId: "saved-1", status: "verified", message: "Provider identity matched.", checkedAt: "2026-11-15T16:40:36Z" }] } : { connectors: [connector] } })));
  render(<TokMetricWorkspacePage kind="accounts" />);
  await screen.findByText("Existing creator");
  expect(screen.queryByText("AUTHORIZATION_REQUIRED")).toBeNull();
  expect(screen.queryByText("Pre-connection state")).toBeNull();
  expect(screen.queryByText("Next build steps")).toBeNull();
  expect(screen.getByText("Publishing safeguards")).toBeTruthy();
  expect(screen.getByText("Connection review steps")).toBeTruthy();
  expect(screen.getByText("TikTok Shop remains separate")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Verify TikTok" }));
  await screen.findByText("Live identity: Verified");
  expect(screen.getByText("Provider identity matched.")).toBeTruthy();
  expect(screen.getByText("Account identity verification is read-only. Publishing requires separate scopes, platform approval and exact-content approval.")).toBeTruthy();
});
