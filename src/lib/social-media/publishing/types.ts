import type { SocialContentType } from "@/lib/social-media/policy";

export const sharedSocialPublishingProviders = [
  "FACEBOOK_PAGE",
  "INSTAGRAM_PROFESSIONAL",
  "X",
  "LINKEDIN_COMPANY",
  "YOUTUBE",
  "NEXTDOOR",
  "TELEGRAM",
] as const;

export type SharedSocialPublishingProvider =
  (typeof sharedSocialPublishingProviders)[number];

export const socialPublishingJobStates = [
  "PENDING",
  "CLAIMED",
  "RETRYING",
  "PUBLISHED",
  "FAILED",
  "DEAD_LETTER",
  "BLOCKED",
  "CANCELLED",
] as const;

export type SocialPublishingJobState =
  (typeof socialPublishingJobStates)[number];

export interface SocialPublishingPayload {
  text?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  mediaUrls?: string[];
  altText?: string;
  thread?: string[];
  localContext?: string;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  syntheticContentDisclosure?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SocialPublishingJobRecord {
  id: string;
  workspaceId: string;
  provider: SharedSocialPublishingProvider;
  connectorId: string;
  contentType: SocialContentType;
  contentVersionHash: string;
  approvedVersionHash: string;
  approvalId: string;
  complianceReviewId: string;
  compliancePassed: boolean;
  idempotencyKey: string;
  payload: SocialPublishingPayload;
  localContext: string | null;
  state: SocialPublishingJobState;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  claimId: string | null;
  claimExpiresAt: Date | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  safeProviderMetadata: Record<string, unknown>;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  requestedById: string | null;
  scheduledFor: Date | null;
  claimedAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialPublishingAdapterInput {
  job: SocialPublishingJobRecord;
  accessToken: string;
  externalAccountId: string;
  connectorMetadata: Record<string, unknown>;
}

export interface SocialPublishingAdapterResult {
  externalPostId: string;
  externalPostUrl?: string;
  providerStatusCode?: number;
  safeMetadata?: Record<string, unknown>;
}

/**
 * Publication verification outcome. Recorded inside the job's
 * safeProviderMetadata under the "verification" key (no schema migration
 * required). A job is only PUBLISHED when dispatch succeeded AND verification
 * passed or was not applicable for the provider.
 */
export interface SocialPublicationVerification {
  verificationOk: boolean;
  verifiedAt: string;
  permalink?: string;
  method: "READ_BACK" | "NOT_APPLICABLE";
  detail?: string;
}

export function readJobVerification(
  safeProviderMetadata: Record<string, unknown>,
): SocialPublicationVerification | null {
  const raw = safeProviderMetadata.verification;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.verificationOk !== "boolean") return null;
  if (typeof record.verifiedAt !== "string") return null;
  return {
    verificationOk: record.verificationOk,
    verifiedAt: record.verifiedAt,
    permalink:
      typeof record.permalink === "string" ? record.permalink : undefined,
    method: record.method === "READ_BACK" ? "READ_BACK" : "NOT_APPLICABLE",
    detail: typeof record.detail === "string" ? record.detail : undefined,
  };
}
