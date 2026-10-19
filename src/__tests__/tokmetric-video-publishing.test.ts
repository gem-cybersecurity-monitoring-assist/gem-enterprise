import { afterEach, describe, expect, it } from "vitest";
import {
  calculateTikTokChunkPlan,
  chunkByteRange,
} from "@/lib/tokmetric/publishing/types";
import { getTokMetricPublishingGate } from "@/lib/tokmetric/publishing/gates";
import { validateVerifiedMediaUrl } from "@/lib/tokmetric/publishing/service";

const originalEnv = { ...process.env };

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
