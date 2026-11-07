/**
 * Telegram publishing through the governed worker.
 *
 * Regression coverage for the Telegram gates gap: the publishing worker
 * routes every queued job through `missingPublishingScopes` and
 * `accountTypeMatches` before dispatch, but neither function handled the
 * bot-token Telegram provider. `missingPublishingScopes` returned
 * `undefined` for TELEGRAM (the switch covered only the six OAuth
 * providers), so `.filter()` threw a TypeError and every Telegram job
 * failed; `accountTypeMatches` returned `false` for TELEGRAM, so every
 * Telegram job was blocked with EXPLICIT_ACCOUNT_SELECTION_REQUIRED.
 *
 * A Telegram connector has no OAuth scopes and no OAuth account type.
 * Its destination is the configured chat id in connector metadata
 * (`telegramChatId`, see `resolveTelegramDestination`); a connector
 * without one must stay blocked, never auto-select a destination.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SocialPublishingJobRecord } from "@/lib/social-media/publishing/types";

const store = vi.hoisted(() => ({
  claimSocialPublishingJobs: vi.fn(),
  markSocialPublishingJobBlocked: vi.fn(),
  markSocialPublishingJobFailed: vi.fn(),
  markSocialPublishingJobPublished: vi.fn(),
  markSocialConnectorForReauthorization: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  approvalFindFirst: vi.fn(),
  complianceFindFirst: vi.fn(),
}));
const credential = vi.hoisted(() => ({ load: vi.fn() }));
const adapter = vi.hoisted(() => ({ publish: vi.fn() }));
const verification = vi.hoisted(() => ({ verify: vi.fn() }));
const policy = vi.hoisted(() => ({ evaluate: vi.fn() }));
const lanes = vi.hoisted(() => ({
  evaluateDestination: vi.fn(),
  readMetadata: vi.fn(),
}));
const autopilot = vi.hoisted(() => ({ isApprovalDecision: vi.fn() }));

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({
      parts,
      values,
    }),
    join: (values: unknown[], separator?: string) => ({ values, separator }),
  },
}));
vi.mock("@/lib/social-media/publishing/store", () => ({
  claimSocialPublishingJobs: store.claimSocialPublishingJobs,
  markSocialPublishingJobBlocked: store.markSocialPublishingJobBlocked,
  markSocialPublishingJobFailed: store.markSocialPublishingJobFailed,
  markSocialPublishingJobPublished: store.markSocialPublishingJobPublished,
  markSocialConnectorForReauthorization:
    store.markSocialConnectorForReauthorization,
}));
vi.mock("@/lib/db", () => ({
  db: {
    approvalRequest: { findFirst: dbMocks.approvalFindFirst },
    complianceReview: { findFirst: dbMocks.complianceFindFirst },
  },
}));
vi.mock("@/lib/social-media/oauth/lifecycle-store", () => ({
  loadSocialConnectorCredential: credential.load,
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
  emitTokMetricAudit: vi.fn().mockResolvedValue(undefined),
  enforceEmergencyLocks: vi.fn().mockResolvedValue(undefined),
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

import {
  accountTypeMatches,
  missingPublishingScopes,
} from "@/lib/social-media/publishing/gates";
import { processSocialPublishingBatch } from "@/lib/social-media/publishing/worker";

function telegramJob(): SocialPublishingJobRecord {
  const now = new Date("2026-11-07T18:00:00.000Z");
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
    nextAttemptAt: now,
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
    createdAt: now,
    updatedAt: now,
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

describe("Telegram publishing gates", () => {
  it("requires no OAuth scopes for the bot-token Telegram provider", () => {
    expect(missingPublishingScopes("TELEGRAM", [])).toEqual([]);
    expect(missingPublishingScopes("TELEGRAM", ["tweet.write"])).toEqual([]);
  });

  it("still requires OAuth scopes for OAuth providers", () => {
    expect(missingPublishingScopes("FACEBOOK_PAGE", [])).toEqual([
      "pages_manage_posts",
    ]);
    expect(missingPublishingScopes("FACEBOOK_PAGE", ["pages_manage_posts"])).toEqual(
      [],
    );
  });

  it("accepts a Telegram connector with a configured chat id", () => {
    expect(
      accountTypeMatches("TELEGRAM", { telegramChatId: "-1003368597629" }),
    ).toBe(true);
    expect(accountTypeMatches("TELEGRAM", { telegramChatId: "@channel" })).toBe(
      true,
    );
  });

  it("rejects a Telegram connector with no configured chat id", () => {
    expect(accountTypeMatches("TELEGRAM", {})).toBe(false);
    expect(accountTypeMatches("TELEGRAM", { telegramChatId: "   " })).toBe(
      false,
    );
    expect(accountTypeMatches("TELEGRAM", { telegramChatId: 123 })).toBe(false);
  });

  it("still matches OAuth account types", () => {
    expect(
      accountTypeMatches("FACEBOOK_PAGE", { accountType: "META_PAGE" }),
    ).toBe(true);
    expect(
      accountTypeMatches("FACEBOOK_PAGE", { accountType: "X_USER" }),
    ).toBe(false);
  });
});

describe("Telegram job through processSocialPublishingBatch", () => {
  const originalLiveGate = process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED;
  const originalTelegramGate = process.env.TELEGRAM_SOCIAL_PUBLISHING_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED = "true";
    process.env.TELEGRAM_SOCIAL_PUBLISHING_ENABLED = "true";

    dbMocks.approvalFindFirst.mockResolvedValue({
      id: "approval-1",
      workspaceId: "workspace-1",
      objectHash: "hash-1",
      contentId: "content-1",
      contentVersionId: "version-1",
      requestedById: "requester-1",
      content: { currentVersionId: "version-1" },
      contentVersion: { objectHash: "hash-1" },
      decisions: [
        {
          id: "decision-1",
          actorId: "approver-1",
          decision: "approve",
          objectHash: "hash-1",
        },
      ],
    });
    dbMocks.complianceFindFirst.mockResolvedValue({
      id: "compliance-1",
      contentVersionId: "version-1",
      contentId: "content-1",
    });
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
      verifiedAt: "2026-11-07T18:00:00.000Z",
      method: "NOT_APPLICABLE",
    });
    adapter.publish.mockResolvedValue({
      externalPostId: "777",
      externalPostUrl: "https://t.me/mycybersecureWealthsolution/777",
    });
    store.markSocialPublishingJobPublished.mockImplementation(
      async ({ job }: { job: SocialPublishingJobRecord }) => ({
        ...job,
        state: "PUBLISHED",
        externalPostId: "777",
      }),
    );
    store.markSocialPublishingJobBlocked.mockImplementation(
      async ({ job }: { job: SocialPublishingJobRecord }) => ({
        ...job,
        state: "BLOCKED",
      }),
    );
    store.markSocialPublishingJobFailed.mockImplementation(
      async ({ job }: { job: SocialPublishingJobRecord }) => ({
        ...job,
        state: "FAILED",
      }),
    );
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
  });

  it("publishes a queued Telegram job instead of failing in the gates", async () => {
    const job = telegramJob();
    store.claimSocialPublishingJobs.mockResolvedValue([job]);
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
    expect(store.markSocialPublishingJobBlocked).not.toHaveBeenCalled();
  });

  it("blocks a Telegram job whose connector has no configured chat id", async () => {
    const job = telegramJob();
    store.claimSocialPublishingJobs.mockResolvedValue([job]);
    credential.load.mockResolvedValue(telegramConnector({}));

    const result = await processSocialPublishingBatch(10);

    expect(result.blocked).toBe(1);
    expect(result.jobs[0]?.state).toBe("BLOCKED");
    expect(adapter.publish).not.toHaveBeenCalled();
    expect(store.markSocialPublishingJobBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        job,
        errorCode: "SOCIAL_PUBLISHING_NOT_AUTHORIZED",
      }),
    );
  });
});
