/**
 * Gateway-backed replacements for the publishing worker's non-store
 * database calls, with the same signatures as the Prisma implementations
 * they replace.
 *
 * The gateway branches now live in the original modules, which are
 * transport-aware: lifecycle-store.ts (credential load),
 * provider-pause.ts (pause state), and tokmetric/security.ts (emergency
 * locks, audit) each branch on shouldUseSupabaseGateway() internally and
 * run the Prisma path unchanged on a direct database. That direction
 * matters: the originals cannot import these helpers (gateway-worker-deps
 * imports the originals for the governance Prisma path), so the helpers
 * here are thin re-exports of the transport-aware originals, kept so the
 * worker-deps import surface the adapter established — and the adapter
 * tests that assert the forwarding — keep working. The worker itself
 * imports the originals directly and needs no change.
 *
 * The one helper with no original module is loadSocialPublishingGovernanceEvidence
 * below: the governance reads belong to the worker, so both branches live here.
 *
 * Credential load: the gateway returns the raw row INCLUDING the secretRef
 * ciphertext, and the existing decrypt + consistency check runs in Node in
 * lifecycle-store.ts — the encryption key never leaves Vercel. The
 * TELEGRAM / BOT_TOKEN provider parse is the merged #468 fix
 * (parseSocialConnectorProvider); this module builds on it, it does not
 * re-implement it.
 *
 * Audit stays best-effort: the worker's audit() helper swallows failures,
 * exactly as on the Prisma path.
 */
import { GatewayRequestError, shouldUseSupabaseGateway } from "@/lib/supabase-gateway";
import { db } from "@/lib/db";
import { TokMetricError } from "@/lib/tokmetric/security";
import { socialPublishingGateway } from "./gateway-client";
import type { SocialPublishingJobRecord } from "./types";

