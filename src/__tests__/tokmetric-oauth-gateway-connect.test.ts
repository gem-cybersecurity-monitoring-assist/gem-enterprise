import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  account: vi.fn(),
  membership: vi.fn(),
  workspace: vi.fn(),
  auditEvent: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFind: vi.fn(),
  attemptUpdateMany: vi.fn(),
  connectorUpsert: vi.fn(),
  connectorFindMany: vi.fn(),
  credentialUpsert: vi.fn(),
  queryRaw: vi.fn(),
  scopedClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionFromRequest: mocks.session }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.account },
    workspaceMember: { findFirst: mocks.membership },
    workspace: { findUnique: mocks.workspace },
    auditEvent: { create: mocks.auditEvent },
    oAuthAuthorizationAttempt: {
      create: mocks.attemptCreate,
      findUnique: mocks.attemptFind,
      updateMany: mocks.attemptUpdateMany,
    },
    connector: { upsert: mocks.connectorUpsert, findMany: mocks.connectorFindMany },
    connectorCredentialReference: { upsert: mocks.credentialUpsert },
    $queryRaw: mocks.queryRaw,
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor(options: unknown) { return mocks.scopedClient(options); }
  },
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
}));

import { GET as legacyStartGet } from "@/app/api/tokmetric/oauth/start/route";
import { GET as legacyCallbackGet } from "@/app/api/tokmetric/oauth/callback/route";
import { GET as legacyConnectorsGet } from "@/app/api/tokmetric/connectors/route";
import { consumeSocialOAuthAuthorizationAttempt } from "@/lib/social-media/oauth/store";
import { consumeOAuthAuthorizationAttempt } from "@/lib/tokmetric/oauth/attempts";
import { encodeOAuthState } from "@/lib/tokmetric/oauth/state";
import { encryptCredential } from "@/lib/tokmetric/oauth/crypto";
import { encryptSocialCredential } from "@/lib/social-media/oauth/crypto";
import type { SocialOAuthStatePayload } from "@/lib/social-media/oauth/state";
import type { OAuthStatePayload } from "@/lib/tokmetric/oauth/state";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const gatewaySession = {
  userId: "user-1",
  email: "operator@example.test",
  role: "admin",
  kycStatus: "approved",
  entitlements: [],
  authSource: "supabase_gateway",
  sessionVersion: 2,
};

const POOLER_URL =
  "postgresql://postgres.slzdjoqpzbkwzuaexlkj@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&sslaccept=strict";

function configureTransactionalAuthority() {
  vi.stubEnv("SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED", "true");
  vi.stubEnv("POSTGRES_PRISMA_URL", POOLER_URL);
}

