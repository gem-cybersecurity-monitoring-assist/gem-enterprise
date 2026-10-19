import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enterpriseApplicationSchema } from "@/lib/intake/schemas";
import {
  activationGuardrails,
  alreadyATargetCampaign,
  buildBusinessReviewCampaignUrl,
  buildWixMarketEntryReviewUrl,
  gtmCalendar,
  nurtureSequence,
  readinessChecklist,
  referralTracks,
  seoClusters,
  socialProfileDrafts,
  telegramPack,
  utmContract,
} from "@/lib/market/gtmActivation";

describe("GTM activation assets", () => {
  it("provides a complete 30-day governed operating calendar", () => {
    expect(gtmCalendar).toHaveLength(30);
    expect(gtmCalendar.map((item) => item.day)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(new Set(gtmCalendar.map((item) => item.phase))).toEqual(new Set(["FOUNDATION", "AUTHORITY", "CAMPAIGN", "CONVERSION"]));
  });

  it("includes the requested nurture, readiness, distribution and SEO assets", () => {
    expect(nurtureSequence.map((email) => email.day)).toEqual([0, 2, 5, 9]);
    expect(readinessChecklist).toHaveLength(10);
    expect(socialProfileDrafts.length).toBeGreaterThanOrEqual(8);
    expect(telegramPack.launchPosts.length).toBeGreaterThanOrEqual(4);
    expect(referralTracks.length).toBeGreaterThanOrEqual(5);
    expect(seoClusters.length).toBeGreaterThanOrEqual(4);
    expect(utmContract.destinations.review).toBe("/business-review");
  });

  it("keeps the Already a Target campaign evidence-safe", () => {
    const guardrails = activationGuardrails.join(" ");
    expect(alreadyATargetCampaign.positioning).toContain("without claiming that a specific prospect is compromised");
    expect(alreadyATargetCampaign.prohibitedClaims.join(" ")).toContain("We detected compromised credentials");
    expect(guardrails).toContain("is sent automatically from this activation pack");
    expect(guardrails).toContain("live-publishing gates");
  });

  it("uses one founding campaign identity across generated public and social Business Review links", () => {
    expect(utmContract.campaign).toBe("founding-first-20");
    const href = buildBusinessReviewCampaignUrl({ source: "homepage", medium: "hero" });
    expect(href).toContain("campaign=founding-first-20");
    expect(href).toContain("utm_campaign=founding-first-20");
    expect(href).toContain("utm_source=homepage");
    expect(href).toContain("utm_medium=hero");

    const homepage = readFileSync("src/app/page.tsx", "utf8");
    const enterprise = readFileSync("src/app/enterprise-solutions/page.tsx", "utf8");
    const socialSource = readFileSync("src/lib/social-media/orchestration/gem-sources.ts", "utf8");

    for (const source of [homepage, enterprise, socialSource]) {
      expect(source).toContain("buildBusinessReviewCampaignUrl");
      expect(source).not.toContain("utm_campaign=founding-review");
    }
  });

  it("routes Wix market entry through the canonical governed GEM pipeline", () => {
    expect(utmContract.sources).toContain("wix-gem-assist-1");
    expect(utmContract.mediums).toContain("organic");
    expect(buildWixMarketEntryReviewUrl()).toBe(
      "https://www.gemcybersecurityassist.com/business-review?" +
        "lead=referral&campaign=founding-first-20&" +
        "utm_source=wix-gem-assist-1&utm_medium=organic&utm_campaign=founding-first-20",
    );
  });

  it("passes approved campaign attribution from the landing URL into governed intake", () => {
    const reviewPage = readFileSync("src/app/business-review/page.tsx", "utf8");
    const intakeForm = readFileSync("src/components/market/BusinessReviewIntakeForm.tsx", "utf8");

    for (const parameter of ["lead", "source", "utm_source", "utm_medium", "utm_campaign", "campaign"]) {
      expect(reviewPage).toContain(`params.${parameter}`);
    }
    for (const field of ["leadSource", "campaignCode", "utmSource", "utmMedium", "utmCampaign"]) {
      expect(intakeForm).toContain(`${field}: attribution.${field}`);
    }
    expect(intakeForm).toContain('fetch("/api/intake/enterprise"');
    expect(intakeForm).toContain("consentGiven");
    expect(intakeForm).toContain("privacyAccepted");
    expect(intakeForm).not.toContain("wixforms.com");
    expect(intakeForm).not.toContain("createClient(");

    const parsed = enterpriseApplicationSchema.safeParse({
      name: "Sample Owner",
      email: "owner@example.com",
      organization: "Sample Company",
      title: "Owner",
      jurisdiction: "United States",
      subject: "[Founding Business Review] Account access and identity",
      message: "Please review account access, identity controls, and operational readiness.",
      consentGiven: true,
      privacyAccepted: true,
      startedAt: Date.now(),
      organizationType: "company",
      employeeRange: "1-10",
      serviceAreas: ["cybersecurity", "advisory"],
      leadSource: "referral",
      campaignCode: "founding-first-20",
      utmSource: "wix-gem-assist-1",
      utmMedium: "organic",
      utmCampaign: "founding-first-20",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        leadSource: "referral",
        campaignCode: "founding-first-20",
        utmSource: "wix-gem-assist-1",
        utmMedium: "organic",
        utmCampaign: "founding-first-20",
      });
    }
  });

  it("exposes native admin and public surfaces without auto-send code", () => {
    const activation = readFileSync("src/app/app/admin/market/activation/page.tsx", "utf8");
    const checklist = readFileSync("src/app/resources/business-readiness-checklist/page.tsx", "utf8");
    const operations = readFileSync("src/app/app/admin/market/operations/page.tsx", "utf8");
    const sitemap = readFileSync("src/app/sitemap.xml/route.ts", "utf8");

    expect(activation).toContain("GTM Activation Center");
    expect(activation).not.toContain("fetch(");
    expect(activation).not.toContain("/send");
    expect(checklist).toContain("10 questions every small and growing business");
    expect(operations).toContain("/app/admin/market/activation");
    expect(sitemap).toContain('"/resources/business-readiness-checklist"');
  });
});