// The four worker calls whose gateway branches live in the original
// modules (see the header comment): re-exported here so the worker-deps
// import surface stays stable. Each original branches on
// shouldUseSupabaseGateway() internally; on a direct database it runs the
// exact Prisma implementation it always ran.
export { loadSocialConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
export {
  emitTokMetricAudit,
  enforceEmergencyLocks,
} from "@/lib/tokmetric/security";
export { isSocialProviderPaused } from "@/lib/social-media/oauth/provider-pause";

function gatewayError(error: unknown): never {
  if (error instanceof GatewayRequestError) {
    throw new TokMetricError(error.statusCode, error.code, error.message);
  }
  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// --- Governance evidence -------------------------------------------------
// Row shapes match the Prisma payloads the worker's derivation reads.
// The Prisma path returns the findFirst rows directly (structurally
// assignable); the gateway path revives the RPC's JSON rows into the same
// shapes.

export interface SocialPublishingGovernanceContent {
  id: string;
  workspaceId: string;
  campaignId: string | null;
  ownerId: string | null;
  title: string;
  state: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialPublishingGovernanceContentVersion {
  id: string;
  contentId: string;
  version: number;
  objectHash: string;
  script: string | null;
  caption: string | null;
  hashtags: string[];
  settings: unknown;
  mediaAssetIds: string[];
  createdById: string | null;
  createdAt: Date;
}

export interface SocialPublishingGovernanceDecision {
  id: string;
  approvalRequestId: string;
  actorId: string | null;
  decision: string;
  objectHash: string;
  reason: string | null;
  createdAt: Date;
}

export interface SocialPublishingGovernanceApproval {
  id: string;
  workspaceId: string;
  contentId: string | null;
  contentVersionId: string | null;
  requestedById: string | null;
  requiredRole: string;
  action: string;
  objectHash: string;
  state: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  content: SocialPublishingGovernanceContent | null;
  contentVersion: SocialPublishingGovernanceContentVersion | null;
  decisions: SocialPublishingGovernanceDecision[];
}

export interface SocialPublishingGovernanceComplianceReview {
  id: string;
  workspaceId: string;
  contentId: string | null;
  contentVersionId: string | null;
  policyVersionId: string | null;
  result: string;
  findings: unknown;
  reviewerId: string | null;
  createdAt: Date;
}

export interface SocialPublishingGovernanceEvidence {
  approval: SocialPublishingGovernanceApproval | null;
  complianceReview: SocialPublishingGovernanceComplianceReview | null;
}

function reviveGovernanceApproval(
  raw: unknown,
): SocialPublishingGovernanceApproval | null {
  if (!isRecord(raw)) return null;
  const createdAt = toDate(raw.createdAt);
  const updatedAt = toDate(raw.updatedAt);
  if (!createdAt || !updatedAt) return null;
  const contentRaw = raw.content;
  const content: SocialPublishingGovernanceContent | null =
    isRecord(contentRaw) &&
    toDate(contentRaw.createdAt) &&
    toDate(contentRaw.updatedAt)
      ? {
          id: String(contentRaw.id ?? ""),
          workspaceId: String(contentRaw.workspaceId ?? ""),
          campaignId: toNullableString(contentRaw.campaignId),
          ownerId: toNullableString(contentRaw.ownerId),
          title: String(contentRaw.title ?? ""),
          state: String(contentRaw.state ?? ""),
          currentVersionId: toNullableString(contentRaw.currentVersionId),
          createdAt: toDate(contentRaw.createdAt) as Date,
          updatedAt: toDate(contentRaw.updatedAt) as Date,
        }
      : null;
  const versionRaw = raw.contentVersion;
  const contentVersion: SocialPublishingGovernanceContentVersion | null =
    isRecord(versionRaw) && toDate(versionRaw.createdAt)
      ? {
          id: String(versionRaw.id ?? ""),
          contentId: String(versionRaw.contentId ?? ""),
          version: typeof versionRaw.version === "number" ? versionRaw.version : 0,
          objectHash: String(versionRaw.objectHash ?? ""),
          script: toNullableString(versionRaw.script),
          caption: toNullableString(versionRaw.caption),
          hashtags: Array.isArray(versionRaw.hashtags)
            ? (versionRaw.hashtags.filter(
                (entry): entry is string => typeof entry === "string",
              ) as string[])
            : [],
          settings: versionRaw.settings ?? {},
          mediaAssetIds: Array.isArray(versionRaw.mediaAssetIds)
            ? (versionRaw.mediaAssetIds.filter(
                (entry): entry is string => typeof entry === "string",
              ) as string[])
            : [],
          createdById: toNullableString(versionRaw.createdById),
          createdAt: toDate(versionRaw.createdAt) as Date,
        }
      : null;
  const decisions: SocialPublishingGovernanceDecision[] = Array.isArray(
    raw.decisions,
  )
    ? raw.decisions.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const decidedAt = toDate(entry.createdAt);
        if (!decidedAt) return [];
        return [
          {
            id: String(entry.id ?? ""),
            approvalRequestId: String(entry.approvalRequestId ?? ""),
            actorId: toNullableString(entry.actorId),
            decision: String(entry.decision ?? ""),
            objectHash: String(entry.objectHash ?? ""),
            reason: toNullableString(entry.reason),
            createdAt: decidedAt,
          },
        ];
      })
    : [];
  return {
    id: String(raw.id ?? ""),
    workspaceId: String(raw.workspaceId ?? ""),
    contentId: toNullableString(raw.contentId),
    contentVersionId: toNullableString(raw.contentVersionId),
    requestedById: toNullableString(raw.requestedById),
    requiredRole: String(raw.requiredRole ?? ""),
    action: String(raw.action ?? ""),
    objectHash: String(raw.objectHash ?? ""),
    state: String(raw.state ?? ""),
    expiresAt: toDate(raw.expiresAt),
    createdAt,
    updatedAt,
    content,
    contentVersion,
    decisions,
  };
}

function reviveGovernanceComplianceReview(
  raw: unknown,
): SocialPublishingGovernanceComplianceReview | null {
  if (!isRecord(raw)) return null;
  const createdAt = toDate(raw.createdAt);
  if (!createdAt) return null;
  return {
    id: String(raw.id ?? ""),
    workspaceId: String(raw.workspaceId ?? ""),
    contentId: toNullableString(raw.contentId),
    contentVersionId: toNullableString(raw.contentVersionId),
    policyVersionId: toNullableString(raw.policyVersionId),
    result: String(raw.result ?? ""),
    findings: raw.findings ?? [],
    reviewerId: toNullableString(raw.reviewerId),
    createdAt,
  };
}

/**
 * The two governance reads (approval + compliance) the worker derives
 * approvalValid / complianceValid from. The derivation stays in worker.ts;
 * this helper only supplies the rows, from Prisma or from the gateway.
 */
export async function loadSocialPublishingGovernanceEvidence(
  job: SocialPublishingJobRecord,
): Promise<SocialPublishingGovernanceEvidence> {
  if (!shouldUseSupabaseGateway()) {
    const [approval, complianceReview] = await Promise.all([
      db.approvalRequest.findFirst({
        where: {
          id: job.approvalId,
          workspaceId: job.workspaceId,
          objectHash: job.approvedVersionHash,
          state: "APPROVED",
        },
        include: {
          content: true,
          contentVersion: true,
          decisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.complianceReview.findFirst({
        where: {
          id: job.complianceReviewId,
          workspaceId: job.workspaceId,
          result: { in: ["PASS", "PASS_WITH_DISCLOSURE"] },
        },
      }),
    ]);
    return {
      approval: approval as SocialPublishingGovernanceApproval | null,
      complianceReview:
        complianceReview as SocialPublishingGovernanceComplianceReview | null,
    };
  }
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "governance_evidence",
      {
        approvalId: job.approvalId,
        workspaceId: job.workspaceId,
        approvedVersionHash: job.approvedVersionHash,
        complianceReviewId: job.complianceReviewId,
      },
    );
    return {
      approval: reviveGovernanceApproval(body.approval),
      complianceReview: reviveGovernanceComplianceReview(
        body.complianceReview,
      ),
    };
  } catch (error) {
    return gatewayError(error);
  }
}
