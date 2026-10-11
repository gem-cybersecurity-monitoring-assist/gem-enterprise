import { describe, expect, it, vi } from "vitest";
import {
  cronSecretMisconfigured,
  isAuthorizedSocialCronRequest,
  resolveSocialCronSecret,
} from "@/lib/social-media/autopilot/cron-auth";
import {
  assertSocialAutopilotKillSwitchClear,
  cooldownAllowsScheduling,
  failureBackoffStatus,
  getWorkspacePausedProviders,
  isKillSwitchError,
  rateLimitBackoffStatus,
  resolveProviderPauseState,
} from "@/lib/social-media/autopilot/health";
import {
  autopilotCandidateWeight,
  applyAutopilotLearning,
} from "@/lib/social-media/autopilot/learning";
import {
  getSocialAutopilotProviderPolicy,
  isSocialAutopilotProviderPausedByConfig,
} from "@/lib/social-media/autopilot/policy";
import {
  buildSignalAttribution,
  evergreenFallbackSignals,
  selectAutopilotSignals,
} from "@/lib/social-media/autopilot/signals";
import type { MarketSignal } from "@/lib/social-media/planning/daily-flow";
import {
  computePerformanceWeights,
  hourBucketFor,
  neutralPerformanceWeights,
  weightForKey,
  weightKey,
} from "@/lib/social-media/analytics/scoring";
import { TokMetricError } from "@/lib/tokmetric/security";

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
  },
}));

vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("@/lib/tokmetric/security", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/tokmetric/security")>();
  return {
    ...mod,
    enforceEmergencyLocks: vi.fn(),
  };
});

vi.mock("@/lib/social-media/orchestration/intelligence", async (importOriginal) => {
  const mod = await importOriginal<
    typeof import("@/lib/social-media/orchestration/intelligence")
  >();
  return {
    ...mod,
    applyEngagementLearning: vi.fn(async (input: { signals: MarketSignal[] }) => [
      ...input.signals,
    ]),
  };
});

const { enforceEmergencyLocks } = (await import(
  "@/lib/tokmetric/security"
)) as unknown as { enforceEmergencyLocks: ReturnType<typeof vi.fn> };

function signal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    id: "news:article-1",
    topic: "Ransomware crew targets backups",
    summary: "Threat actors are encrypting backup repositories first.",
    relevance: 0.8,
    momentum: 0.7,
    observedAt: new Date("2026-09-28T10:00:00.000Z"),
    sourceReference: "https://example.com/news/ransomware-backups",
    ...overrides,
  };
}

describe("social autopilot cron auth (CRON_SECRET)", () => {
  const env = { CRON_SECRET: "s3cr3t" };
  const headers = (value: string | null) => ({
    headers: { get: () => value },
  });

  it("authorizes the exact bearer secret and rejects anything else", () => {
    expect(
      isAuthorizedSocialCronRequest(headers("Bearer s3cr3t"), env),
    ).toBe(true);
    expect(
      isAuthorizedSocialCronRequest(headers("Bearer wrong"), env),
    ).toBe(false);
    expect(
      isAuthorizedSocialCronRequest(headers("s3cr3t"), env),
    ).toBe(false);
    expect(isAuthorizedSocialCronRequest(headers(null), env)).toBe(false);
  });

  it("prefers the orchestrator-specific secret", () => {
    const both = {
      CRON_SECRET: "shared",
      CONTENT_ORCHESTRATOR_CRON_SECRET: "specific",
    };
    expect(resolveSocialCronSecret(both)).toBe("specific");
    expect(
      isAuthorizedSocialCronRequest(headers("Bearer specific"), both),
    ).toBe(true);
    expect(
      isAuthorizedSocialCronRequest(headers("Bearer shared"), both),
    ).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(resolveSocialCronSecret({})).toBeUndefined();
    expect(cronSecretMisconfigured({})).toBe(true);
    expect(
      isAuthorizedSocialCronRequest(headers("Bearer s3cr3t"), {}),
    ).toBe(false);
  });
});

