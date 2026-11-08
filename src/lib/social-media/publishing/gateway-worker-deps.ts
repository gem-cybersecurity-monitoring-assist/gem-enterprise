/**
 * Gateway-backed replacements for the publishing worker's non-store
 * database calls, with the same signatures as the Prisma implementations
 * they replace.
 *
 * Each helper is transport-aware: on a direct database it delegates to the
 * original module (identical behaviour); on the Supabase gateway it calls
 * the matching edge-function action. The worker only uses
 * loadSocialPublishingGovernanceEvidence today (the one worker edit the
 * design allows); the other four are built and tested here so the follow-up
 * that re-points the worker's remaining imports (credential load, emergency
 * locks, audit, pause) is a clean import swap with no new logic.
 *
 * Credential load: the gateway returns the raw row INCLUDING the secretRef
 * ciphertext, and the existing decrypt + consistency check runs here in
 * Node — the encryption key never leaves Vercel. The TELEGRAM / BOT_TOKEN
 * provider parse is the merged #468 fix (parseSocialConnectorProvider);
 * this module builds on it, it does not re-implement it.
 *
 * Audit stays best-effort: the worker's audit() helper swallows failures,
 * exactly as on the Prisma path.
 */
import { GatewayRequestError, shouldUseSupabaseGateway } from "@/lib/supabase-gateway";
import { db } from "@/lib/db";
import {
  emitTokMetricAudit as emitTokMetricAuditPrisma,
  enforceEmergencyLocks as enforceEmergencyLocksPrisma,
  redactSecrets,
  TokMetricError,
} from "@/lib/tokmetric/security";
import { loadSocialConnectorCredential as loadSocialConnectorCredentialPrisma } from "@/lib/social-media/oauth/lifecycle-store";
import {
  isSocialProviderPaused as isSocialProviderPausedPrisma,
  type SocialPauseProvider,
} from "@/lib/social-media/oauth/provider-pause";
import { decryptSocialCredential } from "@/lib/social-media/oauth/crypto";
import { parseSocialConnectorProvider } from "@/lib/social-media/oauth/config";
import type {
  SocialConnectorRecord,
  StoredSocialCredential,
} from "@/lib/social-media/oauth/store";
import { socialPublishingGateway } from "./gateway-client";
import type { SocialPublishingJobRecord } from "./types";

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

// --- Connector credential -------------------------------------------------

interface GatewayCredentialRow {
  id: string;
  workspaceId: string;
  provider: string;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  grantedScopes: string[];
  safeMetadata: Record<string, unknown>;
  lastHealthAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  secretRef: string;
  credentialExpiresAt: Date | null;
  credentialRefreshExpiresAt: Date | null;
  credentialRotatedAt: Date | null;
}

function reviveCredentialRow(
  raw: Record<string, unknown>,
): GatewayCredentialRow {
  const createdAt = toDate(raw.createdAt);
  const updatedAt = toDate(raw.updatedAt);
  if (!createdAt || !updatedAt) {
    throw new TokMetricError(
      500,
      "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
      "The social publishing gateway returned an unexpected response.",
    );
  }
  return {
    id: String(raw.id ?? ""),
    workspaceId: String(raw.workspaceId ?? ""),
    provider: String(raw.provider ?? ""),
    state: String(raw.state ?? ""),
    displayName: String(raw.displayName ?? ""),
    externalAccountId: toNullableString(raw.externalAccountId),
    grantedScopes: Array.isArray(raw.grantedScopes)
      ? (raw.grantedScopes.filter(
          (entry): entry is string => typeof entry === "string",
        ) as string[])
      : [],
    safeMetadata:
      isRecord(raw.safeMetadata) && !Array.isArray(raw.safeMetadata)
        ? raw.safeMetadata
        : {},
    lastHealthAt: toDate(raw.lastHealthAt),
    disabledAt: toDate(raw.disabledAt),
    createdAt,
    updatedAt,
    secretRef: String(raw.secretRef ?? ""),
    credentialExpiresAt: toDate(raw.credentialExpiresAt),
    credentialRefreshExpiresAt: toDate(raw.credentialRefreshExpiresAt),
    credentialRotatedAt: toDate(raw.credentialRotatedAt),
  };
}

