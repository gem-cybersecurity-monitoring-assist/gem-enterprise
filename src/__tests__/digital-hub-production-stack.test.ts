import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  digitalHubEventSchema,
  isAllowedDigitalHubEvent,
} from "@/lib/digital-hub/backend";

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Digital Hub production stack", () => {
  it("enforces event-to-target combinations", () => {
    const referral = digitalHubEventSchema.parse({
      event: "referral_open",
      target: "btcc",
      path: "/digital-hub",
    });
    const wallet = digitalHubEventSchema.parse({
      event: "wallet_connected",
      target: "phantom",
      path: "/digital-hub",
    });
    expect(isAllowedDigitalHubEvent(referral)).toBe(true);
    expect(isAllowedDigitalHubEvent(wallet)).toBe(true);
    expect(
      isAllowedDigitalHubEvent({
        event: "service_open",
        target: "social",
        path: "/digital-hub",
      }),
    ).toBe(true);
    expect(
      isAllowedDigitalHubEvent({
        event: "wallet_disconnected",
        target: "metamask",
        path: "/digital-hub",
      }),
    ).toBe(true);
    expect(
      isAllowedDigitalHubEvent({
        event: "referral_open",
        target: "phantom",
        path: "/digital-hub",
      }),
    ).toBe(false);
  });

  it("persists gateway-backed events without wallet addresses or credentials", () => {
    const backend = source("src/lib/digital-hub/backend.ts");
    const gateway = source("src/lib/supabase-gateway.ts");
    expect(backend).toContain("publicAuditGateway");
    expect(backend).toContain('track("DigitalHubInteraction"');
    expect(backend).toContain('persistence: "vercel_analytics"');
    expect(backend).toContain('resource: "digital_hub"');
    expect(backend).toContain("containsWalletAddress: false");
    expect(backend).toContain("containsCredential: false");
    expect(gateway).toContain('/rest/v1/audit_logs');
    expect(gateway).toContain("PublicAuditGatewayEntry");
  });

  it("requires same-origin requests, bounded payloads, and rate limits", () => {
    const route = source("src/app/api/digital-hub/events/route.ts");
    expect(route).toContain("requireSameOriginSupportRequest");
    expect(route).toContain("PAYLOAD_TOO_LARGE");
    expect(route).toContain("RATE_LIMITED");
    expect(route).toContain("EVENT_PERSISTENCE_UNAVAILABLE");
  });

  it("exposes runtime health and a server-owned referral redirect", () => {
    const health = source("src/app/api/digital-hub/health/route.ts");
    const referral = source("src/app/api/digital-hub/referral/btcc/route.ts");
    expect(health).toContain('service: "gem-digital-hub"');
    expect(health).toContain("interactionPersistence: {");
    expect(health).toContain('fallback: backend === "supabase_gateway" ? "vercel_analytics" : null');
    expect(referral).toContain("NextResponse.redirect");
    expect(referral).toContain('event: "referral_open"');
    const serviceRoute = source("src/app/api/digital-hub/services/[serviceId]/route.ts");
    const walletRoute = source("src/app/api/digital-hub/wallet/route.ts");
    expect(serviceRoute).toContain('event: "service_open"');
    expect(serviceRoute).toContain("getDigitalHubService");
    expect(walletRoute).toContain('mode: "non_custodial_browser_session"');
    expect(walletRoute).toContain("storesWalletAddresses: false");
    const ecosystemRoute = source("src/app/api/digital-hub/ecosystem/route.ts");
    expect(ecosystemRoute).toContain("NEXT_PUBLIC_REOWN_PROJECT_ID");
    expect(ecosystemRoute).toContain("NEXT_PUBLIC_PHANTOM_APP_ID");
    expect(ecosystemRoute).toContain("walletReturnUrl");
    expect(ecosystemRoute).toContain("publicDigitalHubProfiles()");
  });

  it("uses the redesigned layered background and backend status surface", () => {
    const page = source("src/app/digital-hub/page.tsx");
    expect(page).toContain("radial-gradient");
    expect(page).toContain("background-size:64px_64px");
    expect(page).toContain("Digital Hub runtime");
    expect(page).toContain("/api/digital-hub/health");
    expect(page).toContain('/api/digital-hub/referral/btcc');
    expect(page).toContain('/api/digital-hub/services/');
    expect(page).toContain("EcosystemDashboard");
    const ecosystem = source("src/app/digital-hub/EcosystemDashboard.tsx");
    expect(ecosystem).toContain("Real-time preview");
    expect(ecosystem).toContain("Wallet connection dashboard");
    expect(ecosystem).toContain("Existing GEM platform profiles");
    expect(ecosystem).toContain("Open profile");
    expect(ecosystem).toContain("/api/digital-hub/profiles/");
    expect(ecosystem).toContain("/api/digital-hub/market/");
    expect(ecosystem).toContain("/api/digital-hub/community");
    expect(ecosystem).toContain("Open Community Hub");
    expect(ecosystem).toContain("/api/digital-hub/ecosystem");
    const ecosystemConfig = source("src/lib/digital-hub/ecosystem.ts");
    expect(ecosystemConfig).toContain("Farcaster");
    expect(ecosystemConfig).toContain("FOREX.com");
    expect(ecosystemConfig).toContain("profile-present");
    expect(ecosystemConfig).toContain("FARCASTER_PROFILE_URL");
    expect(ecosystemConfig).toContain("FOREX_ACCOUNT_URL");
    expect(ecosystemConfig).toContain("Yahoo Finance");
    expect(ecosystemConfig).toContain("Investopedia");
    expect(ecosystemConfig).toContain("Forbes Web3");
    expect(ecosystemConfig).toContain("Discord");
    expect(ecosystemConfig).toContain("Reddit");
    expect(ecosystemConfig).toContain("Slack");
    const client = source("src/app/digital-hub/DigitalHubClient.tsx");
    expect(client).toContain("eip6963:requestProvider");
    expect(client).toContain("accountsChanged");
    expect(client).toContain("chainChanged");
    expect(client).toContain("Disconnect GEM session");
    expect(client).not.toContain("\\n      <div");
  });
});
