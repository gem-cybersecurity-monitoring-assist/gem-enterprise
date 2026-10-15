import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSocialContentPackage,
  evaluateSocialPublishingAuthorization,
} from "@/lib/social-media/policy";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("GEM cross-platform social media command center", () => {
  it("registers all governed company channels without authorizing writes", () => {
    const readiness = getSocialMediaProviderReadiness({ NODE_ENV: "test" });
    expect(readiness.map((provider) => provider.id)).toEqual([
      "TIKTOK",
      "FACEBOOK_PAGE",
      "INSTAGRAM_PROFESSIONAL",
      "X",
      "NEXTDOOR",
      "INDEED_EMPLOYER",
      "LINKEDIN_COMPANY",
      "YOUTUBE",
    ]);
    expect(readiness.every((provider) => provider.externalWriteAllowed === false)).toBe(true);
    expect(readiness.every((provider) => provider.configurationReady === false)).toBe(true);
  });

  it("does not expose configured secret values through readiness", () => {
    const readiness = getSocialMediaProviderReadiness({
      NODE_ENV: "test",
      META_SOCIAL_OAUTH_ENABLED: "true",
      META_APP_ID: "app-id",
      META_APP_SECRET: "never-return-this",
      META_OAUTH_REDIRECT_URI: "https://example.com/callback",
      SOCIAL_TOKEN_ENCRYPTION_KEY: "never-return-this-either",
    });
    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain("never-return-this");
    expect(serialized).not.toContain("never-return-this-either");
  });

  it("requires every production publishing boundary before external action", () => {
    const blocked = evaluateSocialPublishingAuthorization({
      provider: "TIKTOK",
      contentType: "SHORT_VIDEO",
      connectorState: "AUTHORIZATION_REQUIRED",
      globalLivePublishingEnabled: false,
      providerPublishingEnabled: false,
      emergencyLockActive: false,
      compliancePassed: false,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.externalActionTaken).toBe(false);
    expect(blocked.reasons).toContain("GLOBAL_LIVE_PUBLISHING_DISABLED");
    expect(blocked.reasons).toContain("CONNECTED_ACCOUNT_REQUIRED");
    expect(blocked.reasons).toContain("HUMAN_APPROVAL_REQUIRED");
    expect(blocked.reasons).toContain("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("limits Indeed to genuine hiring workflows", () => {
    const blocked = evaluateSocialPublishingAuthorization({
      provider: "INDEED_EMPLOYER",
      contentType: "JOB_POSTING",
      connectorState: "CONNECTED",
      globalLivePublishingEnabled: true,
      providerPublishingEnabled: true,
      emergencyLockActive: false,
      compliancePassed: true,
      approvalId: "approval-1",
      approvedVersionHash: "hash-1",
      currentVersionHash: "hash-1",
      idempotencyKey: "job-1",
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain("APPROVED_VACANCY_REQUIRED");
  });

  it("requires local context for Nextdoor", () => {
    const blocked = evaluateSocialPublishingAuthorization({
      provider: "NEXTDOOR",
      contentType: "LOCAL_UPDATE",
      connectorState: "CONNECTED",
      globalLivePublishingEnabled: true,
      providerPublishingEnabled: true,
      emergencyLockActive: false,
      compliancePassed: true,
      approvalId: "approval-1",
      approvedVersionHash: "hash-1",
      currentVersionHash: "hash-1",
      idempotencyKey: "nextdoor-1",
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain("LOCAL_CONTEXT_REQUIRED");
  });

  it("creates drafts that remain approval and compliance gated", () => {
    const draft = createSocialContentPackage({
      title: "GEM service update",
      summary: "Approved company service information.",
      callToAction: "Request a consultation.",
      sourceReference: "service-catalogue-v1",
      targets: ["TIKTOK", "FACEBOOK_PAGE", "TIKTOK"],
      contentType: "SHORT_VIDEO",
    });
    expect(draft.targets).toEqual(["TIKTOK", "FACEBOOK_PAGE"]);
    expect(draft.state).toBe("DRAFT");
    expect(draft.approvalRequired).toBe(true);
    expect(draft.complianceReviewRequired).toBe(true);
    expect(draft.externalActionTaken).toBe(false);
  });

  it("exposes a protected command-center surface and never claims live publishing", () => {
    const page = source("src/app/app/command-center/social-media/page.tsx");
    expect(page).toContain("GEM Social Media Command Center");
    expect(page).toContain("External writes remain locked");
    expect(page).toContain("Configuration readiness");
    expect(page).toContain("does not authorize publishing");
    expect(page).not.toContain("Publishing enabled");
  });
});
