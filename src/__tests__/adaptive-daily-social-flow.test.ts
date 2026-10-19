import { describe, expect, it } from "vitest";
import {
  buildAdaptiveDailyContentPlan,
  contentFingerprint,
} from "@/lib/social-media/planning/daily-flow";

const planDate = new Date("2026-07-23T12:00:00.000Z");

function baseInput() {
  return {
    planDate,
    marketSignals: [
      {
        id: "signal-1",
        topic: "identity protection for small businesses",
        summary:
          "Buyer attention is increasing around account takeover prevention.",
        relevance: 0.95,
        momentum: 0.9,
        observedAt: new Date("2026-07-23T10:00:00.000Z"),
        sourceReference: "market://signal-1",
      },
      {
        id: "signal-2",
        topic: "phishing-resistant authentication",
        summary:
          "Passkeys and phishing-resistant MFA are receiving renewed attention.",
        relevance: 0.9,
        momentum: 0.85,
        observedAt: new Date("2026-07-23T09:00:00.000Z"),
        sourceReference: "market://signal-2",
      },
    ],
    approvedSources: [
      {
        id: "source-1",
        title: "GEM Identity Protection",
        summary: "Approved company service material.",
        callToAction: "Review the protection plan.",
        sourceReference: "https://gemcybersecurityassist.com/services",
        approvedAt: new Date("2026-07-22T12:00:00.000Z"),
        approved: true,
      },
      {
        id: "source-2",
        title: "GEM Security Readiness",
        summary: "Approved readiness guidance.",
        callToAction: "Complete a readiness review.",
        sourceReference: "https://gemcybersecurityassist.com/services",
        approvedAt: new Date("2026-07-22T12:00:00.000Z"),
        approved: true,
      },
    ],
    recentPublishedContent: [],
    enabledProviders: ["TIKTOK", "FACEBOOK_PAGE"] as const,
  };
}

describe("adaptive daily social flow", () => {
  it("creates at least 20 unique TikTok drafts without performing external actions", () => {
    const plan = buildAdaptiveDailyContentPlan(baseInput());
    const tiktok = plan.drafts.filter((draft) => draft.provider === "TIKTOK");

    expect(tiktok).toHaveLength(20);
    expect(new Set(tiktok.map((draft) => draft.fingerprint)).size).toBe(20);
    expect(plan.externalActionTaken).toBe(false);
    expect(tiktok.every((draft) => draft.externalActionTaken === false)).toBe(
      true,
    );
  });

  it("keeps every draft approval-bound and requires real-time human interaction", () => {
    const plan = buildAdaptiveDailyContentPlan(baseInput());

    expect(
      plan.drafts.every(
        (draft) =>
          draft.approvalRequired &&
          draft.complianceReviewRequired &&
          draft.humanInteraction.required &&
          draft.humanInteraction.responseMode === "REAL_TIME" &&
          draft.humanInteraction.livePerformanceReviewRequired,
      ),
    ).toBe(true);
  });

  it("blocks historical content fingerprints by default without an expiry window", () => {
    const initial = buildAdaptiveDailyContentPlan(baseInput());
    const blocked = initial.drafts[0];
    const next = buildAdaptiveDailyContentPlan({
      ...baseInput(),
      recentPublishedContent: [
        {
          fingerprint: blocked.fingerprint,
          provider: blocked.provider,
          publishedAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ],
    });

    expect(next.drafts.map((draft) => draft.fingerprint)).not.toContain(
      blocked.fingerprint,
    );
  });

  it("permits an explicitly approved bounded freshness window", () => {
    const initial = buildAdaptiveDailyContentPlan(baseInput());
    const old = initial.drafts[0];
    const next = buildAdaptiveDailyContentPlan({
      ...baseInput(),
      freshnessWindowDays: 30,
      recentPublishedContent: [
        {
          fingerprint: old.fingerprint,
          provider: old.provider,
          publishedAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ],
    });

    expect(next.drafts.map((draft) => draft.fingerprint)).toContain(
      old.fingerprint,
    );
  });

  it("ranks current high-energy market signals before lower-energy inputs", () => {
    const plan = buildAdaptiveDailyContentPlan(baseInput());
    expect(plan.drafts[0].signalId).toBe("signal-1");
  });

  it("fails closed when approved company source material is unavailable", () => {
    const plan = buildAdaptiveDailyContentPlan({
      ...baseInput(),
      approvedSources: [],
    });

    expect(plan.drafts).toHaveLength(0);
    expect(plan.rejectedReasons).toContain(
      "APPROVED_SOURCE_MATERIAL_REQUIRED",
    );
  });

  it("excludes Indeed unless there is a genuine role or approved employer update", () => {
    const plan = buildAdaptiveDailyContentPlan({
      ...baseInput(),
      enabledProviders: ["INDEED_EMPLOYER"],
    });

    expect(plan.drafts).toHaveLength(0);
    expect(plan.rejectedReasons).toContain(
      "INDEED_GENUINE_ROLE_OR_EMPLOYER_UPDATE_REQUIRED",
    );
  });

  it("creates an Indeed job posting only when a vacancy identifier is present", () => {
    const plan = buildAdaptiveDailyContentPlan({
      ...baseInput(),
      enabledProviders: ["INDEED_EMPLOYER"],
      approvedSources: [
        {
          ...baseInput().approvedSources[0],
          vacancyId: "vacancy-123",
          providers: ["INDEED_EMPLOYER"],
        },
      ],
    });

    expect(plan.drafts).toHaveLength(1);
    expect(plan.drafts[0].contentType).toBe("JOB_POSTING");
    expect(plan.drafts[0].vacancyId).toBe("vacancy-123");
  });

  it("creates stable fingerprints from normalized content inputs", () => {
    const first = contentFingerprint({
      provider: "TIKTOK",
      topic: "  Identity   Protection ",
      angle: "What Changed Today",
      sourceMaterialId: "source-1",
      contentType: "SHORT_VIDEO",
    });
    const second = contentFingerprint({
      provider: "TIKTOK",
      topic: "identity protection",
      angle: "what changed today",
      sourceMaterialId: "source-1",
      contentType: "SHORT_VIDEO",
    });

    expect(first).toBe(second);
  });
});