describe("social autopilot policy budgets", () => {
  it("bounds the new per-provider budget fields", () => {
    const x = getSocialAutopilotProviderPolicy("X", {
      SOCIAL_AUTOPILOT_X_MAX_QUEUE_DEPTH: "500",
      SOCIAL_AUTOPILOT_X_COOLDOWN_MINUTES: "-5",
      SOCIAL_AUTOPILOT_X_FAILURE_BACKOFF_MULTIPLIER: "99",
      SOCIAL_AUTOPILOT_X_DUPLICATE_CONTENT_WINDOW_DAYS: "abc",
    });
    expect(x.maxQueueDepth).toBe(100); // clamped to max
    expect(x.cooldownMinutes).toBe(0); // clamped to min
    expect(x.failureBackoffMultiplier).toBe(8); // clamped to max
    expect(x.duplicateContentWindowDays).toBe(30); // fallback on garbage
  });

  it("ships conservative per-provider defaults", () => {
    const x = getSocialAutopilotProviderPolicy("X", {});
    expect(x.dailyTarget).toBeLessThanOrEqual(x.hardDailyCap);
    expect(x.maxQueueDepth).toBe(24);
    expect(x.cooldownMinutes).toBe(30);
    expect(x.failurePauseThreshold).toBe(3);
    expect(x.failureBackoffBaseMinutes).toBe(60);
    expect(x.failureBackoffMultiplier).toBe(2);
    expect(x.rateLimitBackoffMinutes).toBe(240);
    const nd = getSocialAutopilotProviderPolicy("NEXTDOOR", {});
    expect(nd.dailyTarget).toBe(1);
    expect(nd.hardDailyCap).toBe(2);
    expect(nd.minSpacingMinutes).toBe(480);
    expect(nd.cooldownMinutes).toBe(240);
  });

  it("supports provider pause knobs", () => {
    expect(
      isSocialAutopilotProviderPausedByConfig("X", {
        SOCIAL_AUTOPILOT_X_PAUSED: "true",
      }),
    ).toBe(true);
    expect(
      isSocialAutopilotProviderPausedByConfig("X", {
        SOCIAL_AUTOPILOT_PAUSE_ALL: "true",
      }),
    ).toBe(true);
    expect(isSocialAutopilotProviderPausedByConfig("X", {})).toBe(false);
  });
});

describe("live signal selection and honest fallback", () => {
  const planDate = new Date("2026-09-29T05:10:00.000Z");

  it("uses fresh approved news signals as live provenance", () => {
    const selection = selectAutopilotSignals({
      freshSignals: [signal(), signal({ id: "news:article-2" })],
      planDate,
      freshnessHours: 72,
      minLiveSignals: 1,
    });
    expect(selection.provenance).toBe("live");
    expect(selection.fallbackApplied).toBe(false);
    expect(selection.freshSignalCount).toBe(2);
    expect(selection.signals).toHaveLength(2);
  });

  it("excludes stale signals beyond the freshness window", () => {
    const stale = signal({
      id: "news:old",
      observedAt: new Date("2026-09-20T10:00:00.000Z"),
    });
    const selection = selectAutopilotSignals({
      freshSignals: [stale],
      planDate,
      freshnessHours: 72,
      minLiveSignals: 1,
    });
    expect(selection.provenance).toBe("evergreen-fallback");
    expect(selection.freshSignalCount).toBe(0);
    expect(selection.signals[0]?.id).toMatch(/^gem-evergreen:/);
  });

  it("falls back to evergreen honestly and never claims live sourcing", () => {
    const selection = selectAutopilotSignals({
      freshSignals: [],
      planDate,
      freshnessHours: 72,
      minLiveSignals: 1,
    });
    expect(selection.provenance).toBe("evergreen-fallback");
    expect(selection.fallbackApplied).toBe(true);
    expect(selection.freshSignalCount).toBe(0);
    expect(selection.signals.length).toBeGreaterThan(0);
    for (const item of selection.signals) {
      expect(item.id.startsWith("news:")).toBe(false);
      expect(item.sourceReference.startsWith("gem-approved-evergreen:")).toBe(true);
    }
  });

  it("respects minLiveSignals before declaring live provenance", () => {
    const selection = selectAutopilotSignals({
      freshSignals: [signal()],
      planDate,
      freshnessHours: 72,
      minLiveSignals: 3,
    });
    expect(selection.provenance).toBe("evergreen-fallback");
    expect(selection.freshSignalCount).toBe(1);
  });

  it("produces deterministic evergreen themes per plan date", () => {
    const a = evergreenFallbackSignals(planDate);
    const b = evergreenFallbackSignals(planDate);
    expect(a).toEqual(b);
    const other = evergreenFallbackSignals(
      new Date("2026-10-05T05:10:00.000Z"),
    );
    expect(other[0]?.id).not.toBe(a[0]?.id);
  });

  it("builds attribution only for live-sourced signals with URLs", () => {
    const live = buildSignalAttribution(signal());
    expect(live?.text).toBe("Source: https://example.com/news/ransomware-backups");
    expect(live?.url).toBe("https://example.com/news/ransomware-backups");
    expect(buildSignalAttribution(evergreenFallbackSignals(planDate)[0]!)).toBeUndefined();
    expect(
      buildSignalAttribution(signal({ sourceReference: "not-a-url" })),
    ).toBeUndefined();
  });
});

