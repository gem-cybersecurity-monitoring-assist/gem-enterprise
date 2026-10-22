import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectContentSourceKind,
  deriveContentLane,
  evaluateContentLaneDestination,
  readContentLaneMetadata,
} from "@/lib/social-media/orchestration/content-lanes";
import { generateCrossPlatformContentPackage } from "@/lib/social-media/orchestration/content-package";
import type {
  ApprovedSourceMaterial,
  DailyContentDraft,
  MarketSignal,
} from "@/lib/social-media/planning/daily-flow";
import type { SocialContentType } from "@/lib/social-media/policy";
import type { SocialMediaProviderId } from "@/lib/social-media/providers";

const approvedSource: ApprovedSourceMaterial = {
  id: "gem:security-readiness",
  title: "GEM security readiness",
  summary:
    "GEM helps qualified organizations review access, exposure, incident readiness, and practical security controls.",
  callToAction: "Review the GEM security readiness resources.",
  sourceReference: "https://www.gemcybersecurityassist.com/resources",
  approvedAt: new Date("2026-09-29T00:00:00.000Z"),
  approved: true,
};

function signal(
  sourceReference: string,
  contentLaneHint?: MarketSignal["contentLaneHint"],
  extras: Partial<MarketSignal> = {},
): MarketSignal {
  return {
    id: "signal:1",
    topic: "Fresh cybersecurity development",
    summary:
      "A current public development is receiving attention and needs a concise, verified explanation for business audiences.",
    relevance: 0.9,
    momentum: 0.8,
    observedAt: new Date("2026-09-29T00:00:00.000Z"),
    sourceReference,
    contentLaneHint,
    ...extras,
  };
}

function draft(
  provider: SocialMediaProviderId,
  contentType: SocialContentType,
): DailyContentDraft {
  return {
    sequence: 1,
    provider,
    contentType,
    topic: "Fresh cybersecurity development",
    angle: "what changed today",
    sourceMaterialId: approvedSource.id,
    sourceReference: approvedSource.sourceReference,
    signalId: "signal:1",
    fingerprint: `fingerprint-${provider}-${contentType}`,
    approvalRequired: true,
    complianceReviewRequired: true,
    externalActionTaken: false,
    humanInteraction: {
      required: true,
      responseMode: "REAL_TIME",
      livePerformanceReviewRequired: true,
    },
  };
}

