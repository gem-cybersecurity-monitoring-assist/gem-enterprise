import type { SocialContentType } from "../policy";
import {
  socialMediaProviderIds,
  type SocialMediaProviderId,
} from "../providers";

export const SOCIAL_CONTENT_ROUTING_POLICY_VERSION = "2026-09-29.v2";
export const VIRAL_SOURCE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export const socialContentLanes = [
  "TIKTOK_VIRAL_REPURPOSE",
  "FACELESS_CINEMATIC",
  "STANDARD_GOVERNED",
] as const;

export type SocialContentLane = (typeof socialContentLanes)[number];

export type SocialContentSourceKind =
  | "X"
  | "THREADS"
  | "NEWS"
  | "GEM"
  | "OTHER";

export interface SocialContentLaneDecision {
  lane: SocialContentLane;
  sourceKind: SocialContentSourceKind;
  allowedProviders: readonly SocialMediaProviderId[];
  aigcDisclosureRequired: boolean;
  sourceTransformationRequired: boolean;
  sourceAttributionRequired: boolean;
  originalConceptRequired: boolean;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function detectContentSourceKind(
  sourceReference: string | undefined,
): SocialContentSourceKind {
  const reference = sourceReference?.trim().toLowerCase() ?? "";
  if (!reference) return "OTHER";
  if (reference.startsWith("x:")) return "X";
  if (reference.startsWith("threads:")) return "THREADS";
  if (reference.startsWith("news:")) return "NEWS";
  if (reference.startsWith("gem:")) return "GEM";

  try {
    const hostname = new URL(reference).hostname.toLowerCase();
    if (
      ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"].includes(
        hostname,
      )
    ) {
      return "X";
    }
    if (["threads.net", "www.threads.net"].includes(hostname)) {
      return "THREADS";
    }
    if (
      ["gemcybersecurityassist.com", "www.gemcybersecurityassist.com"].includes(
        hostname,
      )
    ) {
      return "GEM";
    }
  } catch {
    // Non-URL references fall through to OTHER unless they use an explicit prefix above.
  }

  return "OTHER";
}

export function deriveContentLane(input: {
  provider: SocialMediaProviderId;
  contentType: SocialContentType;
  signalReference?: string;
  laneHint?: SocialContentLane;
  observedAt?: Date;
  evaluatedAt?: Date;
}): SocialContentLane {
  const sourceKind = detectContentSourceKind(input.signalReference);
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const observedAt = input.observedAt;
  const freshSource =
    Boolean(observedAt) &&
    observedAt!.getTime() <= evaluatedAt.getTime() &&
    evaluatedAt.getTime() - observedAt!.getTime() <= VIRAL_SOURCE_MAX_AGE_MS;

  if (
    input.provider === "TIKTOK" &&
    (sourceKind === "X" || sourceKind === "THREADS") &&
    freshSource
  ) {
    return "TIKTOK_VIRAL_REPURPOSE";
  }
  if (
    input.laneHint === "FACELESS_CINEMATIC" &&
    input.provider === "YOUTUBE" &&
    ["SHORT_VIDEO", "LONG_VIDEO"].includes(input.contentType)
  ) {
    return "FACELESS_CINEMATIC";
  }
  return "STANDARD_GOVERNED";
}

export function getContentLaneDecision(input: {
  lane: SocialContentLane;
  sourceKind: SocialContentSourceKind;
}): SocialContentLaneDecision {
  if (input.lane === "TIKTOK_VIRAL_REPURPOSE") {
    return {
      lane: input.lane,
      sourceKind: input.sourceKind,
      allowedProviders: ["TIKTOK"],
      aigcDisclosureRequired: false,
      sourceTransformationRequired: true,
      sourceAttributionRequired: true,
      originalConceptRequired: false,
    };
  }
  if (input.lane === "FACELESS_CINEMATIC") {
    return {
      lane: input.lane,
      sourceKind: input.sourceKind,
      allowedProviders: ["YOUTUBE"],
      aigcDisclosureRequired: true,
      sourceTransformationRequired: false,
      sourceAttributionRequired: true,
      originalConceptRequired: true,
    };
  }
  return {
    lane: input.lane,
    sourceKind: input.sourceKind,
    allowedProviders: socialMediaProviderIds,
    aigcDisclosureRequired: false,
    sourceTransformationRequired: false,
    sourceAttributionRequired: false,
    originalConceptRequired: false,
  };
}

