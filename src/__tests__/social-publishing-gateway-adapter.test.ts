/**
 * Gateway transactional adapter, end to end through the real worker.
 *
 * Mirrors src/__tests__/telegram-publishing-worker.test.ts, but the store is
 * NOT mocked: the factory in publishing/store.ts selects the gateway-backed
 * implementation (shouldUseSupabaseGateway is mocked true) and the only
 * mocked transport is the gateway client. The governance reads also run
 * through the gateway (the worker's governanceEvidence helper), while the
 * credential load still comes from the mocked lifecycle store — re-pointing
 * that import to the gateway helper is the follow-up wiring, and the
 * gateway credential load itself is covered by the direct helper tests
 * below.
 *
 * A job whose claim expired is dropped by the batch after the mark returns
 * 409 SOCIAL_PUBLISHING_CLAIM_LOST (the worker's existing claim-loss
 * cascade: the mark fails, the recovery mark fails the same way, and the
 * claim expires for safe recovery). The direct store test asserts the 409
 * itself; the worker test asserts the job is not published.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SocialPublishingJobRecord } from "@/lib/social-media/publishing/types";
import { encryptSocialCredential } from "@/lib/social-media/oauth/crypto";

const gatewayErrors = vi.hoisted(() => ({
  GatewayRequestError: class GatewayRequestError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
const gatewayHandlers = vi.hoisted(
  () =>
    new Map<
      string,
      (payload: Record<string, unknown>) => unknown | Promise<unknown>
    >(),
);
const gateway = vi.hoisted(() => ({
  call: vi.fn(
    async (action: string, payload: Record<string, unknown> = {}) => {
      const handler = gatewayHandlers.get(action);
      if (!handler) throw new Error(`unexpected gateway action: ${action}`);
      return handler(payload);
    },
  ),
}));
const gatewaySelected = vi.hoisted(() => ({ value: true }));
const credential = vi.hoisted(() => ({ load: vi.fn() }));
const adapter = vi.hoisted(() => ({ publish: vi.fn() }));
const verification = vi.hoisted(() => ({ verify: vi.fn() }));
const policy = vi.hoisted(() => ({ evaluate: vi.fn() }));
const lanes = vi.hoisted(() => ({
  evaluateDestination: vi.fn(),
  readMetadata: vi.fn(),
}));
const autopilot = vi.hoisted(() => ({ isApprovalDecision: vi.fn() }));
const securityMocks = vi.hoisted(() => ({
  audit: vi.fn(),
  locks: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  approvalFindFirst: vi.fn(),
  complianceFindFirst: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({
      parts,
      values,
    }),
    join: (values: unknown[], separator?: string) => ({ values, separator }),
  },
}));
vi.mock("@/lib/supabase-gateway", () => ({
  shouldUseSupabaseGateway: () => gatewaySelected.value,
  GatewayRequestError: gatewayErrors.GatewayRequestError,
}));
vi.mock("@/lib/social-media/publishing/gateway-client", () => ({
  socialPublishingGateway: gateway.call,
  isSocialPublishingGatewayAdapterEnabled: () => true,
  probeSocialPublishingGatewayAdapter: async () => true,
  EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT: 13,
  SOCIAL_PUBLISHING_GATEWAY_ACTIONS: [],
}));
vi.mock("@/lib/db", () => ({
  db: {
    approvalRequest: { findFirst: dbMocks.approvalFindFirst },
    complianceReview: { findFirst: dbMocks.complianceFindFirst },
    $queryRaw: dbMocks.queryRaw,
    $executeRaw: dbMocks.executeRaw,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: dbMocks.queryRaw,
        $executeRaw: dbMocks.executeRaw,
      }),
    ),
  },
}));
vi.mock("@/lib/social-media/oauth/lifecycle-store", () => ({
  loadSocialConnectorCredential: credential.load,
}));
vi.mock("@/lib/social-media/oauth/provider-pause", () => ({
  isSocialProviderPaused: vi.fn(),
}));
vi.mock("@/lib/social-media/publishing/adapters", () => ({
  getSocialPublishingAdapter: () => ({ publish: adapter.publish }),
  SocialPublishingAdapterError: class SocialPublishingAdapterError extends Error {
    constructor(
      public code: string,
      message: string,
      public options: Record<string, unknown> = {},
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/social-media/publishing/verification", () => ({
  verifySocialPublication: verification.verify,
}));
vi.mock("@/lib/social-media/policy", () => ({
  evaluateSocialPublishingAuthorization: policy.evaluate,
}));
vi.mock("@/lib/social-media/orchestration/content-lanes", () => ({
  evaluateContentLaneDestination: lanes.evaluateDestination,
  readContentLaneMetadata: lanes.readMetadata,
}));
vi.mock("@/lib/social-media/autopilot/service", () => ({
  isSocialAutopilotApprovalDecision: autopilot.isApprovalDecision,
}));
vi.mock("@/lib/social-media/autopilot/policy", () => ({
  getSocialAutopilotEgressPolicy: vi.fn(),
  SOCIAL_AUTOPILOT_POLICY_VERSION: "test-policy-v1",
  socialAutopilotAutoApprovalEnabled: () => false,
}));
vi.mock("@/lib/tokmetric/security", () => ({
  emitTokMetricAudit: securityMocks.audit,
  enforceEmergencyLocks: securityMocks.locks,
  redactSecrets: (value: unknown) => value,
  TokMetricError: class TokMetricError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/social-media/publishing/pause", () => ({
  providerPauseState: () => ({ paused: false }),
  persistentProviderPauseState: async () => ({ paused: false }),
}));

import { processSocialPublishingBatch } from "@/lib/social-media/publishing/worker";
import {
  claimSocialPublishingJobs,
  listSocialPublishingJobs,
} from "@/lib/social-media/publishing/store";
import {
  claimSocialPublishingJobsViaGateway,
  createSocialPublishingJobViaGateway,
  listSocialPublishingJobsViaGateway,
  markSocialPublishingJobPublishedViaGateway,
} from "@/lib/social-media/publishing/gateway-store";
import {
  emitTokMetricAudit as emitAuditViaGateway,
  enforceEmergencyLocks as enforceLocksViaGateway,
  isSocialProviderPaused as isPausedViaGateway,
  loadSocialConnectorCredential as loadCredentialViaGateway,
  loadSocialPublishingGovernanceEvidence,
} from "@/lib/social-media/publishing/gateway-worker-deps";

const NOW = "2026-11-07T18:00:00.000Z";
const NOW_DATE = new Date(NOW);

function telegramJobRecord(): SocialPublishingJobRecord {
  return {
    id: "job-telegram-1",
    workspaceId: "workspace-1",
    provider: "TELEGRAM",
    connectorId: "connector-telegram-1",
    contentType: "TEXT",
    contentVersionHash: "hash-1",
    approvedVersionHash: "hash-1",
    approvalId: "approval-1",
    complianceReviewId: "compliance-1",
    compliancePassed: true,
    idempotencyKey: "idempotency-1",
    payload: { text: "Test Telegram post" },
    localContext: null,
    state: "PENDING",
    attemptCount: 0,
    maxAttempts: 3,
    nextAttemptAt: NOW_DATE,
    claimId: null,
    claimExpiresAt: null,
    externalPostId: null,
    externalPostUrl: null,
    safeProviderMetadata: {},
    lastErrorCode: null,
    lastErrorMessage: null,
    requestedById: "requester-1",
    scheduledFor: null,
    claimedAt: null,
    submittedAt: null,
    completedAt: null,
    createdAt: NOW_DATE,
    updatedAt: NOW_DATE,
  };
}

// Gateway JSON row (camelCase keys, ISO timestamp strings), exactly the
// shape the gem_social_* RPCs return.
function telegramJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-telegram-1",
    workspaceId: "workspace-1",
    provider: "TELEGRAM",
    connectorId: "connector-telegram-1",
    contentType: "TEXT",
    contentVersionHash: "hash-1",
    approvedVersionHash: "hash-1",
    approvalId: "approval-1",
    complianceReviewId: "compliance-1",
    compliancePassed: true,
    idempotencyKey: "idempotency-1",
    payload: { text: "Test Telegram post" },
    localContext: null,
    state: "PENDING",
    attemptCount: 0,
    maxAttempts: 3,
    nextAttemptAt: NOW,
    claimId: null,
    claimExpiresAt: null,
    externalPostId: null,
    externalPostUrl: null,
    safeProviderMetadata: {},
    lastErrorCode: null,
    lastErrorMessage: null,
    requestedById: "requester-1",
    scheduledFor: null,
    claimedAt: null,
    submittedAt: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function claimedTelegramJobRow(claimId: string) {
  return telegramJobRow({
    state: "CLAIMED",
    attemptCount: 1,
    claimId,
    claimExpiresAt: "2026-11-07T18:02:00.000Z",
    claimedAt: NOW,
  });
}

function publishedTelegramJobRow() {
  return telegramJobRow({
    state: "PUBLISHED",
    attemptCount: 1,
    claimId: null,
    claimExpiresAt: null,
    claimedAt: NOW,
    externalPostId: "777",
    externalPostUrl: "https://t.me/mycybersecureWealthsolution/777",
    submittedAt: NOW,
    completedAt: NOW,
  });
}

function blockedTelegramJobRow() {
  return telegramJobRow({
    state: "BLOCKED",
    attemptCount: 1,
    claimId: null,
    claimExpiresAt: null,
    claimedAt: NOW,
    lastErrorCode: "SOCIAL_PUBLISHING_NOT_AUTHORIZED",
    lastErrorMessage: "Shared governance blocked the external publishing action.",
    completedAt: NOW,
  });
}

function governanceEvidenceResponse() {
  return {
    approval: {
      id: "approval-1",
      workspaceId: "workspace-1",
      contentId: "content-1",
      contentVersionId: "version-1",
      requestedById: "requester-1",
      requiredRole: "admin",
      action: "publish",
      objectHash: "hash-1",
      state: "APPROVED",
      expiresAt: null,
      createdAt: NOW,
      updatedAt: NOW,
      content: {
        id: "content-1",
        workspaceId: "workspace-1",
        campaignId: null,
        ownerId: null,
        title: "Test",
        state: "APPROVED",
        currentVersionId: "version-1",
        createdAt: NOW,
        updatedAt: NOW,
      },
      contentVersion: {
        id: "version-1",
        contentId: "content-1",
        version: 1,
        objectHash: "hash-1",
        script: null,
        caption: "Test",
        hashtags: [],
        settings: {},
        mediaAssetIds: [],
        createdById: null,
        createdAt: NOW,
      },
      decisions: [
        {
          id: "decision-1",
          approvalRequestId: "approval-1",
          actorId: "approver-1",
          decision: "approve",
          objectHash: "hash-1",
          reason: null,
          createdAt: NOW,
        },
      ],
    },
    complianceReview: {
      id: "compliance-1",
      workspaceId: "workspace-1",
      contentId: "content-1",
      contentVersionId: "version-1",
      policyVersionId: null,
      result: "PASS",
      findings: [],
      reviewerId: null,
      createdAt: NOW,
    },
  };
}

function telegramConnector(safeMetadata: Record<string, unknown>) {
  return {
    connector: {
      provider: "TELEGRAM",
      state: "CONNECTED",
      disabledAt: null,
      grantedScopes: [],
      safeMetadata,
      externalAccountId: "telegram-bot",
    },
    credential: { accessToken: "bot-token" },
  };
}

function credentialRow(secretRef: string, externalAccountId: string) {
  return {
    id: "connector-telegram-1",
    workspaceId: "workspace-1",
    provider: "TELEGRAM",
    state: "CONNECTED",
    displayName: "Telegram",
    externalAccountId,
    grantedScopes: [],
    safeMetadata: { telegramChatId: "-1003368597629" },
    lastHealthAt: null,
    disabledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    secretRef,
    credentialExpiresAt: null,
    credentialRefreshExpiresAt: null,
    credentialRotatedAt: null,
  };
}

describe("gateway-backed store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewaySelected.value = true;
    gatewayHandlers.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("claim revives gateway rows to job records with Date fields", async () => {
    gatewayHandlers.set("claim_jobs", (payload) => ({
      jobs: [claimedTelegramJobRow(String(payload.claimId))],
    }));

    const jobs = await claimSocialPublishingJobsViaGateway(10);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.provider).toBe("TELEGRAM");
    expect(jobs[0]?.state).toBe("CLAIMED");
    expect(jobs[0]?.claimId).toBeTruthy();
    expect(jobs[0]?.nextAttemptAt).toBeInstanceOf(Date);
    expect(jobs[0]?.createdAt).toBeInstanceOf(Date);
    // Policy travels as parameters, not as re-implemented SQL.
    const claimCall = gateway.call.mock.calls.find(
      ([action]) => action === "claim_jobs",
    );
    expect(claimCall).toBeDefined();
    const claimPayload = claimCall?.[1] as Record<string, unknown>;
    expect(claimPayload.spacingMinutes).toMatchObject({ TELEGRAM: 15 });
    expect(claimPayload.slotCaps).toMatchObject({ TELEGRAM: 6 });
    expect(typeof claimPayload.claimId).toBe("string");
  });

  it("mark_published surfaces a 409 CLAIM_LOST as a TokMetricError", async () => {
    const job = { ...telegramJobRecord(), state: "CLAIMED" as const, claimId: "claim-1", attemptCount: 1, claimedAt: NOW_DATE };
    gatewayHandlers.set("mark_published", () => {
      throw new gatewayErrors.GatewayRequestError(
        409,
        "SOCIAL_PUBLISHING_CLAIM_LOST",
        "The publishing job claim expired before completion.",
      );
    });

    await expect(
      markSocialPublishingJobPublishedViaGateway({
        job,
        externalPostId: "777",
        externalPostUrl: "https://t.me/mycybersecureWealthsolution/777",
      }),
    ).rejects.toMatchObject({ status: 409, code: "SOCIAL_PUBLISHING_CLAIM_LOST" });
  });

  it("create returns the job and surfaces an idempotency conflict as 409", async () => {
    gatewayHandlers.set("create_job", () => ({
      ok: true,
      job: telegramJobRow(),
    }));
    const created = await createSocialPublishingJobViaGateway({
      workspaceId: "workspace-1",
      provider: "TELEGRAM",
      connectorId: "connector-telegram-1",
      contentType: "TEXT",
      contentVersionHash: "hash-1",
      approvedVersionHash: "hash-1",
      approvalId: "approval-1",
      complianceReviewId: "compliance-1",
      compliancePassed: true,
      idempotencyKey: "idempotency-1",
      payload: { text: "Test Telegram post" },
    });
    expect(created.id).toBe("job-telegram-1");
    expect(created.state).toBe("PENDING");
    expect(created.createdAt).toBeInstanceOf(Date);

    gatewayHandlers.set("create_job", () => {
      throw new gatewayErrors.GatewayRequestError(
        409,
        "SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT",
        "The idempotency key is already bound to a different publishing request.",
      );
    });
    await expect(
      createSocialPublishingJobViaGateway({
        workspaceId: "workspace-1",
        provider: "TELEGRAM",
        connectorId: "connector-telegram-1",
        contentType: "TEXT",
        contentVersionHash: "different-hash",
        approvedVersionHash: "hash-1",
        approvalId: "approval-1",
        complianceReviewId: "compliance-1",
        compliancePassed: true,
        idempotencyKey: "idempotency-1",
        payload: { text: "Test Telegram post" },
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT",
    });
  });

  it("list returns revived jobs", async () => {
    gatewayHandlers.set("list_jobs", () => ({
      jobs: [telegramJobRow(), telegramJobRow({ id: "job-telegram-2" })],
    }));
    const jobs = await listSocialPublishingJobsViaGateway({ workspaceId: "workspace-1" });
    expect(jobs).toHaveLength(2);
    expect(jobs[1]?.id).toBe("job-telegram-2");
    expect(jobs[0]?.createdAt).toBeInstanceOf(Date);
  });
});

describe("Telegram job through processSocialPublishingBatch (gateway)", () => {
  const originalLiveGate = process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED;
  const originalTelegramGate = process.env.TELEGRAM_SOCIAL_PUBLISHING_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    gatewaySelected.value = true;
    gatewayHandlers.clear();
    process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED = "true";
    process.env.TELEGRAM_SOCIAL_PUBLISHING_ENABLED = "true";
    securityMocks.audit.mockResolvedValue(undefined);
    securityMocks.locks.mockResolvedValue(undefined);

    autopilot.isApprovalDecision.mockReturnValue(false);
    lanes.readMetadata.mockReturnValue({
      lane: "STANDARD_GOVERNED",
      sourceKind: "GEM",
      metadataValid: true,
      invalidReason: undefined,
      sourceTransformationVerified: false,
      aigcDisclosureApplied: false,
      aigcDisclosureRequired: false,
    });
    lanes.evaluateDestination.mockReturnValue({ allowed: true, reasons: [] });
    policy.evaluate.mockReturnValue({ reasons: [] });
    verification.verify.mockResolvedValue({
      verificationOk: true,
      verifiedAt: NOW,
      method: "NOT_APPLICABLE",
    });
    adapter.publish.mockResolvedValue({
      externalPostId: "777",
      externalPostUrl: "https://t.me/mycybersecureWealthsolution/777",
    });

    gatewayHandlers.set("claim_jobs", (payload) => ({
      jobs: [claimedTelegramJobRow(String(payload.claimId))],
    }));
    gatewayHandlers.set("governance_evidence", () => governanceEvidenceResponse());
    gatewayHandlers.set("mark_published", () => ({
      job: publishedTelegramJobRow(),
    }));
    gatewayHandlers.set("mark_blocked", () => ({
      job: blockedTelegramJobRow(),
    }));
    gatewayHandlers.set("mark_failed", () => ({
      job: telegramJobRow({ state: "FAILED", completedAt: NOW }),
    }));
  });

  afterEach(() => {
    if (originalLiveGate === undefined) {
      delete process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED;
    } else {
      process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED = originalLiveGate;
    }
    if (originalTelegramGate === undefined) {
      delete process.env.TELEGRAM_SOCIAL_PUBLISHING_ENABLED;
    } else {
      process.env.TELEGRAM_SOCIAL_PUBLISHING_ENABLED = originalTelegramGate;
    }
    vi.unstubAllEnvs();
  });

  it("publishes a queued Telegram job through the gateway-backed store", async () => {
    credential.load.mockResolvedValue(
      telegramConnector({ telegramChatId: "-1003368597629" }),
    );

    const result = await processSocialPublishingBatch(10);

    expect(result.claimed).toBe(1);
    expect(result.published).toBe(1);
    expect(result.jobs[0]?.state).toBe("PUBLISHED");
    expect(adapter.publish).toHaveBeenCalledTimes(1);
    expect(adapter.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        job: expect.objectContaining({ provider: "TELEGRAM" }),
        accessToken: "bot-token",
        connectorMetadata: expect.objectContaining({
          telegramChatId: "-1003368597629",
        }),
      }),
    );
    expect(gateway.call).toHaveBeenCalledWith(
      "claim_jobs",
      expect.objectContaining({ limit: 10 }),
    );
    expect(gateway.call).toHaveBeenCalledWith(
      "governance_evidence",
      expect.objectContaining({ approvalId: "approval-1" }),
    );
    expect(gateway.call).toHaveBeenCalledWith(
      "mark_published",
      expect.objectContaining({ externalPostId: "777" }),
    );
  });

  it("blocks a Telegram job whose connector has no configured chat id", async () => {
    credential.load.mockResolvedValue(telegramConnector({}));

    const result = await processSocialPublishingBatch(10);

    expect(result.blocked).toBe(1);
    expect(result.jobs[0]?.state).toBe("BLOCKED");
    expect(adapter.publish).not.toHaveBeenCalled();
    expect(gateway.call).toHaveBeenCalledWith(
      "mark_blocked",
      expect.objectContaining({ errorCode: "SOCIAL_PUBLISHING_NOT_AUTHORIZED" }),
    );
  });

  it("does not publish a job whose claim expired (409 CLAIM_LOST from the mark)", async () => {
    credential.load.mockResolvedValue(
      telegramConnector({ telegramChatId: "-1003368597629" }),
    );
    const claimLost = () => {
      throw new gatewayErrors.GatewayRequestError(
        409,
        "SOCIAL_PUBLISHING_CLAIM_LOST",
        "The publishing job claim expired before completion.",
      );
    };
    gatewayHandlers.set("mark_published", claimLost);
    gatewayHandlers.set("mark_failed", claimLost);

    const result = await processSocialPublishingBatch(10);

    expect(result.claimed).toBe(1);
    expect(result.published).toBe(0);
    // The claim-loss cascade drops the job from the batch; the claim
    // expires and the job becomes eligible for safe recovery.
    expect(result.jobs).toHaveLength(0);
    expect(adapter.publish).toHaveBeenCalledTimes(1);
    expect(
      gateway.call.mock.calls.some(([action]) => action === "mark_published"),
    ).toBe(true);
    expect(
      gateway.call.mock.calls.some(([action]) => action === "mark_failed"),
    ).toBe(true);
  });
});

describe("gateway worker deps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewaySelected.value = true;
    gatewayHandlers.clear();
    // 32-byte test key (hex) for the credential encrypt/decrypt round trip.
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", "11".repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loadSocialConnectorCredential decrypts the gateway row (Telegram bot-token)", async () => {
    const secretRef = encryptSocialCredential({
      provider: "TELEGRAM",
      accessToken: "bot-token",
      grantedScopes: [],
      externalAccountId: "telegram-bot",
    });
    gatewayHandlers.set("load_credential", () => ({
      row: credentialRow(secretRef, "telegram-bot"),
    }));

    const loaded = await loadCredentialViaGateway({
      workspaceId: "workspace-1",
      connectorId: "connector-telegram-1",
    });

    expect(loaded.connector.provider).toBe("TELEGRAM");
    expect(loaded.credential.accessToken).toBe("bot-token");
    expect(loaded.connector.safeMetadata).toMatchObject({
      telegramChatId: "-1003368597629",
    });
    expect(loaded.credentialRotatedAt).toBeNull();
  });

  it("loadSocialConnectorCredential rejects a mismatched credential with 409", async () => {
    const secretRef = encryptSocialCredential({
      provider: "TELEGRAM",
      accessToken: "bot-token",
      grantedScopes: [],
      externalAccountId: "telegram-bot",
    });
    gatewayHandlers.set("load_credential", () => ({
      row: credentialRow(secretRef, "a-different-account"),
    }));

    await expect(
      loadCredentialViaGateway({
        workspaceId: "workspace-1",
        connectorId: "connector-telegram-1",
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "SOCIAL_CONNECTOR_CREDENTIAL_MISMATCH",
    });
  });

  it("loadSocialPublishingGovernanceEvidence revives the gateway rows", async () => {
    gatewayHandlers.set("governance_evidence", () => governanceEvidenceResponse());
    const job = telegramJobRecord();

    const evidence = await loadSocialPublishingGovernanceEvidence(job);

    expect(evidence.approval?.contentVersionId).toBe("version-1");
    expect(evidence.approval?.content?.currentVersionId).toBe("version-1");
    expect(evidence.approval?.contentVersion?.objectHash).toBe("hash-1");
    expect(evidence.approval?.decisions[0]?.actorId).toBe("approver-1");
    expect(evidence.approval?.contentVersion?.createdAt).toBeInstanceOf(Date);
    expect(evidence.complianceReview?.contentId).toBe("content-1");
    expect(evidence.complianceReview?.createdAt).toBeInstanceOf(Date);
  });

  it("enforceEmergencyLocks passes through the gateway lock check", async () => {
    gatewayHandlers.set("workspace_locks", () => ({ ok: true }));
    await expect(
      enforceLocksViaGateway("workspace-1", "publish"),
    ).resolves.toBeUndefined();

    gatewayHandlers.set("workspace_locks", () => {
      throw new gatewayErrors.GatewayRequestError(
        423,
        "TOKMETRIC_LOCKED",
        "TokMetric emergency controls block this action.",
      );
    });
    await expect(
      enforceLocksViaGateway("workspace-1", "publish"),
    ).rejects.toMatchObject({ status: 423, code: "TOKMETRIC_LOCKED" });
  });

  it("isSocialProviderPaused reads the gateway pause state", async () => {
    gatewayHandlers.set("pause_state", () => ({ paused: true }));
    expect(await isPausedViaGateway("workspace-1", "TELEGRAM")).toBe(true);
    gatewayHandlers.set("pause_state", () => ({ paused: false }));
    expect(await isPausedViaGateway("workspace-1", "TELEGRAM")).toBe(false);
  });

  it("emitTokMetricAudit writes through the gateway", async () => {
    const seen: Array<Record<string, unknown>> = [];
    gatewayHandlers.set("audit_event", (payload) => {
      seen.push(payload);
      return { ok: true, id: "audit-1" };
    });

    await emitAuditViaGateway({
      workspaceId: "workspace-1",
      actorId: "requester-1",
      action: "SOCIAL_PUBLISH_COMPLETED",
      entityType: "SOCIAL_PUBLISHING_JOB",
      entityId: "job-telegram-1",
      correlationId: "job-telegram-1",
      outcome: "PUBLISHED",
      sourceChannel: "social-publishing-worker",
      metadata: { provider: "TELEGRAM" },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      action: "SOCIAL_PUBLISH_COMPLETED",
      entityType: "SOCIAL_PUBLISHING_JOB",
      correlationId: "job-telegram-1",
    });
  });
});

describe("store factory routing (negative control)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayHandlers.clear();
    // Direct database: the factory must use Prisma and never touch the
    // gateway client.
    gatewaySelected.value = false;
    dbMocks.queryRaw.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes list and claim to Prisma when the gateway is not selected", async () => {
    expect(await listSocialPublishingJobs({ workspaceId: "workspace-1" })).toEqual([]);
    expect(await claimSocialPublishingJobs(10)).toEqual([]);
    expect(dbMocks.queryRaw).toHaveBeenCalled();
    expect(gateway.call).not.toHaveBeenCalled();
  });
});