function configureTikTok() {
  vi.stubEnv("TIKTOK_CLIENT_KEY", "tiktok-client-key");
  vi.stubEnv("TIKTOK_CLIENT_SECRET", "tiktok-client-secret");
  vi.stubEnv("TIKTOK_REDIRECT_URI", "https://www.gemcybersecurityassist.com/api/tokmetric/oauth/callback");
  vi.stubEnv("TIKTOK_ENVIRONMENT", "sandbox");
  vi.stubEnv("TOKMETRIC_TIKTOK_OAUTH_ENABLED", "true");
  vi.stubEnv(
    "TOKMETRIC_TOKEN_ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
  vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("SOCIAL_OAUTH_STATE_SECRET", "social-state-secret-for-tests");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEM_AUTH_GATEWAY_ENABLED", "false");
  configureTransactionalAuthority();
  configureTikTok();
  mocks.session.mockResolvedValue(gatewaySession);
  mocks.account.mockResolvedValue({
    id: "user-1",
    email: "operator@example.test",
    role: "admin",
    organizationId: null,
    isActive: true,
    status: "active",
    sessionVersion: 2,
  });
  mocks.membership.mockResolvedValue({
    role: { permissions: [{ action: "manage", scope: "connectors" }] },
  });
  mocks.workspace.mockResolvedValue({
    globalEmergencyLock: false,
    publishingDisabled: false,
    advertisingDisabled: false,
    shopWriteDisabled: false,
    connectorDisabled: false,
  });
  mocks.auditEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("legacy TokMetric TikTok OAuth over a supabase_gateway session", () => {
  it("lets a gateway session start TikTok OAuth once the transactional authority is bound", async () => {
    mocks.attemptCreate.mockResolvedValue({ nonce: "nonce-1" });
    const request = new NextRequest(
      "http://localhost/api/tokmetric/oauth/start?workspaceId=workspace-1&provider=TIKTOK_LOGIN_KIT",
    );
    const response = await legacyStartGet(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location.startsWith("https://www.tiktok.com/v2/auth/authorize/")).toBe(true);
    expect(location).toContain("client_key=tiktok-client-key");
    expect(mocks.attemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "workspace-1", actorId: "user-1" }),
      }),
    );
    expect(mocks.account).toHaveBeenCalled();
  });

  it("fails closed without the transactional authority and never returns the old persistence code", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED", "false");
    const request = new NextRequest(
      "http://localhost/api/tokmetric/oauth/start?workspaceId=workspace-1&provider=TIKTOK_LOGIN_KIT",
    );
    const response = await legacyStartGet(request);
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SOCIAL_CONNECTOR_BACKEND_REQUIRED");
    expect(body.error.code).not.toBe("TOKMETRIC_GATEWAY_BACKEND_REQUIRED");
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });

  it("reads back connected TikTok accounts for a gateway session", async () => {
    mocks.connectorFindMany.mockResolvedValue([]);
    const request = new NextRequest(
      "http://localhost/api/tokmetric/connectors?workspaceId=workspace-1",
    );
    const response = await legacyConnectorsGet(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; connectors: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.connectors).toHaveLength(6);
    expect(mocks.connectorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "workspace-1" } }),
    );
  });

  it("uses only the namespaced database for gateway TokMetric readback", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1", email: gatewaySession.email, role: "admin", organizationId: null,
      isActive: true, status: "active", sessionVersion: 2,
    });
    const findFirst = vi.fn().mockResolvedValue({ role: { permissions: [] } });
    const findMany = vi.fn().mockResolvedValue([]);
    mocks.scopedClient.mockReturnValue({
      user: { findUnique }, workspaceMember: { findFirst }, connector: { findMany },
    });
    vi.stubEnv("POSTGRES_PRISMA_URL", "");
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", POOLER_URL.split("?")[0]);
    const response = await legacyConnectorsGet(new NextRequest(
      "http://localhost/api/tokmetric/connectors?workspaceId=workspace-1",
    ));
    expect(response.status).toBe(200);
    expect(mocks.scopedClient).toHaveBeenCalledWith({ datasourceUrl: POOLER_URL });
    expect(findUnique).toHaveBeenCalledOnce();
    expect(findFirst).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledOnce();
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.membership).not.toHaveBeenCalled();
    expect(mocks.connectorFindMany).not.toHaveBeenCalled();
  });

  it("rejects a namespaced URL for another project even if the default URL is valid", async () => {
    vi.stubEnv("GEM_SOCIAL_POSTGRES_PRISMA_URL", POOLER_URL.replace("slzdjoqpzbkwzuaexlkj", "aaaaaaaaaaaaaaaaaaaa"));
    const response = await legacyConnectorsGet(new NextRequest(
      "http://localhost/api/tokmetric/connectors?workspaceId=workspace-1",
    ));
    expect(response.status).toBe(503);
    expect(mocks.scopedClient).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  });

  it("blocks the connected-account readback without the transactional authority", async () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "");
    const request = new NextRequest(
      "http://localhost/api/tokmetric/connectors?workspaceId=workspace-1",
    );
    const response = await legacyConnectorsGet(request);
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SOCIAL_CONNECTOR_BACKEND_REQUIRED");
    expect(mocks.connectorFindMany).not.toHaveBeenCalled();
  });

  it("completes the callback for the initiating gateway session and persists the connector", async () => {
    const state = encodeOAuthState({
      nonce: "nonce-1",
      workspaceId: "workspace-1",
      provider: "TIKTOK_LOGIN_KIT",
      environment: "sandbox",
      createdAt: Date.now(),
      actorId: "user-1",
    });
    mocks.attemptFind.mockResolvedValue({
      id: "attempt-1",
      nonce: "nonce-1",
      workspaceId: "workspace-1",
      actorId: "user-1",
      provider: "TIKTOK_LOGIN_KIT",
      environment: "sandbox",
      encryptedCodeVerifier: encryptCredential({ codeVerifier: "verifier-1" }),
      expiresAt: new Date(Date.now() + 600_000),
      consumedAt: null,
    });
    mocks.attemptUpdateMany.mockResolvedValue({ count: 1 });
    mocks.connectorUpsert.mockResolvedValue({ id: "connector-1" });
    mocks.credentialUpsert.mockResolvedValue({});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: "tiktok-access-token",
          refresh_token: "tiktok-refresh-token",
          expires_in: 3600,
          scope: "user.info.basic",
          open_id: "open-1",
        }),
      })),
    );
    const request = new NextRequest(
      `http://localhost/api/tokmetric/oauth/callback?code=auth-code-1&state=${encodeURIComponent(state)}`,
    );
    const response = await legacyCallbackGet(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/tokmetric/accounts?connector=connector-1&state=connected");
    expect(mocks.connectorUpsert).toHaveBeenCalled();
    expect(mocks.auditEvent).toHaveBeenCalled();
  });

  it("rejects the callback when the state actor is not the signed-in gateway user", async () => {
    const state = encodeOAuthState({
      nonce: "nonce-1",
      workspaceId: "workspace-1",
      provider: "TIKTOK_LOGIN_KIT",
      environment: "sandbox",
      createdAt: Date.now(),
      actorId: "user-2",
    });
    const request = new NextRequest(
      `http://localhost/api/tokmetric/oauth/callback?code=auth-code-1&state=${encodeURIComponent(state)}`,
    );
    const response = await legacyCallbackGet(request);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(mocks.attemptFind).not.toHaveBeenCalled();
    expect(mocks.connectorUpsert).not.toHaveBeenCalled();
  });

  it("rejects the callback before any attempt read when the transactional authority is off", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED", "false");
    const state = encodeOAuthState({
      nonce: "nonce-1",
      workspaceId: "workspace-1",
      provider: "TIKTOK_LOGIN_KIT",
      environment: "sandbox",
      createdAt: Date.now(),
      actorId: "user-1",
    });
    const request = new NextRequest(
      `http://localhost/api/tokmetric/oauth/callback?code=auth-code-1&state=${encodeURIComponent(state)}`,
    );
    const response = await legacyCallbackGet(request);
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SOCIAL_CONNECTOR_BACKEND_REQUIRED");
    expect(mocks.attemptFind).not.toHaveBeenCalled();
  });
});

