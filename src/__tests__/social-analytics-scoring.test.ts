import { describe, expect, it, vi } from "vitest";

// scoring.ts transitively imports the raw-SQL store; the Prisma client cannot
// be generated in this sandbox (engine download is blocked), so the sql
// template tag and the db handle are doubled here. Production code is untouched.
vi.mock("@/lib/db", () => ({ db: { $queryRaw: () => Promise.resolve([]) } }));
vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join("?"),
      values,
    }),
  },
}));

import {
  computePerformanceWeights,
  getPerformanceWeights,
  hourBucketFor,
  neutralPerformanceWeights,
  weightForKey,
  weightKey,
} from "@/lib/social-media/analytics/scoring";
import type { PerformanceObservation } from "@/lib/social-media/analytics/types";

function observation(
  overrides: Partial<PerformanceObservation>,
): PerformanceObservation {
  return {
    provider: "INSTAGRAM_PROFESSIONAL",
    format: "SHORT_VIDEO",
    hourOfDay: 9,
    engagementRate: 0.05,
    impressions: 1000,
    views: null,
    ...overrides,
  };
}

describe("social analytics learning loop", () => {
  it("degrades to neutral weights on cold start", () => {
    const weights = computePerformanceWeights([]);
    expect(weights.coldStart).toBe(true);
    expect(weights.sampleCount).toBe(0);
    expect(weights.weights).toEqual({});
    expect(weights.confidence).toEqual({});
    // The orchestrator helper never fakes confidence for unknown buckets.
    expect(weightForKey(weights, "INSTAGRAM_PROFESSIONAL::SHORT_VIDEO::h6-11")).toBe(1.0);
  });

  it("stays neutral when all engagement data is uniformly zero", () => {
    const weights = computePerformanceWeights([
      observation({ engagementRate: 0 }),
      observation({ engagementRate: 0 }),
    ]);
    expect(weights.coldStart).toBe(true);
    expect(weightForKey(weights, weightKey("INSTAGRAM_PROFESSIONAL", "SHORT_VIDEO", "h6-11"))).toBe(1.0);
  });

  it("ignores observations without a usable engagement rate", () => {
    const weights = computePerformanceWeights([
      observation({ engagementRate: null }),
      observation({ engagementRate: Number.NaN }),
    ]);
    expect(weights.coldStart).toBe(true);
  });

  it("weights buckets relative to the global mean and clamps extremes", () => {
    const weights = computePerformanceWeights([
      observation({ engagementRate: 0.12, hourOfDay: 9 }),
      observation({ engagementRate: 0.12, hourOfDay: 10 }),
      observation({ engagementRate: 0.12, hourOfDay: 11 }),
      observation({ engagementRate: 0.03, hourOfDay: 21, format: "TEXT" }),
      observation({ engagementRate: 0.03, hourOfDay: 22, format: "TEXT" }),
      observation({ engagementRate: 0.03, hourOfDay: 23, format: "TEXT" }),
    ]);
    expect(weights.coldStart).toBe(false);
    // global mean = 0.075 -> strong bucket 1.6, weak bucket 0.4 clamped to 0.5
    const strong = weightForKey(weights, weightKey("INSTAGRAM_PROFESSIONAL", "SHORT_VIDEO", "h6-11"));
    const weak = weightForKey(weights, weightKey("INSTAGRAM_PROFESSIONAL", "TEXT", "h18-23"));
    expect(strong).toBeCloseTo(1.6, 5);
    expect(weak).toBe(0.5);
    expect(weights.confidence[weightKey("INSTAGRAM_PROFESSIONAL", "SHORT_VIDEO", "h6-11")]).toBeCloseTo(0.3, 5);
  });

  it("shrinks weights toward neutral for tiny samples", () => {
    const weights = computePerformanceWeights([
      observation({ engagementRate: 0.2, hourOfDay: 9 }),
      observation({ engagementRate: 0.02, hourOfDay: 9, format: "TEXT" }),
    ]);
    const key = weightKey("INSTAGRAM_PROFESSIONAL", "SHORT_VIDEO", "h6-11");
    const value = weightForKey(weights, key);
    // Single sample: pulled one third of the way from 1.0 toward the raw ratio.
    expect(value).toBeGreaterThan(1.0);
    expect(value).toBeLessThan(2.0);
  });

  it("buckets hours of day deterministically", () => {
    expect(hourBucketFor(0)).toBe("h0-5");
    expect(hourBucketFor(5)).toBe("h0-5");
    expect(hourBucketFor(6)).toBe("h6-11");
    expect(hourBucketFor(12)).toBe("h12-17");
    expect(hourBucketFor(18)).toBe("h18-23");
    expect(hourBucketFor(23)).toBe("h18-23");
  });

  it("neutral weights helper matches cold-start shape", () => {
    const neutral = neutralPerformanceWeights();
    expect(neutral.coldStart).toBe(true);
    expect(weightForKey(neutral, "anything")).toBe(1.0);
  });

  it("exposes the workspace-facing entry point for WS-E", () => {
    expect(typeof getPerformanceWeights).toBe("function");
  });
});
