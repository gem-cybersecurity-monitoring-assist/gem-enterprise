// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SocialGatewayDiagnostics } from "@/components/social-media/SocialGatewayDiagnostics";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows the setup blocker from a 503 without asking for a secret", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ status: 503, json: async () => ({ state: "SETUP_REQUIRED", message: "The Supabase function requires administrator setup.", rpcCount: null, expectedRpcCount: 14, adapterEnabled: false, livePublishingEnabled: false, checkedAt: "2026-11-15T17:00:00Z" }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<SocialGatewayDiagnostics />);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check gateway connection" }));
  await screen.findByText("SETUP REQUIRED");
  expect(screen.getByText("Adapter flag: off · Live publishing flag: off")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("This result does not grant permission to publish.")).toBeTruthy();
});
it("shows a passing health result while posting flags remain off", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: async () => ({ state: "HEALTHY", message: "Gateway health passed.", rpcCount: 14, expectedRpcCount: 14, adapterEnabled: false, livePublishingEnabled: false, checkedAt: "2026-11-15T17:00:00Z" }) }));
  render(<SocialGatewayDiagnostics />);
  fireEvent.click(screen.getByRole("button", { name: "Check gateway connection" }));
  await screen.findByText("HEALTHY");
  expect(screen.getByText("Database functions: 14 / 14 required")).toBeTruthy();
  expect(screen.getByText("Adapter flag: off · Live publishing flag: off")).toBeTruthy();
});
it("handles owner authorization denial without showing healthy", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403 }));
  render(<SocialGatewayDiagnostics />);
  fireEvent.click(screen.getByRole("button", { name: "Check gateway connection" }));
  await screen.findByText("An active platform owner session is required for this check.");
  expect(screen.queryByText("HEALTHY")).toBeNull();
});
it("cancels an in-flight check on unmount", () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_: string, options: RequestInit) => { signal = options.signal as AbortSignal; return new Promise(() => {}); }));
  const view = render(<SocialGatewayDiagnostics />);
  fireEvent.click(screen.getByRole("button", { name: "Check gateway connection" }));
  expect(signal?.aborted).toBe(false);
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
