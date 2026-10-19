import type { SocialMediaProviderId } from "./providers";

export const socialContentTypes = [
  "SHORT_VIDEO",
  "LONG_VIDEO",
  "PHOTO_POST",
  "IMAGE",
  "CAROUSEL",
  "TEXT",
  "THREAD",
  "LINK",
  "ARTICLE",
  "LOCAL_UPDATE",
  "JOB_POSTING",
  "EMPLOYER_UPDATE",
  "JOB_LINK",
  "REEL",
] as const;

export type SocialContentType = (typeof socialContentTypes)[number];
export type SocialConnectorState =
  | "NOT_CONFIGURED"
  | "AUTHORIZATION_REQUIRED"
  | "CONNECTED"
  | "TOKEN_EXPIRED"
  | "DISABLED";

export interface SocialPublishingAuthorizationInput {
  provider: SocialMediaProviderId;
  contentType: SocialContentType;
  connectorState: SocialConnectorState;
  globalLivePublishingEnabled: boolean;
  providerPublishingEnabled: boolean;
  emergencyLockActive: boolean;
  compliancePassed: boolean;
  approvalId?: string | null;
  approvedVersionHash?: string | null;
  currentVersionHash?: string | null;
  idempotencyKey?: string | null;
  localContext?: string | null;
  vacancyId?: string | null;
}

export interface SocialPublishingAuthorizationResult {
  allowed: boolean;
  reasons: string[];
  externalActionTaken: false;
}

const providerContentPolicy: Record<SocialMediaProviderId, readonly SocialContentType[]> = {
  TIKTOK: ["SHORT_VIDEO", "PHOTO_POST"],
  FACEBOOK_PAGE: ["TEXT", "IMAGE", "SHORT_VIDEO", "LONG_VIDEO", "LINK"],
  INSTAGRAM_PROFESSIONAL: ["REEL", "IMAGE", "CAROUSEL"],
  X: ["TEXT", "IMAGE", "SHORT_VIDEO", "THREAD"],
  NEXTDOOR: ["LOCAL_UPDATE", "IMAGE", "LINK"],
  INDEED_EMPLOYER: ["JOB_POSTING", "EMPLOYER_UPDATE"],
  LINKEDIN_COMPANY: ["TEXT", "IMAGE", "SHORT_VIDEO", "LONG_VIDEO", "ARTICLE", "JOB_LINK"],
  YOUTUBE: ["SHORT_VIDEO", "LONG_VIDEO"],
};

export function evaluateSocialPublishingAuthorization(
  input: SocialPublishingAuthorizationInput,
): SocialPublishingAuthorizationResult {
  const reasons: string[] = [];

  if (input.emergencyLockActive) reasons.push("EMERGENCY_LOCK_ACTIVE");
  if (!input.globalLivePublishingEnabled) reasons.push("GLOBAL_LIVE_PUBLISHING_DISABLED");
  if (!input.providerPublishingEnabled) reasons.push("PROVIDER_PUBLISHING_DISABLED");
  if (input.connectorState !== "CONNECTED") reasons.push("CONNECTED_ACCOUNT_REQUIRED");
  if (!input.compliancePassed) reasons.push("COMPLIANCE_REVIEW_REQUIRED");
  if (!input.approvalId?.trim()) reasons.push("HUMAN_APPROVAL_REQUIRED");
  if (!input.idempotencyKey?.trim()) reasons.push("IDEMPOTENCY_KEY_REQUIRED");
  if (!input.approvedVersionHash?.trim() || !input.currentVersionHash?.trim()) {
    reasons.push("EXACT_VERSION_HASH_REQUIRED");
  } else if (input.approvedVersionHash !== input.currentVersionHash) {
    reasons.push("APPROVED_VERSION_MISMATCH");
  }

  if (!providerContentPolicy[input.provider].includes(input.contentType)) {
    reasons.push("CONTENT_TYPE_NOT_ALLOWED_FOR_PROVIDER");
  }

  if (input.provider === "NEXTDOOR" && !input.localContext?.trim()) {
    reasons.push("LOCAL_CONTEXT_REQUIRED");
  }

  if (
    input.provider === "INDEED_EMPLOYER" &&
    input.contentType === "JOB_POSTING" &&
    !input.vacancyId?.trim()
  ) {
    reasons.push("APPROVED_VACANCY_REQUIRED");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    externalActionTaken: false,
  };
}

export interface SocialContentPackageInput {
  title: string;
  summary: string;
  callToAction: string;
  sourceReference: string;
  targets: readonly SocialMediaProviderId[];
  contentType: SocialContentType;
}

export function createSocialContentPackage(input: SocialContentPackageInput) {
  const normalizedTargets = [...new Set(input.targets)];
  return {
    title: input.title.trim(),
    summary: input.summary.trim(),
    callToAction: input.callToAction.trim(),
    sourceReference: input.sourceReference.trim(),
    contentType: input.contentType,
    targets: normalizedTargets,
    state: "DRAFT" as const,
    approvalRequired: true,
    complianceReviewRequired: true,
    externalActionTaken: false as const,
  };
}