export function evaluateContentLaneDestination(input: {
  lane: SocialContentLane;
  provider: SocialMediaProviderId;
  sourceKind: SocialContentSourceKind;
  sourceTransformationVerified?: boolean;
  aigcDisclosureApplied?: boolean;
}) {
  const decision = getContentLaneDecision({
    lane: input.lane,
    sourceKind: input.sourceKind,
  });
  const reasons: string[] = [];

  if (!decision.allowedProviders.includes(input.provider)) {
    reasons.push("CONTENT_LANE_DESTINATION_MISMATCH");
  }
  if (
    input.lane === "TIKTOK_VIRAL_REPURPOSE" &&
    input.sourceKind !== "X" &&
    input.sourceKind !== "THREADS"
  ) {
    reasons.push("REPURPOSE_SOURCE_NOT_APPROVED");
  }
  if (input.lane === "FACELESS_CINEMATIC" && input.provider !== "YOUTUBE") {
    reasons.push("FACELESS_PRIMARY_DESTINATION_REQUIRED");
  }
  if (
    decision.sourceTransformationRequired &&
    input.sourceTransformationVerified !== true
  ) {
    reasons.push("SOURCE_TRANSFORMATION_UNVERIFIED");
  }
  if (
    decision.aigcDisclosureRequired &&
    input.aigcDisclosureApplied !== true
  ) {
    reasons.push("AIGC_DISCLOSURE_UNVERIFIED");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    decision,
    policyVersion: SOCIAL_CONTENT_ROUTING_POLICY_VERSION,
  };
}

export function readContentLaneMetadata(settings: unknown) {
  const root = object(settings);
  const videoRecipe = object(root.videoRecipe);
  const rendererInput = object(videoRecipe.rendererInput);
  const sourceEvidence = object(root.sourceEvidence);

  const rawLane = clean(rendererInput.contentLane);
  const metadataValid =
    !rawLane || socialContentLanes.includes(rawLane as SocialContentLane);
  const lane =
    rawLane && metadataValid
      ? (rawLane as SocialContentLane)
      : "STANDARD_GOVERNED";

  const rawSourceKind =
    clean(rendererInput.sourceKind) ?? clean(sourceEvidence.sourceKind);
  const sourceKind = ["X", "THREADS", "NEWS", "GEM", "OTHER"].includes(
    rawSourceKind ?? "",
  )
    ? (rawSourceKind as SocialContentSourceKind)
    : "OTHER";

  const defaults = getContentLaneDecision({ lane, sourceKind });
  const booleanMetadata = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;
  const sourceTransformationVerified = booleanMetadata(
    rendererInput.sourceTransformationVerified ??
      sourceEvidence.sourceTransformationVerified,
    false,
  );
  const aigcDisclosureApplied = booleanMetadata(
    root.syntheticContentDisclosureApplied ??
      rendererInput.aigcDisclosureApplied,
    false,
  );

  return {
    lane,
    sourceKind,
    metadataValid,
    invalidReason: metadataValid ? undefined : "UNKNOWN_CONTENT_LANE",
    policyVersion:
      clean(rendererInput.routingPolicyVersion) ??
      SOCIAL_CONTENT_ROUTING_POLICY_VERSION,
    aigcDisclosureRequired: booleanMetadata(
      rendererInput.aigcDisclosureRequired,
      defaults.aigcDisclosureRequired,
    ),
    aigcDisclosureApplied,
    sourceTransformationRequired: booleanMetadata(
      rendererInput.sourceTransformationRequired,
      defaults.sourceTransformationRequired,
    ),
    sourceTransformationVerified,
    sourceAttributionRequired: booleanMetadata(
      rendererInput.sourceAttributionRequired,
      defaults.sourceAttributionRequired,
    ),
    originalConceptRequired: booleanMetadata(
      rendererInput.originalConceptRequired,
      defaults.originalConceptRequired,
    ),
  };
}
