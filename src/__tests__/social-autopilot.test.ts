import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSocialAutopilotEgressPolicy,
  getSocialAutopilotProviderPolicy,
  getSocialAutopilotProviderTargets,
  socialAutopilotAutoApprovalEnabled,
} from "@/lib/social-media/autopilot/policy";
import {
  globalSocialPublishingEnabled,
  providerSocialPublishingEnabled,
} from "@/lib/social-media/publishing/gates";
import {
  buildSocialAutopilotSlots,
  reservePlanDates,
} from "@/lib/social-media/autopilot/scheduler";

describe("social autopilot policy", () => {
  it("keeps default cadence bounded below provider hard caps", () => {
    const targets = getSocialAutopilotProviderTargets({});
    expect(targets.FACEBOOK_PAGE).toBe(3);
    expect(targets.INSTAGRAM_PROFESSIONAL).toBe(3);
    expect(targets.X).toBe(8);
    expect(targets.LINKEDIN_COMPANY).toBe(2);
    expect(targets.YOUTUBE).toBe(1);
    expect(targets.NEXTDOOR).toBe(1);

    const x = getSocialAutopilotProviderPolicy("X", {
      SOCIAL_AUTOPILOT_X_DAILY_TARGET: "999",
    });
    expect(x.dailyTarget).toBe(x.hardDailyCap);
    expect(x.hardDailyCap).toBe(15);
  });

  it("requires both autopilot and automatic approval gates", () => {
    expect(
      socialAutopilotAutoApprovalEnabled({
        SOCIAL_AUTOPILOT_ENABLED: "true",
        SOCIAL_AUTOPILOT_AUTO_APPROVAL_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      socialAutopilotAutoApprovalEnabled({
        SOCIAL_AUTOPILOT_ENABLED: "false",
        SOCIAL_AUTOPILOT_AUTO_APPROVAL_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("rejects rotating proxy configuration", () => {
    expect(() =>
      getSocialAutopilotEgressPolicy({
        SOCIAL_AUTOPILOT_EGRESS_MODE: "PLATFORM_DEFAULT",
        SOCIAL_AUTOPILOT_ROTATING_PROXY_URL: "https://proxy.invalid",
      }),
    ).toThrow(/Rotating, residential, and mobile proxy/);

    expect(
      getSocialAutopilotEgressPolicy({
        SOCIAL_AUTOPILOT_EGRESS_MODE: "STATIC_NAT",
        SOCIAL_AUTOPILOT_EGRESS_REGION: "us-east",
      }),
    ).toMatchObject({
      mode: "STATIC_NAT",
      region: "us-east",
      stableIdentityRequired: true,
      rotatingProxyAllowed: false,
    });
  });
});

describe("social autopilot scheduler", () => {
  it("creates a bounded rolling reserve", () => {
    const dates = reservePlanDates({
      now: new Date("2026-09-21T12:00:00.000Z"),
      reserveDays: 3,
    });
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-09-21T00:00:00.000Z",
      "2026-09-22T00:00:00.000Z",
      "2026-09-23T00:00:00.000Z",
    ]);
  });

  it("spaces X slots safely and deterministically", () => {
    const input = {
      provider: "X" as const,
      planDate: new Date("2026-09-22T00:00:00.000Z"),
      now: new Date("2026-09-21T12:00:00.000Z"),
      count: 8,
      env: {},
    };
    const first = buildSocialAutopilotSlots(input);
    const second = buildSocialAutopilotSlots(input);
    expect(first).toEqual(second);
    expect(first).toHaveLength(8);

    for (let index = 1; index < first.length; index += 1) {
      expect(first[index].getTime() - first[index - 1].getTime()).toBeGreaterThanOrEqual(
        60 * 60 * 1000,
      );
    }
    expect(first[0].getUTCHours()).toBeGreaterThanOrEqual(8);
    expect(first.at(-1)?.getUTCHours()).toBeLessThanOrEqual(22);
  });

  it("never schedules beyond the configured hard cap", () => {
    const slots = buildSocialAutopilotSlots({
      provider: "FACEBOOK_PAGE",
      planDate: new Date("2026-09-22T00:00:00.000Z"),
      now: new Date("2026-09-21T12:00:00.000Z"),
      count: 50,
      env: {},
    });
    expect(slots.length).toBeLessThanOrEqual(6);
  });
});


describe("social autopilot execution gates", () => {
  it("does not materialize live jobs while global or provider publishing is disabled", () => {
    expect(globalSocialPublishingEnabled({})).toBe(false);
    expect(
      globalSocialPublishingEnabled({
        SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED: "true",
      }),
    ).toBe(true);
    expect(providerSocialPublishingEnabled("X", {})).toBe(false);
    expect(
      providerSocialPublishingEnabled("X", {
        X_SOCIAL_PUBLISHING_ENABLED: "true",
      }),
    ).toBe(true);

    const service = readFileSync(
      join(process.cwd(), "src/lib/social-media/autopilot/service.ts"),
      "utf8",
    );
    expect(service).toContain("GLOBAL_LIVE_PUBLISHING_DISABLED");
    expect(service).toContain("_LIVE_PUBLISHING_DISABLED");
    expect(service).toContain("YOUTUBE_UPLOAD_PIPELINE_NOT_CERTIFIED");
    expect(service).toContain("INSTAGRAM_REEL_MEDIA_REQUIRED");
  });

  it("keeps auto-policy drafts on text-safe formats until verified media exists", () => {
    const planner = readFileSync(
      join(process.cwd(), "src/lib/social-media/planning/daily-flow.ts"),
      "utf8",
    );
    expect(planner).toContain('FACEBOOK_PAGE: ["TEXT", "LINK"]');
    expect(planner).toContain('X: ["TEXT", "THREAD"]');
    expect(planner).toContain('NEXTDOOR: ["LOCAL_UPDATE", "LINK"]');
    expect(planner).toContain('LINKEDIN_COMPANY: ["TEXT", "ARTICLE"]');
  });
});
