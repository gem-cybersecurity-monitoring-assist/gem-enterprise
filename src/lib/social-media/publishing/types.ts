import type { SocialContentType } from "@/lib/social-media/policy";

export const sharedSocialPublishingProviders = [
  "FACEBOOK_PAGE",
  "INSTAGRAM_PROFESSIONAL",
  "X",
  "LINKEDIN_COMPANY",
  "YOUTUBE",
  "NEXTDOOR",
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
