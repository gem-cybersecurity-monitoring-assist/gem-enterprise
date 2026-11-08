/**
 * Shared social publishing job row mapping.
 *
 * The Prisma store and the gateway-backed store must convert rows to
 * SocialPublishingJobRecord through exactly one mapping, so the mapper
 * lives here. The Prisma path passes its raw row (Date objects from the
 * driver); the gateway path passes a JSON row (ISO strings from PostgREST)
 * through reviveJobRow first, which converts the timestamp fields to Dates
 * and then calls the same job() mapper.
 */
import type { SocialContentType } from "@/lib/social-media/policy";
import type {
  SharedSocialPublishingProvider,
  SocialPublishingJobRecord,
  SocialPublishingJobState,
  SocialPublishingPayload,
} from "./types";

export interface SocialPublishingJobRow {
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
  payload: unknown;
  localContext: string | null;
  state: SocialPublishingJobState;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  claimId: string | null;
  claimExpiresAt: Date | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  safeProviderMetadata: unknown;
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

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function job(row: SocialPublishingJobRow): SocialPublishingJobRecord {
  return {
    ...row,
    payload: object(row.payload) as SocialPublishingPayload,
    safeProviderMetadata: object(row.safeProviderMetadata),
  };
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Convert a gateway JSON job row (camelCase keys, ISO timestamp strings,
 * exactly the shape the gem_social_* RPCs return) into a
 * SocialPublishingJobRecord through the shared job() mapper. Throws on a
 * malformed row instead of returning a record with missing timestamps.
 */
export function reviveJobRow(raw: Record<string, unknown>): SocialPublishingJobRecord {
  const createdAt = toDate(raw.createdAt);
  const updatedAt = toDate(raw.updatedAt);
  if (!createdAt || !updatedAt) {
    throw new Error("Gateway returned a malformed publishing job row.");
  }
  const row: SocialPublishingJobRow = {
    id: String(raw.id ?? ""),
    workspaceId: String(raw.workspaceId ?? ""),
    provider: raw.provider as SharedSocialPublishingProvider,
    connectorId: String(raw.connectorId ?? ""),
    contentType: raw.contentType as SocialContentType,
    contentVersionHash: String(raw.contentVersionHash ?? ""),
    approvedVersionHash: String(raw.approvedVersionHash ?? ""),
    approvalId: String(raw.approvalId ?? ""),
    complianceReviewId: String(raw.complianceReviewId ?? ""),
    compliancePassed: raw.compliancePassed === true,
    idempotencyKey: String(raw.idempotencyKey ?? ""),
    payload: raw.payload,
    localContext: toNullableString(raw.localContext),
    state: raw.state as SocialPublishingJobState,
    attemptCount: typeof raw.attemptCount === "number" ? raw.attemptCount : 0,
    maxAttempts: typeof raw.maxAttempts === "number" ? raw.maxAttempts : 3,
    nextAttemptAt: toDate(raw.nextAttemptAt) ?? createdAt,
    claimId: toNullableString(raw.claimId),
    claimExpiresAt: toDate(raw.claimExpiresAt),
    externalPostId: toNullableString(raw.externalPostId),
    externalPostUrl: toNullableString(raw.externalPostUrl),
    safeProviderMetadata: raw.safeProviderMetadata,
    lastErrorCode: toNullableString(raw.lastErrorCode),
    lastErrorMessage: toNullableString(raw.lastErrorMessage),
    requestedById: toNullableString(raw.requestedById),
    scheduledFor: toDate(raw.scheduledFor),
    claimedAt: toDate(raw.claimedAt),
    submittedAt: toDate(raw.submittedAt),
    completedAt: toDate(raw.completedAt),
    createdAt,
    updatedAt,
  };
  return job(row);
}