describe("provider pause resolution", () => {
  it("reads WS-A social_provider_pauses and maps META to both Meta surfaces", async () => {
    const { db } = (await import("@/lib/db")) as unknown as {
      db: { $queryRaw: ReturnType<typeof vi.fn> };
    };
    db.$queryRaw = vi.fn(async () => [
      { provider: "META" },
      { provider: "X" },
    ]);
    const paused = await getWorkspacePausedProviders("workspace-1");
    expect(paused).toContain("FACEBOOK_PAGE");
    expect(paused).toContain("INSTAGRAM_PROFESSIONAL");
    expect(paused).toContain("X");
    expect(paused).not.toContain("YOUTUBE");
    expect(paused).not.toContain("LINKEDIN_COMPANY");
  });

  it("treats a missing pause table as not paused", async () => {
    const { db } = (await import("@/lib/db")) as unknown as {
      db: { $queryRaw: ReturnType<typeof vi.fn> };
    };
    db.$queryRaw = vi.fn(async () => {
      throw new Error('relation "social_provider_pauses" does not exist');
    });
    await expect(getWorkspacePausedProviders("workspace-1")).resolves.toEqual(
      [],
    );
  });

  it("honors workspace-level paused providers first", () => {
    expect(
      resolveProviderPauseState({
        provider: "X",
        workspacePausedProviders: ["x"],
      }),
    ).toEqual({ paused: true, reason: "AUTOPILOT_PROVIDER_PAUSED_WORKSPACE" });
  });

  it("honors env pause knobs", () => {
    expect(
      resolveProviderPauseState({
        provider: "X",
        env: { SOCIAL_AUTOPILOT_X_PAUSED: "true" },
      }),
    ).toEqual({ paused: true, reason: "AUTOPILOT_PROVIDER_PAUSED_CONFIG" });
  });

  it("honors connector disabled_at (WS-A pause state)", () => {
    expect(
      resolveProviderPauseState({
        provider: "X",
        connectorDisabledAt: new Date("2026-09-28T00:00:00.000Z"),
      }),
    ).toEqual({
      paused: true,
      reason: "AUTOPILOT_PROVIDER_CONNECTOR_DISABLED",
    });
  });

  it("leaves healthy providers unpaused", () => {
    expect(
      resolveProviderPauseState({ provider: "X", env: {} }),
    ).toEqual({ paused: false });
  });
});

