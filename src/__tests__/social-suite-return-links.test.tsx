import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/app/social-media/settings/page";
import OverviewPage from "@/app/app/social-media/page";
import CampaignsPage from "@/app/app/social-media/campaigns/page";
import CalendarPage from "@/app/app/social-media/calendar/page";
import VideoPage from "@/app/app/social-media/video/page";
import ContentPage from "@/app/app/social-media/content/page";

vi.mock("@/lib/social-media/providers", () => ({ getSocialMediaProviderReadiness: () => [] }));
vi.mock("@/lib/supabase-gateway", () => ({ shouldUseSupabaseGateway: () => false }));
vi.mock("@/lib/social-media/backend-readiness", () => ({ getSocialBackendReadiness: () => ({ state: "BLOCKED_GATEWAY_BACKEND", explanation: "Test configuration" }) }));
vi.mock("@/components/social-media/ContentOrchestratorPanel", () => ({ ContentOrchestratorPanel: () => null }));
vi.mock("@/components/social-media/SocialPublishingQueuePanel", () => ({ SocialPublishingQueuePanel: () => null }));
vi.mock("@/components/social-media/GovernedVideoPreviewPanel", () => ({ GovernedVideoPreviewPanel: () => null }));
vi.mock("@/components/social-media/MarketLaunchPackPanel", () => ({ MarketLaunchPackPanel: () => null }));
vi.mock("@/components/tokmetric/TokMetricVideoPublisher", () => ({ TokMetricVideoPublisher: () => null }));

describe("social suite return links", () => {
  for (const [name, Page] of Object.entries({ SettingsPage, OverviewPage, CampaignsPage, CalendarPage, VideoPage, ContentPage })) {
    it(`${name} keeps the chosen workspace on its internal suite links`, async () => {
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ workspace: ["selected", "ignored"] }) }));
      const urls = Array.from(html.matchAll(/href="([^"]+)"/g), (match) => new URL(match[1].replaceAll("&amp;", "&"), "https://example.test"))
        .filter((url) => url.pathname.startsWith("/app/social-media"));
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(url.searchParams.get("workspace")).toBe("selected");
    });
  }
});
