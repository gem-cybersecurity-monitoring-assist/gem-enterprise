/**
 * Telegram connector creation (POST /api/social-media/connectors).
 *
 * The connectors API had no creation endpoint (GET list + DELETE disconnect
 * only), so an admin could not create a Telegram (BOT_TOKEN) connector
 * in-app. This covers the new POST handler on both store paths: gateway
 * selected (the create_connector RPC, gateway client mocked, Prisma armed
 * to throw) and direct database (Prisma mocked, gateway never called).
 *
 * The bot token is a secret: it is encrypted server-side with the real
 * encryptSocialCredential (32-byte test key) and must never appear in the
 * response, the audit metadata, or the returned connector record. The
 * fake token "test-bot-token" is used throughout; no real token anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { decryptSocialCredential } from "@/lib/social-media/oauth/crypto";

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
}));
const securityErrors = vi.hoisted(() => ({
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
const securityMocks = vi.hoisted(() => ({
  permission: vi.fn(),
  locks: vi.fn(async () => undefined),
  audit: vi.fn(async (_input: Record<string, unknown>) => undefined),
}));
const connectorAuthorityMocks = vi.hoisted(() => ({
  session: vi.fn(async () => ({ userId: "actor-1" })),
  workspace: vi.fn(async () => ({ role: "admin" })),
}));
const pauseMocks = vi.hoisted(() => ({
  pausedProviders: vi.fn(async () => [] as string[]),
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
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: dbMocks.queryRaw,
        $executeRaw: dbMocks.executeRaw,
      }),
    ),
  },
}));
vi.mock("@/lib/tokmetric/security", () => {
  const TokMetricError = securityErrors.TokMetricError;
  return {
    TokMetricError,
    correlationId: () => "test-correlation-id",
    parseJson: async (
      request: NextRequest,
      schema: {
        safeParse: (value: unknown) => {
          success: boolean;
          data?: unknown;
        };
      },
    ) => {
      const json = await request.json().catch(() => {
        throw new TokMetricError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON.",
        );
      });
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new TokMetricError(
          400,
          "VALIDATION_ERROR",
          "Request validation failed.",
        );
      }
      return parsed.data;
    },
    tokMetricErrorResponse: (error: unknown, cid: string) => {
      const safe =
        error instanceof TokMetricError
          ? error
          : new TokMetricError(
              500,
              "INTERNAL_ERROR",
              "An unexpected TokMetric error occurred.",
            );
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: safe.code,
            message: safe.message,
            correlationId: cid,
          },
        }),
        {
          status: safe.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    },
    requirePermission: securityMocks.permission,
    enforceEmergencyLocks: securityMocks.locks,
    emitTokMetricAudit: securityMocks.audit,
    redactSecrets: (value: unknown) => value,
  };
});
vi.mock("@/lib/social-media/connector-authority", () => ({
  requireSocialConnectorSession: connectorAuthorityMocks.session,
  requireSocialConnectorWorkspace: connectorAuthorityMocks.workspace,
}));
vi.mock("@/lib/social-media/oauth/connectors", () => ({
  disconnectSocialConnector: vi.fn(),
  listSocialConnectors: vi.fn(),
}));
vi.mock("@/lib/social-media/oauth/provider-pause", () => ({
  getPausedSocialProviders: pauseMocks.pausedProviders,
}));
vi.mock("@/lib/social-media/oauth/probes", () => ({
  readLiveProbeSignal: () => null,
}));

import { POST } from "@/app/api/social-media/connectors/route";

const NOW = "2026-11-09T21:00:00.000Z";
const CHAT_ID = "-1003368597629";
const BOT_TOKEN = "test-bot-token";

// Gateway JSON row (camelCase keys, ISO timestamp strings), exactly the
// shape the gem_social_create_connector RPC returns.
function gatewayConnectorRow() {
  return {
    id: "connector-telegram-1",
    workspaceId: "workspace-1",
    provider: "TELEGRAM",
    state: "CONNECTED",
    displayName: "Telegram",
    externalAccountId: CHAT_ID,
    grantedScopes: [],
    safeMetadata: { telegramChatId: CHAT_ID },
    lastHealthAt: null,
    disabledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// Same row as the Prisma INSERT ... RETURNING returns it (aliased camelCase
// keys, Date fields).
function prismaConnectorRow() {
  return {
    id: "connector-telegram-1",
    workspaceId: "workspace-1",
    provider: "TELEGRAM",
    state: "CONNECTED",
    displayName: "Telegram",
    externalAccountId: CHAT_ID,
    grantedScopes: [],
    safeMetadata: { telegramChatId: CHAT_ID },
    lastHealthAt: null,
    disabledAt: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
  };
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/social-media/connectors", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return {
    workspaceId: "workspace-1",
    provider: "TELEGRAM",
    telegramChatId: CHAT_ID,
    botToken: BOT_TOKEN,
  };
}

// On the gateway path the Prisma store must never be touched: arm every
// mocked Prisma call to throw so a stray Prisma read fails loudly instead
// of silently returning a canned row.
function armPrismaToThrow() {
  const error = new Error("prisma must not be called on the gateway path");
  dbMocks.queryRaw.mockRejectedValue(error);
  dbMocks.executeRaw.mockRejectedValue(error);
}

describe("POST /api/social-media/connectors (Telegram create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayHandlers.clear();
    // 32-byte test key (hex) for the credential encrypt/decrypt round trip.
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", "11".repeat(32));
    gatewaySelected.value = true;
    connectorAuthorityMocks.session.mockResolvedValue({ userId: "actor-1" });
    connectorAuthorityMocks.workspace.mockResolvedValue({ role: "admin" });
    pauseMocks.pausedProviders.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the connector through the gateway and never returns the token", async () => {
    armPrismaToThrow();
    let capturedPayload: Record<string, unknown> | undefined;
    gatewayHandlers.set("create_connector", (payload) => {
      capturedPayload = payload;
      return { ok: true, connector: gatewayConnectorRow() };
    });

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.correlationId).toBe("test-correlation-id");
    expect(body.connector.id).toBe("connector-telegram-1");
    expect(body.connector.provider).toBe("TELEGRAM");
    expect(body.connector.state).toBe("CONNECTED");
    expect(body.connector.displayName).toBe("Telegram");
    expect(body.connector.externalAccountId).toBe(CHAT_ID);
    expect(body.connector.safeMetadata).toEqual({ telegramChatId: CHAT_ID });
    expect(body.connector.providerPaused).toBe(false);
    expect(body.connector.liveProbe).toBeNull();
    expect(body.externalActionTaken).toBe(false);
    // The token and the secretRef never appear in the response.
    expect(JSON.stringify(body)).not.toContain(BOT_TOKEN);
    expect(JSON.stringify(body)).not.toContain("secretRef");
    expect(JSON.stringify(body)).not.toContain("v1.");

    // The RPC received the encrypted credential, not the raw token.
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload?.workspaceId).toBe("workspace-1");
    expect(capturedPayload?.provider).toBe("TELEGRAM");
    expect(capturedPayload?.displayName).toBe("Telegram");
    expect(capturedPayload?.externalAccountKey).toBe(CHAT_ID);
    expect(capturedPayload?.externalAccountId).toBe(CHAT_ID);
    expect(capturedPayload?.safeMetadata).toEqual({ telegramChatId: CHAT_ID });
    expect(typeof capturedPayload?.secretRef).toBe("string");
    expect(String(capturedPayload?.secretRef)).not.toContain(BOT_TOKEN);
    const decrypted = decryptSocialCredential<{
      provider: string;
      accessToken: string;
      grantedScopes: string[];
      externalAccountId: string;
    }>(String(capturedPayload?.secretRef));
    expect(decrypted).toEqual({
      provider: "TELEGRAM",
      accessToken: BOT_TOKEN,
      grantedScopes: [],
      externalAccountId: CHAT_ID,
    });
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
    expect(dbMocks.executeRaw).not.toHaveBeenCalled();

    // The audit records the connection without the token.
    expect(securityMocks.audit).toHaveBeenCalledOnce();
    const auditInput = securityMocks.audit.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(auditInput.action).toBe("social.connector.authorized");
    expect(auditInput.entityId).toBe("connector-telegram-1");
    expect(JSON.stringify(auditInput)).not.toContain(BOT_TOKEN);
  });

  it("creates the connector through Prisma and encrypts the credential there too", async () => {
    gatewaySelected.value = false;
    dbMocks.queryRaw.mockResolvedValue([prismaConnectorRow()]);
    dbMocks.executeRaw.mockResolvedValue(1);

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.connector.id).toBe("connector-telegram-1");
    expect(body.connector.provider).toBe("TELEGRAM");
    expect(JSON.stringify(body)).not.toContain(BOT_TOKEN);
    expect(JSON.stringify(body)).not.toContain("secretRef");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).toHaveBeenCalled();
    expect(dbMocks.executeRaw).toHaveBeenCalled();

    // The credential INSERT carried the encrypted secretRef (values[2];
    // 'oauth:production' is a SQL literal, not an interpolation), which
    // decrypts to the same credential the gateway path sends.
    const credentialInsert = dbMocks.executeRaw.mock.calls[0][0] as {
      values: unknown[];
    };
    const secretRef = String(credentialInsert.values[2]);
    expect(secretRef.startsWith("v1.")).toBe(true);
    expect(secretRef).not.toContain(BOT_TOKEN);
    expect(
      decryptSocialCredential<{
        provider: string;
        accessToken: string;
        externalAccountId: string;
      }>(secretRef),
    ).toEqual({
      provider: "TELEGRAM",
      accessToken: BOT_TOKEN,
      grantedScopes: [],
      externalAccountId: CHAT_ID,
    });
  });

  it("uses the provided display name and public channel when given", async () => {
    armPrismaToThrow();
    let capturedPayload: Record<string, unknown> | undefined;
    gatewayHandlers.set("create_connector", (payload) => {
      capturedPayload = payload;
      return {
        ok: true,
        connector: {
          ...gatewayConnectorRow(),
          displayName: "GEM Channel",
          safeMetadata: {
            telegramChatId: CHAT_ID,
            telegramPublicChannel: "@mycybersecureWealthsolution",
          },
        },
      };
    });

    const response = await POST(
      request({
        ...validBody(),
        displayName: "GEM Channel",
        telegramPublicChannel: "@mycybersecureWealthsolution",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connector.displayName).toBe("GEM Channel");
    expect(capturedPayload?.displayName).toBe("GEM Channel");
    expect(capturedPayload?.safeMetadata).toEqual({
      telegramChatId: CHAT_ID,
      telegramPublicChannel: "@mycybersecureWealthsolution",
    });
    expect(JSON.stringify(body)).not.toContain(BOT_TOKEN);
  });

  it("rejects a non-Telegram provider before any store call", async () => {
    const response = await POST(
      request({ ...validBody(), provider: "META" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(connectorAuthorityMocks.workspace).not.toHaveBeenCalled();
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a missing telegramChatId before any store call", async () => {
    const { telegramChatId: _omitted, ...withoutChatId } = validBody();
    const response = await POST(request(withoutChatId));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a blank telegramChatId before any store call", async () => {
    const response = await POST(
      request({ ...validBody(), telegramChatId: "   " }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a missing bot token before any store call", async () => {
    const { botToken: _omitted, ...withoutToken } = validBody();
    const response = await POST(request(withoutToken));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a missing workspaceId before any store call", async () => {
    const { workspaceId: _omitted, ...withoutWorkspace } = validBody();
    const response = await POST(request(withoutWorkspace));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns 401 without an active session", async () => {
    connectorAuthorityMocks.session.mockRejectedValueOnce(
      new securityErrors.TokMetricError(
        401,
        "UNAUTHORIZED",
        "An active session is required.",
      ),
    );
    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns 403 when the member may not manage connectors", async () => {
    securityMocks.permission.mockImplementationOnce(() => {
      throw new securityErrors.TokMetricError(
        403,
        "FORBIDDEN",
        "Requires manage permission.",
      );
    });
    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(gateway.call).not.toHaveBeenCalled();
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });

  it("fails closed when the gateway returns no connector", async () => {
    armPrismaToThrow();
    gatewayHandlers.set("create_connector", () => ({ ok: true }));

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(
      "SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID",
    );
    expect(securityMocks.audit).not.toHaveBeenCalled();
  });

  it("surfaces a gateway 409 as the same code and status", async () => {
    armPrismaToThrow();
    gatewayHandlers.set("create_connector", () => {
      throw new gatewayErrors.GatewayRequestError(
        409,
        "SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT",
        "A different connector already uses this provider account in this workspace.",
      );
    });

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT");
    expect(securityMocks.audit).not.toHaveBeenCalled();
  });
});