describe("social content lane router", () => {
  it("recognizes X and Threads as repurposing sources", () => {
    expect(detectContentSourceKind("https://x.com/source/status/1")).toBe("X");
    expect(
      detectContentSourceKind("https://www.threads.net/@source/post/1"),
    ).toBe("THREADS");
  });

  it("does not mistake lookalike hosts or paths for X and Threads", () => {
    expect(
      detectContentSourceKind("https://notx.com/path/x.com/source/status/1"),
    ).toBe("OTHER");
    expect(
      detectContentSourceKind("https://example.com/threads.net/@source/post/1"),
    ).toBe("OTHER");
  });

  it("routes fresh X and Threads items into the TikTok viral repurposing lane", () => {
    expect(
      deriveContentLane({
        provider: "TIKTOK",
        contentType: "SHORT_VIDEO",
        signalReference: "https://x.com/source/status/1",
        observedAt: new Date("2026-09-29T00:00:00.000Z"),
        evaluatedAt: new Date("2026-09-29T12:00:00.000Z"),
      }),
    ).toBe("TIKTOK_VIRAL_REPURPOSE");

    expect(
      deriveContentLane({
        provider: "TIKTOK",
        contentType: "PHOTO_POST",
        signalReference: "https://www.threads.net/@source/post/1",
        observedAt: new Date("2026-09-29T00:00:00.000Z"),
        evaluatedAt: new Date("2026-09-29T12:00:00.000Z"),
      }),
    ).toBe("TIKTOK_VIRAL_REPURPOSE");
  });

  it("keeps stale X and Threads signals out of the viral lane", () => {
    expect(
      deriveContentLane({
        provider: "TIKTOK",
        contentType: "SHORT_VIDEO",
        signalReference: "https://x.com/source/status/1",
        observedAt: new Date("2026-09-20T00:00:00.000Z"),
        evaluatedAt: new Date("2026-09-29T12:00:00.000Z"),
      }),
    ).toBe("STANDARD_GOVERNED");
  });

  it("keeps YouTube faceless cinematic production as a separate lane", () => {
    expect(
      deriveContentLane({
        provider: "YOUTUBE",
        contentType: "LONG_VIDEO",
        signalReference: "https://example.com/story",
        laneHint: "FACELESS_CINEMATIC",
      }),
    ).toBe("FACELESS_CINEMATIC");

    expect(
      deriveContentLane({
        provider: "YOUTUBE",
        contentType: "LONG_VIDEO",
        signalReference: "https://example.com/story",
      }),
    ).toBe("STANDARD_GOVERNED");
  });

  it("blocks content from being routed to the wrong destination", () => {
    const repurposeToYouTube = evaluateContentLaneDestination({
      lane: "TIKTOK_VIRAL_REPURPOSE",
      provider: "YOUTUBE",
      sourceKind: "X",
    });
    expect(repurposeToYouTube.allowed).toBe(false);
    expect(repurposeToYouTube.reasons).toContain(
      "CONTENT_LANE_DESTINATION_MISMATCH",
    );

    const facelessToTikTok = evaluateContentLaneDestination({
      lane: "FACELESS_CINEMATIC",
      provider: "TIKTOK",
      sourceKind: "OTHER",
    });
    expect(facelessToTikTok.allowed).toBe(false);
    expect(facelessToTikTok.reasons).toContain(
      "FACELESS_PRIMARY_DESTINATION_REQUIRED",
    );
  });

  it("blocks TikTok repurposing until transformed source copy is verified", () => {
    const pkg = generateCrossPlatformContentPackage({
      draft: {
        ...draft("TIKTOK", "SHORT_VIDEO"),
        contentLane: "TIKTOK_VIRAL_REPURPOSE",
      },
      source: approvedSource,
      signal: signal("https://x.com/source/status/1"),
    });

    expect(
      pkg.riskFlags.some(
        (flag) =>
          flag.code === "SOURCE_TRANSFORMATION_UNVERIFIED" &&
          flag.severity === "BLOCK",
      ),
    ).toBe(true);
  });

  it("builds verified transformed TikTok packages without copying raw source narration", () => {
    const rawSummary =
      "Verbatim source wording that must not become publishable narration.";
    const transformedSummary =
      "GEM explains the underlying development in original editorial language.";
    const pkg = generateCrossPlatformContentPackage({
      draft: {
        ...draft("TIKTOK", "SHORT_VIDEO"),
        contentLane: "TIKTOK_VIRAL_REPURPOSE",
      },
      source: approvedSource,
      signal: signal("https://x.com/source/status/1", undefined, {
        summary: rawSummary,
        transformedSummary,
        sourceTransformationVerified: true,
      }),
    });

    expect(pkg.contentLane).toBe("TIKTOK_VIRAL_REPURPOSE");
    expect(pkg.sourceEvidence.sourceKind).toBe("X");
    expect(pkg.sourceEvidence.transformationRequired).toBe(true);
    expect(pkg.sourceEvidence.attributionRequired).toBe(true);
    expect(
      pkg.shortVideo.rendererInput.sourceTransformationRequired,
    ).toBe(true);
    expect(
      pkg.publishingChecklist.some(
        (item) => item.code === "SOURCE_TRANSFORMED",
      ),
    ).toBe(true);
    expect(pkg.shortVideo.script).toContain(transformedSummary);
    expect(pkg.shortVideo.script).not.toContain(rawSummary);
    expect(pkg.sourceEvidence.sourceTransformationVerified).toBe(true);
    expect(
      pkg.riskFlags.some(
        (flag) => flag.code === "SOURCE_TRANSFORMATION_VERIFIED",
      ),
    ).toBe(true);
  });

  it("builds faceless cinematic YouTube packages with disclosure metadata", () => {
    const pkg = generateCrossPlatformContentPackage({
      draft: draft("YOUTUBE", "LONG_VIDEO"),
      source: approvedSource,
      signal: signal(
        "https://example.com/original-concept",
        "FACELESS_CINEMATIC",
      ),
    });

    expect(pkg.contentLane).toBe("FACELESS_CINEMATIC");
    expect(pkg.shortVideo.format).toBe("LANDSCAPE");
    expect(pkg.shortVideo.rendererInput.aigcDisclosureRequired).toBe(true);
    expect(pkg.shortVideo.rendererInput.aigcDisclosureApplied).toBe(false);
    expect(pkg.shortVideo.rendererInput.originalConceptRequired).toBe(true);
    expect(
      pkg.shortVideo.scenes.every(
        (scene) => scene.humanPresence === "OPTIONAL",
      ),
    ).toBe(true);
    expect(
      pkg.publishingChecklist.some(
        (item) => item.code === "AIGC_DISCLOSURE",
      ),
    ).toBe(true);
    expect(
      pkg.riskFlags.some((flag) => flag.code === "AIGC_DISCLOSURE_REQUIRED"),
    ).toBe(true);
  });

  it("retains lane control requirements in persisted renderer metadata", () => {
    const metadata = readContentLaneMetadata({
      videoRecipe: {
        rendererInput: {
          contentLane: "FACELESS_CINEMATIC",
          sourceKind: "OTHER",
          routingPolicyVersion: "test-policy",
          aigcDisclosureRequired: true,
          sourceTransformationRequired: false,
          sourceAttributionRequired: true,
          originalConceptRequired: true,
        },
      },
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        lane: "FACELESS_CINEMATIC",
        policyVersion: "test-policy",
        aigcDisclosureRequired: true,
        sourceTransformationRequired: false,
        sourceAttributionRequired: true,
        originalConceptRequired: true,
      }),
    );
  });

  it("rejects unknown lane metadata instead of falling back open", () => {
    expect(
      readContentLaneMetadata({
        videoRecipe: {
          rendererInput: {
            contentLane: "FUTURE_UNKNOWN_LANE",
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        metadataValid: false,
        invalidReason: "UNKNOWN_CONTENT_LANE",
      }),
    );
  });

  it("requires verified transformation and disclosure before special-lane publication", () => {
    expect(
      evaluateContentLaneDestination({
        lane: "TIKTOK_VIRAL_REPURPOSE",
        provider: "TIKTOK",
        sourceKind: "X",
        sourceTransformationVerified: false,
      }).reasons,
    ).toContain("SOURCE_TRANSFORMATION_UNVERIFIED");

    expect(
      evaluateContentLaneDestination({
        lane: "FACELESS_CINEMATIC",
        provider: "YOUTUBE",
        sourceKind: "OTHER",
        aigcDisclosureApplied: false,
      }).reasons,
    ).toContain("AIGC_DISCLOSURE_UNVERIFIED");
  });

  it("treats older content without lane metadata as standard governed content", () => {
    expect(readContentLaneMetadata({})).toEqual(
      expect.objectContaining({
        lane: "STANDARD_GOVERNED",
        sourceKind: "OTHER",
      }),
    );
  });

  it("exposes faceless and transformed-source inputs at the daily request boundary", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/api/social-media/orchestrator/daily/route.ts",
      ),
      "utf8",
    );
    expect(source).toContain('contentLaneHint: z.literal("FACELESS_CINEMATIC")');
    expect(source).toContain("transformedSummary");
    expect(source).toContain("sourceTransformationVerified");
  });

  it("enforces lane guards at shared, worker, and TokMetric queue boundaries", () => {
    const sharedQueue = readFileSync(
      join(
        process.cwd(),
        "src/app/api/social-media/publishing/jobs/route.ts",
      ),
      "utf8",
    );
    const worker = readFileSync(
      join(process.cwd(), "src/lib/social-media/publishing/worker.ts"),
      "utf8",
    );
    const tokmetric = readFileSync(
      join(process.cwd(), "src/lib/tokmetric/workflow.ts"),
      "utf8",
    );

    for (const source of [sharedQueue, worker, tokmetric]) {
      expect(source).toContain("evaluateContentLaneDestination");
      expect(source).toContain("CONTENT_LANE_METADATA_INVALID");
      expect(source).toContain("CONTENT_LANE_PUBLISHING_BLOCKED");
    }
  });

  it("enforces the lane route guard before shared autopilot queue creation", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/social-media/autopilot/service.ts",
      ),
      "utf8",
    );
    expect(source).toContain("evaluateContentLaneDestination");
    expect(source).toContain("laneRouting.reasons.map");
    expect(source).toContain("routingPolicyVersion");
    expect(source).toContain("aigcDisclosureRequired");
    expect(source).toContain("sourceTransformationRequired");
    expect(source).toContain("let queuedForProvider = 0");
    expect(source).toContain("count: Math.min(remaining, providerItems.length)");
    expect(source).not.toContain(".slice(0, remaining)");
  });
});