describe("failure / rate-limit backoff", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");

  it("stays healthy below the failure threshold", () => {
    const status = failureBackoffStatus({
      failureCount: 2,
      threshold: 3,
      baseMinutes: 60,
      multiplier: 2,
      lastFailureAt: new Date("2026-09-29T11:50:00.000Z"),
      now,
    });
    expect(status.active).toBe(false);
  });

  it("backs off exponentially from the threshold", () => {
    const lastFailureAt = new Date("2026-09-29T11:30:00.000Z");
    const at = failureBackoffStatus({
      failureCount: 3,
      threshold: 3,
      baseMinutes: 60,
      multiplier: 2,
      lastFailureAt,
      now,
    });
    expect(at.active).toBe(true);
    expect(at.resumeAt?.toISOString()).toBe("2026-09-29T12:30:00.000Z");

    const grown = failureBackoffStatus({
      failureCount: 5,
      threshold: 3,
      baseMinutes: 60,
      multiplier: 2,
      lastFailureAt,
      now: new Date("2026-09-29T14:00:00.000Z"),
    });
    expect(grown.active).toBe(true);
    // 60 * 2^(5-3) = 240 minutes -> resume at 15:30
    expect(grown.resumeAt?.toISOString()).toBe("2026-09-29T15:30:00.000Z");
  });

  it("caps backoff at 24 hours", () => {
    const status = failureBackoffStatus({
      failureCount: 30,
      threshold: 3,
      baseMinutes: 60,
      multiplier: 2,
      lastFailureAt: now,
      now,
    });
    expect(status.active).toBe(true);
    const resumeMs = status.resumeAt ? status.resumeAt.getTime() : NaN;
    expect(resumeMs - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("releases the provider once the backoff expires", () => {
    const status = failureBackoffStatus({
      failureCount: 3,
      threshold: 3,
      baseMinutes: 60,
      multiplier: 2,
      lastFailureAt: new Date("2026-09-29T08:00:00.000Z"),
      now,
    });
    expect(status.active).toBe(false);
  });

  it("pauses on any recent rate-limit hit for the fixed cooldown", () => {
    const hit = rateLimitBackoffStatus({
      rateLimitCount: 1,
      backoffMinutes: 240,
      lastRateLimitAt: new Date("2026-09-29T10:00:00.000Z"),
      now,
    });
    expect(hit.active).toBe(true);
    expect(hit.resumeAt?.toISOString()).toBe("2026-09-29T14:00:00.000Z");

    const expired = rateLimitBackoffStatus({
      rateLimitCount: 1,
      backoffMinutes: 240,
      lastRateLimitAt: new Date("2026-09-28T10:00:00.000Z"),
      now,
    });
    expect(expired.active).toBe(false);
  });

  it("enforces the materialization cooldown", () => {
    expect(
      cooldownAllowsScheduling({
        lastMaterializedAt: new Date("2026-09-29T11:50:00.000Z"),
        cooldownMinutes: 30,
        now,
      }),
    ).toBe(false);
    expect(
      cooldownAllowsScheduling({
        lastMaterializedAt: new Date("2026-09-29T11:20:00.000Z"),
        cooldownMinutes: 30,
        now,
      }),
    ).toBe(true);
    expect(
      cooldownAllowsScheduling({
        lastMaterializedAt: null,
        cooldownMinutes: 30,
        now,
      }),
    ).toBe(true);
  });
});

describe("emergency kill switch", () => {
  it("blocks the run when emergency locks are engaged", async () => {
    enforceEmergencyLocks.mockRejectedValueOnce(
      new TokMetricError(423, "TOKMETRIC_LOCKED", "locked"),
    );
    await expect(
      assertSocialAutopilotKillSwitchClear("workspace-1"),
    ).rejects.toMatchObject({ code: "TOKMETRIC_LOCKED", status: 423 });
    expect(enforceEmergencyLocks).toHaveBeenCalledWith("workspace-1", "publish");
  });

  it("lets the run proceed when locks are clear", async () => {
    enforceEmergencyLocks.mockResolvedValueOnce(undefined);
    await expect(
      assertSocialAutopilotKillSwitchClear("workspace-1"),
    ).resolves.toBeUndefined();
  });

  it("recognizes kill-switch errors by code", () => {
    expect(isKillSwitchError(new TokMetricError(423, "TOKMETRIC_LOCKED", "x"))).toBe(true);
    expect(isKillSwitchError(new TokMetricError(500, "OTHER", "x"))).toBe(false);
    expect(isKillSwitchError(new Error("nope"))).toBe(false);
  });
});

describe("WS-C learning-loop hookup", () => {
  it("stays neutral on cold start or missing weights", () => {
    expect(
      autopilotCandidateWeight({
        weights: null,
        provider: "X",
        format: "TEXT",
        scheduledFor: new Date("2026-09-29T14:00:00.000Z"),
      }),
    ).toBe(1.0);
    expect(
      autopilotCandidateWeight({
        weights: neutralPerformanceWeights(),
        provider: "X",
        format: "TEXT",
        scheduledFor: new Date("2026-09-29T14:00:00.000Z"),
      }),
    ).toBe(1.0);
  });

  it("reads candidate weights from WS-C bucket keys", () => {
    const weights = computePerformanceWeights([
      ...Array.from({ length: 3 }, () => ({
        provider: "X" as const,
        format: "TEXT",
        hourOfDay: 14,
        engagementRate: 0.2,
        impressions: 100,
        views: 50,
      })),
      ...Array.from({ length: 3 }, () => ({
        provider: "X" as const,
        format: "TEXT",
        hourOfDay: 2,
        engagementRate: 0.02,
        impressions: 100,
        views: 50,
      })),
    ]);
    expect(weights.coldStart).toBe(false);
    const key = weightKey("X", "TEXT", hourBucketFor(14));
    expect(weightForKey(weights, key)).toBeGreaterThan(1.0);
    expect(
      autopilotCandidateWeight({
        weights,
        provider: "X",
        format: "TEXT",
        scheduledFor: new Date("2026-09-29T14:30:00.000Z"),
      }),
    ).toBe(weightForKey(weights, key));
    // Unknown bucket degrades to neutral, never fabricated.
    expect(
      autopilotCandidateWeight({
        weights,
        provider: "X",
        format: "THREAD",
        scheduledFor: new Date("2026-09-29T02:30:00.000Z"),
      }),
    ).toBe(1.0);
  });

  it("degrades to neutral learning when the loop is disabled or unavailable", async () => {
    const result = await applyAutopilotLearning({
      workspaceId: "workspace-1",
      planDate: new Date("2026-09-29T05:10:00.000Z"),
      signals: [signal()],
      env: { SOCIAL_AUTOPILOT_ENABLED: "false" },
    });
    expect(result.signals).toHaveLength(1);
    expect(result.performanceWeights).toBeNull();
    expect(result.learningApplied).toEqual([
      "engagement-signal-boost",
      "performance-weights-unavailable",
    ]);
  });
});
