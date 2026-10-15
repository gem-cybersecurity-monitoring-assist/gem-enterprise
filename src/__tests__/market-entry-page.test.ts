import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBusinessReviewCampaignUrl, utmContract } from "@/lib/market/gtmActivation";
import { getRouteByPath } from "@/lib/siteRoutes";

const page = readFileSync("src/app/market-entry/page.tsx", "utf8");

describe("GEM premium market-entry page", () => {
  it("registers both distinct public customer journeys", () => {
    expect(getRouteByPath("/market-entry")).toMatchObject({ path: "/market-entry", category: "public", isPublic: true, isCanonical: true, owner: "marketing" });
    expect(getRouteByPath("/personal-security")).toMatchObject({ path: "/personal-security", category: "public", isPublic: true, isCanonical: true, owner: "marketing" });
  });

  it("keeps the personal journey inquiry-only and safe for sensitive information", () => {
    const personalPage = readFileSync("src/app/personal-security/page.tsx", "utf8");
    expect(personalPage).toContain('canonical: "/personal-security"');
    expect(personalPage).toContain('href="/contact"');
    expect(personalPage).toContain("does not activate a paid service");
    expect(personalPage).toContain("private keys");
    expect(personalPage).not.toContain("createClient(");
    expect(personalPage).not.toContain("fetch(");
  });

  it("uses the existing governed Business Review campaign", () => {
    expect(utmContract.sources).toContain("market-entry");
    const hero = buildBusinessReviewCampaignUrl({
      source: "market-entry",
      medium: "hero",
      leadSource: "campaign",
    });
    const query = new URL(hero, "https://www.gemcybersecurityassist.com").searchParams;
    expect(query.get("campaign")).toBe("founding-first-20");
    expect(query.get("utm_source")).toBe("market-entry");
    expect(query.get("utm_medium")).toBe("hero");
    expect(query.get("utm_campaign")).toBe("founding-first-20");
    expect(page).toContain("buildBusinessReviewCampaignUrl");
    expect(page).toContain("foundingBusinessReviewOffer");
    expect(page).toContain('href="/personal-security"');
  });

  it("preserves the canonical platform, public inquiry, and accessibility safeguards", () => {
    expect(page).toContain('canonical: "/market-entry"');
    expect(page).toContain('href="/enterprise/apply"');
    expect(page).toContain('href="/contact"');
    expect(page).toContain("https://firmgem.wixforms.com/f/7515843603776668706");
    expect(page).toContain('focus-visible:outline');
    expect(page).toContain("No payment or service activation from a request");
    expect(page).toContain("does not automatically create a GEM client workspace");
  });

  it("is a concise market-entry page without creating a parallel customer database", () => {
    expect(page).toContain('Focused services. No crowded catalog.');
    expect(page).toContain('aria-label="Illustrative business security review dashboard"');
    expect(page).toContain("SAMPLE VIEW");
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("DATABASE_URL");
    expect(page).not.toContain("createClient(");
    expect(page).not.toContain("<form");
  });
});