describe("unified social OAuth callback attempt consumption", () => {
  const state: SocialOAuthStatePayload = {
    nonce: "nonce-1",
    workspaceId: "workspace-1",
    actorId: "user-1",
    provider: "TIKTOK",
    createdAt: Date.now(),
  };

  it("rejects an expired authorization attempt", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    await expect(consumeSocialOAuthAuthorizationAttempt(state)).rejects.toMatchObject({
      status: 401,
      code: "SOCIAL_OAUTH_ATTEMPT_INVALID",
    });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("rejects a replayed (already consumed) authorization attempt", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    await expect(consumeSocialOAuthAuthorizationAttempt(state)).rejects.toMatchObject({
      status: 401,
      code: "SOCIAL_OAUTH_ATTEMPT_INVALID",
    });
  });

  it("rejects a mismatched authorization attempt", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    await expect(
      consumeSocialOAuthAuthorizationAttempt({ ...state, workspaceId: "workspace-2" }),
    ).rejects.toMatchObject({ status: 401, code: "SOCIAL_OAUTH_ATTEMPT_INVALID" });
    await expect(
      consumeSocialOAuthAuthorizationAttempt({ ...state, actorId: "user-2" }),
    ).rejects.toMatchObject({ status: 401, code: "SOCIAL_OAUTH_ATTEMPT_INVALID" });
  });

  it("consumes a live attempt exactly once and returns its PKCE verifier", async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: "attempt-1",
        nonce: "nonce-1",
        workspaceId: "workspace-1",
        actorId: "user-1",
        provider: "TIKTOK",
        encryptedCodeVerifier: encryptSocialCredential({ codeVerifier: "verifier-9" }),
        requestedScopes: ["user.info.basic"],
        redirectUri: "https://www.gemcybersecurityassist.com/api/social-media/oauth/tiktok/callback",
        redirectAfter: "/app/social-media/accounts",
        expiresAt: new Date(Date.now() + 600_000),
        consumedAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    const consumed = await consumeSocialOAuthAuthorizationAttempt(state);
    expect(consumed.codeVerifier).toBe("verifier-9");
    expect(consumed.attempt.nonce).toBe("nonce-1");
  });
});