/**
 * Same signature and return shape as
 * loadSocialConnectorCredential in oauth/lifecycle-store.ts. On the gateway
 * the RPC returns the raw row including secretRef; decryption and the
 * provider/account consistency check run here in Node, unchanged.
 */
export async function loadSocialConnectorCredential(input: {
  workspaceId: string;
  connectorId: string;
}) {
  if (!shouldUseSupabaseGateway()) {
    return loadSocialConnectorCredentialPrisma(input);
  }
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "load_credential",
      { workspaceId: input.workspaceId, connectorId: input.connectorId },
    );
    if (!isRecord(body.row)) {
      throw new TokMetricError(
        500,
        "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
        "The social publishing gateway returned an unexpected response.",
      );
    }
    const row = reviveCredentialRow(body.row);
    // Stored connector providers include bot-token providers (Telegram) as
    // well as OAuth providers, so parse with the connector union (#468).
    const provider = parseSocialConnectorProvider(row.provider);
    const credential = decryptSocialCredential<StoredSocialCredential>(
      row.secretRef,
    );
    if (
      credential.provider !== provider ||
      credential.externalAccountId !== row.externalAccountId
    ) {
      throw new TokMetricError(
        409,
        "SOCIAL_CONNECTOR_CREDENTIAL_MISMATCH",
        "Stored connector authorization does not match the selected provider account.",
      );
    }
    return {
      connector: {
        id: row.id,
        workspaceId: row.workspaceId,
        provider,
        state: row.state,
        displayName: row.displayName,
        externalAccountId: row.externalAccountId,
        grantedScopes: row.grantedScopes,
        safeMetadata: row.safeMetadata,
        lastHealthAt: row.lastHealthAt,
        disabledAt: row.disabledAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies SocialConnectorRecord,
      credential,
      credentialRotatedAt: row.credentialRotatedAt
        ? row.credentialRotatedAt.toISOString()
        : null,
    };
  } catch (error) {
    if (error instanceof TokMetricError) throw error;
    return gatewayError(error);
  }
}

// --- Emergency locks ------------------------------------------------------

export async function enforceEmergencyLocks(
  workspaceId: string,
  action: "publish" | "advertise" | "shop_write" | "connector",
) {
  if (!shouldUseSupabaseGateway()) {
    return enforceEmergencyLocksPrisma(workspaceId, action);
  }
  try {
    await socialPublishingGateway<Record<string, unknown>>(
      "workspace_locks",
      { workspaceId, action },
    );
  } catch (error) {
    return gatewayError(error);
  }
}

// --- Audit ----------------------------------------------------------------

export async function emitTokMetricAudit(input: {
  workspaceId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  correlationId: string;
  outcome: string;
  metadata?: unknown;
  sourceChannel: string;
}) {
  if (!shouldUseSupabaseGateway()) {
    return emitTokMetricAuditPrisma(input);
  }
  try {
    await socialPublishingGateway<Record<string, unknown>>("audit_event", {
      workspaceId: input.workspaceId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      correlationId: input.correlationId,
      outcome: input.outcome,
      sourceChannel: input.sourceChannel,
      safeMetadata: redactSecrets(input.metadata ?? {}),
    });
  } catch (error) {
    return gatewayError(error);
  }
}

// --- Persistent provider pause ---------------------------------------------

export async function isSocialProviderPaused(
  workspaceId: string,
  provider: SocialPauseProvider,
): Promise<boolean> {
  if (!shouldUseSupabaseGateway()) {
    return isSocialProviderPausedPrisma(workspaceId, provider);
  }
  try {
    const body = await socialPublishingGateway<Record<string, unknown>>(
      "pause_state",
      { workspaceId, provider },
    );
    return body.paused === true;
  } catch (error) {
    return gatewayError(error);
  }
}
