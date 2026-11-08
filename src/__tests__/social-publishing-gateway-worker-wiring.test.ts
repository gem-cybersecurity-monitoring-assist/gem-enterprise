/**
 * Gateway worker wiring: the publishing worker's remaining Prisma calls
 * now go through the gateway when it is selected.
 *
 * The gateway branches live in the original modules, which are
 * transport-aware and branch on shouldUseSupabaseGateway() internally:
 * - loadSocialConnectorCredential (oauth/lifecycle-store.ts)
 * - isSocialProviderPaused (oauth/provider-pause.ts), reached by the worker
 *   through persistentProviderPauseState (publishing/pause.ts)
 * - enforceEmergencyLocks + emitTokMetricAudit (tokmetric/security.ts)
 *
 * Each block covers both paths: gateway selected (only the gateway client
 * is mocked, with a per-action handler map; the Prisma store is armed to
 * throw so any Prisma call on the gateway path fails loudly) and gateway
 * not selected (the Prisma store is mocked; the gateway client is never
 * called). The Prisma path must behave byte-for-byte as before — these
 * tests pin it, including the missing-store 503s.
 *
 * The worker itself is not re-tested here: it imports the originals, which
 * are mocked in the worker suites, so those suites are unaffected by the
 * wiring. The gateway-worker-deps re-exports are covered by the delegate
 * block in social-publishing-gateway-adapter.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const dbMocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  workspaceFindUnique: vi.fn(),
  auditEventCreate: vi.fn(),
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
}));
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: dbMocks.queryRaw,
    $executeRaw: dbMocks.executeRaw,
    workspace: { findUnique: dbMocks.workspaceFindUnique },
    auditEvent: { create: dbMocks.auditEventCreate },
  },
}));

import { loadSocialConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
import { isSocialProviderPaused } from "@/lib/social-media/oauth/provider-pause";
import { persistentProviderPauseState } from "@/lib/social-media/publishing/pause";
import {
  emitTokMetricAudit,
  enforceEmergencyLocks,
} from "@/lib/tokmetric/security";

const NOW = "2026-11-07T18:00:00.000Z";

// Gateway JSON row (camelCase keys, ISO timestamp strings), exactly the
// shape the gem_social_load_connector_credential RPC returns.
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

// Same row as the Prisma SELECT in lifecycle-store.ts returns it (aliased
// camelCase keys, Date fields).
function prismaCredentialRow(secretRef: string, externalAccountId: string) {
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
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    secretRef,
    credentialExpiresAt: null,
    credentialRefreshExpiresAt: null,
    credentialRotatedAt: null,
  };
}

function unlockedWorkspace() {
  return {
    id: "workspace-1",
    globalEmergencyLock: false,
    publishingDisabled: false,
    advertisingDisabled: false,
    shopWriteDisabled: false,
    connectorDisabled: false,
  };
}

// On the gateway path the Prisma store must never be touched: arm every
// mocked Prisma call to throw so a stray Prisma read fails loudly instead
// of silently returning a canned row.
function armPrismaToThrow() {
  const error = new Error("prisma must not be called on the gateway path");
  dbMocks.queryRaw.mockRejectedValue(error);
  dbMocks.executeRaw.mockRejectedValue(error);
  dbMocks.workspaceFindUnique.mockRejectedValue(error);
  dbMocks.auditEventCreate.mockRejectedValue(error);
}

describe("loadSocialConnectorCredential wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayHandlers.clear();
    // 32-byte test key (hex) for the credential encrypt/decrypt round trip.
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", "11".repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("gateway selected", () => {
    beforeEach(() => {
      gatewaySelected.value = true;
      armPrismaToThrow();
    });

    it("decrypts the gateway row (Telegram bot-token)", async () => {
      const secretRef = encryptSocialCredential({
        provider: "TELEGRAM",
        accessToken: "bot-token",
        grantedScopes: [],
        externalAccountId: "telegram-bot",
      });
      gatewayHandlers.set("load_credential", () => ({
        row: credentialRow(secretRef, "telegram-bot"),
      }));

      const loaded = await loadSocialConnectorCredential({
        workspaceId: "workspace-1",
        connectorId: "connector-telegram-1",
      });

      expect(loaded.connector.provider).toBe("TELEGRAM");
      expect(loaded.credential.accessToken).toBe("bot-token");
      expect(loaded.connector.safeMetadata).toMatchObject({
        telegramChatId: "-1003368597629",
      });
      expect(loaded.credentialRotatedAt).toBeNull();
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("rejects a mismatched credential with 409", async () => {
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
        loadSocialConnectorCredential({
          workspaceId: "workspace-1",
          connectorId: "connector-telegram-1",
        }),
      ).rejects.toMatchObject({
        status: 409,
        code: "SOCIAL_CONNECTOR_CREDENTIAL_MISMATCH",
      });
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("surfaces a gateway 404 with the RPC code", async () => {
      gatewayHandlers.set("load_credential", () => {
        throw new gatewayErrors.GatewayRequestError(
          404,
          "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND",
          "Active social connector authorization was not found.",
        );
      });

      await expect(
        loadSocialConnectorCredential({
          workspaceId: "workspace-1",
          connectorId: "connector-missing",
        }),
      ).rejects.toMatchObject({
        status: 404,
        code: "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND",
      });
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("fails closed on a malformed gateway row", async () => {
      gatewayHandlers.set("load_credential", () => ({
        row: { id: "connector-telegram-1" },
      }));

      await expect(
        loadSocialConnectorCredential({
          workspaceId: "workspace-1",
          connectorId: "connector-telegram-1",
        }),
      ).rejects.toMatchObject({
        status: 500,
        code: "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
      });
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("gateway not selected (Prisma path)", () => {
    beforeEach(() => {
      gatewaySelected.value = false;
    });

    it("returns the Prisma row with the decrypted credential", async () => {
      const secretRef = encryptSocialCredential({
        provider: "TELEGRAM",
        accessToken: "bot-token",
        grantedScopes: [],
        externalAccountId: "telegram-bot",
      });
      dbMocks.queryRaw.mockResolvedValue([
        prismaCredentialRow(secretRef, "telegram-bot"),
      ]);

      const loaded = await loadSocialConnectorCredential({
        workspaceId: "workspace-1",
        connectorId: "connector-telegram-1",
      });

      expect(loaded.connector.provider).toBe("TELEGRAM");
      expect(loaded.credential.accessToken).toBe("bot-token");
      expect(loaded.connector.safeMetadata).toMatchObject({
        telegramChatId: "-1003368597629",
      });
      expect(loaded.credentialRotatedAt).toBeNull();
      expect(gateway.call).not.toHaveBeenCalled();
    });

    it("missing row is a 404, not a gateway call", async () => {
      dbMocks.queryRaw.mockResolvedValue([]);

      await expect(
        loadSocialConnectorCredential({
          workspaceId: "workspace-1",
          connectorId: "connector-missing",
        }),
      ).rejects.toMatchObject({
        status: 404,
        code: "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND",
      });
      expect(gateway.call).not.toHaveBeenCalled();
    });

    it("missing store is a 503, not a gateway call", async () => {
      dbMocks.queryRaw.mockRejectedValue(
        new Error('relation "social_connectors" does not exist'),
      );

      await expect(
        loadSocialConnectorCredential({
          workspaceId: "workspace-1",
          connectorId: "connector-telegram-1",
        }),
      ).rejects.toMatchObject({
        status: 503,
        code: "SOCIAL_OAUTH_STORE_NOT_PROVISIONED",
      });
      expect(gateway.call).not.toHaveBeenCalled();
    });
  });
});

describe("provider pause wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayHandlers.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("gateway selected", () => {
    beforeEach(() => {
      gatewaySelected.value = true;
      armPrismaToThrow();
    });

    it("isSocialProviderPaused reads the gateway pause state", async () => {
      gatewayHandlers.set("pause_state", () => ({ paused: true }));
      expect(await isSocialProviderPaused("workspace-1", "TELEGRAM")).toBe(
        true,
      );
      gatewayHandlers.set("pause_state", () => ({ paused: false }));
      expect(await isSocialProviderPaused("workspace-1", "TELEGRAM")).toBe(
        false,
      );
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("persistentProviderPauseState maps the publishing provider to the pause provider", async () => {
      const seen: Array<Record<string, unknown>> = [];
      gatewayHandlers.set("pause_state", (payload) => {
        seen.push(payload);
        return { paused: false };
      });

      await persistentProviderPauseState("workspace-1", "FACEBOOK_PAGE");
      await persistentProviderPauseState("workspace-1", "TELEGRAM");

      expect(seen).toHaveLength(2);
      expect(seen[0]).toMatchObject({ workspaceId: "workspace-1", provider: "META" });
      expect(seen[1]).toMatchObject({ workspaceId: "workspace-1", provider: "TELEGRAM" });
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("a paused provider blocks through the worker's pause state", async () => {
      gatewayHandlers.set("pause_state", () => ({ paused: true }));

      const state = await persistentProviderPauseState(
        "workspace-1",
        "TELEGRAM",
      );

      expect(state).toEqual({
        paused: true,
        reason: "Publishing for TELEGRAM is paused in this workspace.",
      });
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("a gateway error fails closed instead of returning not-paused", async () => {
      gatewayHandlers.set("pause_state", () => {
        throw new gatewayErrors.GatewayRequestError(
          503,
          "GATEWAY_UNAVAILABLE",
          "Social publishing gateway is unavailable.",
        );
      });

      await expect(
        isSocialProviderPaused("workspace-1", "TELEGRAM"),
      ).rejects.toMatchObject({ status: 503, code: "GATEWAY_UNAVAILABLE" });
      expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("gateway not selected (Prisma path)", () => {
    beforeEach(() => {
      gatewaySelected.value = false;
    });

    it("reads the pause row from Prisma", async () => {
      dbMocks.queryRaw.mockResolvedValue([{ one: 1 }]);
      expect(await isSocialProviderPaused("workspace-1", "TELEGRAM")).toBe(
        true,
      );
      dbMocks.queryRaw.mockResolvedValue([]);
      expect(await isSocialProviderPaused("workspace-1", "TELEGRAM")).toBe(
        false,
      );
      expect(gateway.call).not.toHaveBeenCalled();
    });

    it("missing store is a 503, not a gateway call", async () => {
      dbMocks.queryRaw.mockRejectedValue(
        new Error('relation "social_provider_pauses" does not exist'),
      );

      await expect(
        isSocialProviderPaused("workspace-1", "TELEGRAM"),
      ).rejects.toMatchObject({
        status: 503,
        code: "SOCIAL_PROVIDER_PAUSE_STORE_NOT_PROVISIONED",
      });
      expect(gateway.call).not.toHaveBeenCalled();
    });
  });
});

describe("enforceEmergencyLocks wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayHandlers.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("gateway selected", () => {
    beforeEach(() => {
      gatewaySelected.value = true;
      armPrismaToThrow();
    });

    it("passes through the gateway lock check", async () => {
      const seen: Array<Record<string, unknown>> = [];
      gatewayHandlers.set("workspace_locks", (payload) => {
        seen.push(payload);
        return { ok: true };
      });

      await expect(
        enforceEmergencyLocks("workspace-1", "publish"),
      ).resolves.toBeUndefined();
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        workspaceId: "workspace-1",
        action: "publish",
      });
      expect(dbMocks.workspaceFindUnique).not.toHaveBeenCalled();
    });

    it("a locked workspace surfaces the 423 with the RPC code", async () => {
      gatewayHandlers.set("workspace_locks", () => {
        throw new gatewayErrors.GatewayRequestError(
          423,
          "TOKMETRIC_LOCKED",
          "TokMetric emergency controls block this action.",
        );
      });

      await expect(
        enforceEmergencyLocks("workspace-1", "publish"),
      ).rejects.toMatchObject({ status: 423, code: "TOKMETRIC_LOCKED" });
      expect(dbMocks.workspaceFindUnique).not.toHaveBeenCalled();
    });

    it("a missing workspace surfaces the 404 with the RPC code", async () => {
      gatewayHandlers.set("workspace_locks", () => {
        throw new gatewayErrors.GatewayRequestError(
          404,
          "WORKSPACE_NOT_FOUND",
          "Workspace was not found.",
        );
      });

      await expect(
        enforceEmergencyLocks("workspace-missing", "publish"),
      ).rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
      expect(dbMocks.workspaceFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("gateway not selected (Prisma path)", () => {
    beforeEach(() => {
      gatewaySelected.value = false;
    });

    it("allows an unlocked workspace", async () => {
      dbMocks.workspaceFindUnique.mockResolvedValue(unlockedWorkspace());

      await expect(
        enforceEmergencyLocks("workspace-1", "publish"),
      ).resolves.toBeUndefined();
      expect(gateway.call).not.toHaveBeenCalled();
    });

    it("blocks a publishing-disabled workspace for publish only", async () => {
      dbMocks.workspaceFindUnique.mockResolvedValue({
        ...unlockedWorkspace(),
        publishingDisabled: true,
      });

      await expect(
        enforceEmergencyLocks("workspace-1", "publish"),
      ).rejects.toMatchObject({ status: 423, code: "TOKMETRIC_LOCKED" });
      await expect(
        enforceEmergencyLocks("workspace-1", "advertise"),
      ).resolves.toBeUndefined();
      expect(gateway.call).not.toHaveBeenCalled();
    });

    it("missing workspace is a 404, not a gateway call", async () => {
      dbMocks.workspaceFindUnique.mockResolvedValue(null);

      await expect(
        enforceEmergencyLocks("workspace-missing", "publish"),
      ).rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
      expect(gateway.call).not.toHaveBeenCalled();
    });
  });
});

describe("emitTokMetricAudit wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayHandlers.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("gateway selected", () => {
    beforeEach(() => {
      gatewaySelected.value = true;
      armPrismaToThrow();
    });

    it("writes through the gateway with secrets redacted", async () => {
      const seen: Array<Record<string, unknown>> = [];
      gatewayHandlers.set("audit_event", (payload) => {
        seen.push(payload);
        return { ok: true, id: "audit-1" };
      });

      await emitTokMetricAudit({
        workspaceId: "workspace-1",
        actorId: "requester-1",
        action: "SOCIAL_PUBLISH_COMPLETED",
        entityType: "SOCIAL_PUBLISHING_JOB",
        entityId: "job-telegram-1",
        correlationId: "job-telegram-1",
        outcome: "PUBLISHED",
        sourceChannel: "social-publishing-worker",
        metadata: {
          provider: "TELEGRAM",
          accessToken: "should-be-redacted",
          nested: { password: "should-be-redacted" },
        },
      });

      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        workspaceId: "workspace-1",
        action: "SOCIAL_PUBLISH_COMPLETED",
        entityType: "SOCIAL_PUBLISHING_JOB",
        correlationId: "job-telegram-1",
        outcome: "PUBLISHED",
        sourceChannel: "social-publishing-worker",
      });
      expect(seen[0]?.safeMetadata).toMatchObject({
        provider: "TELEGRAM",
        accessToken: "[REDACTED]",
        nested: { password: "[REDACTED]" },
      });
      expect(dbMocks.auditEventCreate).not.toHaveBeenCalled();
    });

    it("a gateway failure rejects (callers decide best-effort)", async () => {
      gatewayHandlers.set("audit_event", () => {
        throw new gatewayErrors.GatewayRequestError(
          503,
          "GATEWAY_UNAVAILABLE",
          "Social publishing gateway is unavailable.",
        );
      });

      await expect(
        emitTokMetricAudit({
          workspaceId: "workspace-1",
          action: "SOCIAL_PUBLISH_COMPLETED",
          entityType: "SOCIAL_PUBLISHING_JOB",
          correlationId: "job-telegram-1",
          outcome: "PUBLISHED",
          sourceChannel: "social-publishing-worker",
        }),
      ).rejects.toMatchObject({ status: 503, code: "GATEWAY_UNAVAILABLE" });
      expect(dbMocks.auditEventCreate).not.toHaveBeenCalled();
    });
  });

  describe("gateway not selected (Prisma path)", () => {
    beforeEach(() => {
      gatewaySelected.value = false;
    });

    it("inserts the audit row with secrets redacted", async () => {
      dbMocks.auditEventCreate.mockResolvedValue({ id: "audit-1" });

      await emitTokMetricAudit({
        workspaceId: "workspace-1",
        actorId: "requester-1",
        action: "SOCIAL_PUBLISH_COMPLETED",
        entityType: "SOCIAL_PUBLISHING_JOB",
        entityId: "job-telegram-1",
        correlationId: "job-telegram-1",
        outcome: "PUBLISHED",
        sourceChannel: "social-publishing-worker",
        metadata: {
          provider: "TELEGRAM",
          accessToken: "should-be-redacted",
        },
      });

      expect(dbMocks.auditEventCreate).toHaveBeenCalledTimes(1);
      const data = dbMocks.auditEventCreate.mock.calls[0]?.[0]?.data as
        | Record<string, unknown>
        | undefined;
      expect(data).toMatchObject({
        workspaceId: "workspace-1",
        action: "SOCIAL_PUBLISH_COMPLETED",
        outcome: "PUBLISHED",
      });
      expect(data?.safeMetadata).toMatchObject({
        provider: "TELEGRAM",
        accessToken: "[REDACTED]",
      });
      expect(gateway.call).not.toHaveBeenCalled();
    });
  });
});
