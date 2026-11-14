import { describe, expect, it } from "vitest";
import { validateGemStorylineManifest } from "@/lib/video/storyline-ingestion";

function validInput() {
  return {
    storylineId: "gem-cyber-qr-code-trap",
    fileName: "gem-cyber-qr-code-trap.vertical_9x16.mp4",
    fileSize: 1024,
    checksumSha256: "a".repeat(64),
    manifest: {
      storyline: "gem-cyber-qr-code-trap",
      title: "QR Code Traps",
      vertical: "cybersecurity",
      status: "DRAFT_PENDING_APPROVAL",
      validation: { passed: true, failures: {} },
      disclosures: {
        syntheticVoice: true,
        voiceType: "synthetic_kokoro",
        aiGeneratedContent: true,
      },
      post: { caption: "Pause before you scan.", hashtags: ["#Cybersecurity"] },
      narration: [
        { beat: 0, role: "hook", voiceover: "Pause before you scan.", caption: "Pause first" },
        { beat: 1, role: "risk", voiceover: "A code can hide a link.", caption: "Hidden links" },
        { beat: 2, role: "cta", voiceover: "Check the destination.", caption: "Check the URL" },
      ],
      outputs: [{
        variant: "vertical_9x16",
        file: "gem-cyber-qr-code-trap.vertical_9x16.mp4",
        width: 1080,
        height: 1920,
        sha256: "a".repeat(64),
        bytes: 1024,
        durationSec: 28,
      }],
    },
  };
}

describe("GEM Storylines manifest ingestion", () => {
  it("accepts a validated Kokoro cybersecurity draft and returns its exact narration", () => {
    const result = validateGemStorylineManifest(validInput());
    expect(result.script).toContain("A code can hide a link.");
    expect(result.primary.fileName).toBe("gem-cyber-qr-code-trap.vertical_9x16.mp4");
    expect(result.disclosures.aiGeneratedContent).toBe(true);
  });

  it("rejects offline test-tone output", () => {
    const input = validInput();
    input.manifest.status = "OFFLINE_TEST_NOT_PUBLISHABLE";
    expect(() => validateGemStorylineManifest(input)).toThrow("offline test renders are not accepted");
  });

  it("rejects checksum or manifest mismatches", () => {
    const input = validInput();
    input.checksumSha256 = "b".repeat(64);
    expect(() => validateGemStorylineManifest(input)).toThrow("does not match the validated 9:16 render manifest");
  });

  it("rejects output without the explicit AIGC disclosure", () => {
    const input = validInput();
    input.manifest.disclosures.aiGeneratedContent = false;
    expect(() => validateGemStorylineManifest(input)).toThrow("Kokoro and AI-generated-content disclosures");
  });
});
