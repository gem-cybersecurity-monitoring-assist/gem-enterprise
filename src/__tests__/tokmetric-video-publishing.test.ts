import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  calculateTikTokChunkPlan,
  chunkByteRange,
} from "@/lib/tokmetric/publishing/types";
import { getTokMetricPublishingGate } from "@/lib/tokmetric/publishing/gates";
import {
  assertMediaAssetAttachedToApprovedVersion,
  assertSelectedVideoMatchesApprovedAsset,
  validateVerifiedMediaUrl,
} from "@/lib/tokmetric/publishing/service";
import { requireSameOriginRequest } from "@/lib/tokmetric/security";

const originalEnv = { ...process.env };
const approvedAsset = {
  id: "asset-1",
  fileName: "approved.mp4",
  mimeType: "video/mp4" as const,
  fileSize: 1024,
  checksum: "a".repeat(64),
  storageRef: "https://media.gemcybersecurityassist.com/videos/approved.mp4",
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("TikTok video upload planning", () => {
  it("uploads files smaller than 5 MiB as one complete chunk", () => {
    const plan = calculateTikTokChunkPlan(2 * 1024 * 1024);
    expect(plan).toEqual({
      videoSize: 2 * 1024 * 1024,
      chunkSize: 2 * 1024 * 1024,
      totalChunkCount: 1,
    });
    expect(chunkByteRange(plan, 0)).toEqual({
      start: 0,
      end: 2 * 1024 * 1024 - 1,
      length: 2 * 1024 * 1024,
    });
  });

  it("keeps a 64 MiB video as one valid chunk", () => {
    const size = 64 * 1024 * 1024;
    expect(calculateTikTokChunkPlan(size)).toEqual({
      videoSize: size,
      chunkSize: size,
      totalChunkCount: 1,
    });
  });

  it("uses at least two chunks immediately above 64 MiB", () => {
    const size = 65 * 1024 * 1024;
    const plan = calculateTikTokChunkPlan(size);
    expect(plan.totalChunkCount).toBe(2);
    expect(chunkByteRange(plan, 0).length).toBeLessThanOrEqual(64 * 1024 * 1024);
    expect(chunkByteRange(plan, 1).end).toBe(size - 1);
  });

  it("uses sequential chunks and merges the trailing bytes into the final request", () => {
    const videoSize = 150 * 1024 * 1024;
    const plan = calculateTikTokChunkPlan(videoSize);
    expect(plan.totalChunkCount).toBe(2);
    expect(chunkByteRange(plan, 0).start).toBe(0);
    const final = chunkByteRange(plan, 1);
    expect(final.end).toBe(videoSize - 1);
    expect(final.length).toBe(videoSize - plan.chunkSize);
  });

  it("rejects files larger than TikTok's 4 GB maximum", () => {
    expect(() => calculateTikTokChunkPlan(4 * 1024 * 1024 * 1024 + 1)).toThrow(/4 GB/);
  });
});

describe("TikTok publishing activation gates", () => {
  it("does not let the production flag activate a sandbox environment", () => {
    process.env.TIKTOK_ENVIRONMENT = "sandbox";
    process.env.TOKMETRIC_LIVE_PUBLISHING_ENABLED = "true";
    process.env.TOKMETRIC_SANDBOX_PUBLISHING_ENABLED = "false";
    const gate = getTokMetricPublishingGate();
    expect(gate.enabled).toBe(false);
    expect(gate.configurationMismatch).toBe(true);
  });

  it("does not let the sandbox flag activate a production environment", () => {
    process.env.TIKTOK_ENVIRONMENT = "production";
    process.env.TOKMETRIC_LIVE_PUBLISHING_ENABLED = "false";
    process.env.TOKMETRIC_SANDBOX_PUBLISHING_ENABLED = "true";
    const gate = getTokMetricPublishingGate();
    expect(gate.enabled).toBe(false);
    expect(gate.configurationMismatch).toBe(true);
  });

  it("activates only the matching sandbox gate", () => {
    process.env.TIKTOK_ENVIRONMENT = "sandbox";
    process.env.TOKMETRIC_LIVE_PUBLISHING_ENABLED = "false";
    process.env.TOKMETRIC_SANDBOX_PUBLISHING_ENABLED = "true";
    expect(getTokMetricPublishingGate()).toMatchObject({
      environment: "sandbox",
      enabled: true,
      mode: "sandbox",
    });
  });
});

describe("TikTok verified media URL controls", () => {
  it("accepts HTTPS URLs on configured domains and subdomains", () => {
    process.env.TOKMETRIC_VERIFIED_MEDIA_HOSTS = "gemcybersecurityassist.com";
    expect(validateVerifiedMediaUrl("https://media.gemcybersecurityassist.com/videos/demo.mp4").hostname)
      .toBe("media.gemcybersecurityassist.com");
  });

  it("rejects unverified domains and URL credentials", () => {
    process.env.TOKMETRIC_VERIFIED_MEDIA_HOSTS = "gemcybersecurityassist.com";
    expect(() => validateVerifiedMediaUrl("https://example.com/demo.mp4")).toThrow(/approved TikTok URL property/);
    expect(() => validateVerifiedMediaUrl("https://user:pass@gemcybersecurityassist.com/demo.mp4")).toThrow(/without credentials/);
  });

  it("fails closed when no verified media hosts are configured", () => {
    delete process.env.TOKMETRIC_VERIFIED_MEDIA_HOSTS;
    expect(() => validateVerifiedMediaUrl("https://gemcybersecurityassist.com/demo.mp4")).toThrow(/disabled/);
  });
});

describe("TikTok exact approved video binding", () => {
  it("rejects an unknown media asset before a publishing request is initialized", () => {
    expect(() => assertMediaAssetAttachedToApprovedVersion(["asset-1"], "asset-unknown"))
      .toThrow(/attached to the exact approved content version/);
  });

  it("accepts a local file only when its immutable evidence matches the approved asset", () => {
    expect(assertSelectedVideoMatchesApprovedAsset({
      asset: approvedAsset,
      source: "FILE_UPLOAD",
      file: {
        name: "downloaded-copy.mp4",
        mimeType: "video/mp4",
        size: 1024,
        checksumSha256: "a".repeat(64),
      },
    })).toMatchObject({ file: { checksumSha256: "a".repeat(64) } });
  });

  it("rejects a substituted local video even when the content record is approved", () => {
    expect(() => assertSelectedVideoMatchesApprovedAsset({
      asset: approvedAsset,
      source: "FILE_UPLOAD",
      file: {
        name: "substituted.mp4",
        mimeType: "video/mp4",
        size: 1024,
        checksumSha256: "b".repeat(64),
      },
    })).toThrow(/exact approved video asset/);
  });

  it("derives managed URL publishing from the approved asset and rejects URL substitution", () => {
    process.env.TOKMETRIC_VERIFIED_MEDIA_HOSTS = "gemcybersecurityassist.com";
    expect(assertSelectedVideoMatchesApprovedAsset({
      asset: approvedAsset,
      source: "PULL_FROM_URL",
    }).verifiedUrl?.toString()).toBe(approvedAsset.storageRef);

    expect(() => assertSelectedVideoMatchesApprovedAsset({
      asset: approvedAsset,
      source: "PULL_FROM_URL",
      videoUrl: "https://media.gemcybersecurityassist.com/videos/different.mp4",
    })).toThrow(/exact approved video asset/);
  });
});

describe("TokMetric publishing browser-origin protection", () => {
  it("accepts an explicit same-origin browser request", () => {
    const request = new NextRequest("https://gemcybersecurityassist.com/api/tokmetric/publishing/init", {
      headers: { origin: "https://gemcybersecurityassist.com" },
    });
    expect(() => requireSameOriginRequest(request)).not.toThrow();
  });

  it("rejects missing and cross-origin browser requests", () => {
    const missing = new NextRequest("https://gemcybersecurityassist.com/api/tokmetric/publishing/init");
    const crossOrigin = new NextRequest("https://gemcybersecurityassist.com/api/tokmetric/publishing/init", {
      headers: { origin: "https://attacker.example" },
    });
    expect(() => requireSameOriginRequest(missing)).toThrow(/explicit same-origin/);
    expect(() => requireSameOriginRequest(crossOrigin)).toThrow(/Cross-origin/);
  });
});
