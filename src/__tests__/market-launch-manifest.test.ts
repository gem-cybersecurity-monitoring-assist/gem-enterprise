import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, "public/market-launch/founding-first-20.json"), "utf8"),
) as {
  campaignId: string;
  status: string;
  ownerApprovalRequired: boolean;
  primaryLandingPage: string;
  media: Array<{ id: string; path: string; format: string; alt: string }>;
  channels: Array<{ provider: string; source: string; medium: string; status: string; mediaIds: string[] }>;
  trackingLinks: Array<{ source: string; medium: string; campaign: string; url: string }>;
  releaseGates: string[];
};

describe("GEM market launch content package", () => {
  it("keeps all launch content in draft until explicit owner approval", () => {
    expect(manifest.status).toBe("DRAFT_NOT_PUBLISHED");
    expect(manifest.ownerApprovalRequired).toBe(true);
    expect(manifest.campaignId).toBe("founding-first-20");
    expect(manifest.primaryLandingPage).toBe("https://www.gemcybersecurityassist.com/business-review");
    expect(manifest.channels.length).toBeGreaterThanOrEqual(7);
    expect(manifest.channels.every((channel) => channel.status === "DRAFT")).toBe(true);
  });

  it("includes media assets that exist in the repository and have alt text", () => {
    expect(manifest.media.length).toBeGreaterThanOrEqual(8);
    for (const asset of manifest.media) {
      expect(asset.alt.trim().length, asset.id).toBeGreaterThan(10);
      expect(readFileSync(join(root, "public", asset.path.replace(/^\//, "")), "utf8")).toContain("<svg");
    }
  });

  it("preserves channel-specific attribution on every campaign link", () => {
    expect(manifest.trackingLinks.length).toBe(7);
    for (const link of manifest.trackingLinks) {
      const url = new URL(link.url);
      expect(url.pathname).toBe("/business-review");
      expect(url.searchParams.get("utm_source")).toBe(link.source);
      expect(url.searchParams.get("utm_medium")).toBe("organic-social");
      expect(url.searchParams.get("utm_campaign")).toBe("founding-first-20");
      expect(link.campaign).toBe("founding-first-20");
    }
  });

  it("surfaces the launch pack in the existing Social Media content workspace without publishing", () => {
    const contentPage = readFileSync(join(root, "src/app/app/social-media/content/page.tsx"), "utf8");
    const panel = readFileSync(join(root, "src/components/social-media/MarketLaunchPackPanel.tsx"), "utf8");

    expect(contentPage).toContain("MarketLaunchPackPanel campaign={campaign}");
    expect(panel).toContain("Draft · not published");
    expect(panel).toContain('channel.status');
    expect(panel).toContain("Copy caption");
    expect(panel).toContain("Download SVG");
    expect(panel).toContain("Copy tracked CTA link");
    expect(panel).toContain('link.source === channel.source');
    expect(panel).toContain('href={asset.path} download');
    expect(panel).not.toContain("/api/social-media/publishing");
    expect(panel).not.toContain("window.location.assign");
  });

  it("requires backend, account, content, and explicit publish gates", () => {
    expect(manifest.releaseGates.some((gate) => /transactional social gateway/i.test(gate))).toBe(true);
    expect(manifest.releaseGates.some((gate) => /explicit owner approval/i.test(gate))).toBe(true);
    expect(manifest.releaseGates.some((gate) => /positive budget/i.test(gate))).toBe(true);
  });
});