describe("legacy TokMetric callback attempt consumption", () => {
  const baseState: OAuthStatePayload = {
    nonce: "nonce-1",
    workspaceId: "workspace-1",
    provider: "TIKTOK_LOGIN_KIT",
    environment: "sandbox",
    createdAt: Date.now(),
    actorId: "user-1",
  };
  const liveAttempt = () => ({
    id: "attempt-1",
    nonce: "nonce-1",
    workspaceId: "workspace-1",
    actorId: "user-1",
    provider: "TIKTOK_LOGIN_KIT",
    environment: "sandbox",
    encryptedCodeVerifier: encryptCredential({ codeVerifier: "verifier-1" }),
    expiresAt: new Date(Date.now() + 600_000),
    consumedAt: null,
  });

  it("rejects an expired authorization attempt", async () => {
    mocks.attemptFind.mockResolvedValue({ ...liveAttempt(), expiresAt: new Date(Date.now() - 1000) });
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_EXPIRED",
    });
    expect(mocks.attemptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an already consumed authorization attempt", async () => {
    mocks.attemptFind.mockResolvedValue({ ...liveAttempt(), consumedAt: new Date() });
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_CONSUMED",
    });
    expect(mocks.attemptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a replayed consume when the atomic claim loses the race", async () => {
    mocks.attemptFind.mockResolvedValue(liveAttempt());
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 });
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_CONSUMED",
    });
  });

  it("rejects a mismatched authorization attempt", async () => {
    mocks.attemptFind.mockResolvedValue({ ...liveAttempt(), workspaceId: "workspace-2" });
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_MISMATCH",
    });
    mocks.attemptFind.mockResolvedValue({ ...liveAttempt(), actorId: "user-2" });
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_MISMATCH",
    });
    mocks.attemptFind.mockResolvedValue({ ...liveAttempt(), provider: "TIKTOK_DISPLAY_API" });
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_MISMATCH",
    });
  });

  it("rejects an unknown authorization attempt", async () => {
    mocks.attemptFind.mockResolvedValue(null);
    await expect(consumeOAuthAuthorizationAttempt(baseState)).rejects.toMatchObject({
      status: 401,
      code: "OAUTH_ATTEMPT_NOT_FOUND",
    });
  });

  it("consumes a live attempt exactly once and returns its PKCE verifier", async () => {
    mocks.attemptFind.mockResolvedValue(liveAttempt());
    mocks.attemptUpdateMany.mockResolvedValue({ count: 1 });
    const consumed = await consumeOAuthAuthorizationAttempt(baseState);
    expect(consumed.codeVerifier).toBe("verifier-1");
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "attempt-1", consumedAt: null } }),
    );
  });
});

describe("TokMetric persistence guard is preserved everywhere else", () => {
  it("routes the TikTok connect path through connector authority, not the persistence guard", () => {
    for (const path of [
      "src/app/api/tokmetric/oauth/start/route.ts",
      "src/app/api/tokmetric/oauth/callback/route.ts",
      "src/app/api/tokmetric/connectors/route.ts",
    ]) {
      const route = source(path);
      expect(route).toContain("requireSocialConnectorSession");
      expect(route).toContain("requireSocialConnectorWorkspace");
      expect(route).not.toContain("requireTokMetricSession");
      expect(route).not.toContain("requireActiveTokMetricSession");
      expect(route).not.toContain("requireWorkspaceAccess");
      expect(route).not.toContain("verifySession");
    }
    const callback = source("src/app/api/tokmetric/oauth/callback/route.ts");
    expect(callback).toContain("session.userId !== actorId");
    expect(callback).toContain("consumeOAuthAuthorizationAttempt");
    expect(callback).toContain("persistAuthorizedConnector");
  });

  it("keeps the persistence guard for all other TokMetric operations", () => {
    const security = source("src/lib/tokmetric/security.ts");
    expect(security).toContain("assertTokMetricPersistenceAuthority");
    expect(security).toContain("TOKMETRIC_GATEWAY_BACKEND_REQUIRED");
    const publishingCancel = source("src/app/api/tokmetric/publishing/cancel/route.ts");
    expect(publishingCancel).toContain("requireActiveTokMetricSession");
    const agents = source("src/app/api/tokmetric/agents/route.ts");
    expect(agents).toContain("requireTokMetricSession");
    expect(agents).toContain("requireWorkspaceAccess");
  });

  it("leaves the unified social-media OAuth path on connector authority", () => {
    for (const path of [
      "src/app/api/social-media/oauth/[provider]/start/route.ts",
      "src/app/api/social-media/oauth/[provider]/callback/route.ts",
      "src/app/api/social-media/connectors/route.ts",
    ]) {
      const route = source(path);
      expect(route).toContain("requireSocialConnectorSession");
      expect(route).toContain("requireSocialConnectorWorkspace");
      expect(route).not.toContain("requireTokMetricSession");
    }
  });
});
