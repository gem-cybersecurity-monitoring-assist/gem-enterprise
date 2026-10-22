import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  db: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

// The sandbox cannot run `prisma generate` (engine download is blocked), so the
// generated client is absent. Tests double only the `Prisma.sql` template tag
// used by the raw-SQL stores; production code is untouched.
vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join("?"),
      values,
    }),
  },
}));

import { TokMetricError } from "@/lib/tokmetric/security";
import {
  getSocialOAuthProviderConfig,
  parseSocialOAuthProvider,
  socialOAuthProviders,
  validateSocialOAuthProviderConfig,
  type SocialOAuthProvider,
  type SocialOAuthProviderConfig,
} from "@/lib/social-media/oauth/config";
import {
  buildSocialAuthorizationUrl,
  exchangeSocialAuthorizationCode,
  refreshSocialAccessToken,
} from "@/lib/social-media/oauth/client";
import { discoverSocialAccounts } from "@/lib/social-media/oauth/discovery";
import { evaluateSocialCredentialLifecycle } from "@/lib/social-media/oauth/lifecycle";
import { getUnifiedTikTokProviderConfig } from "@/lib/social-media/oauth/tiktok-adapter";
import {
  buildLiveProbeMetadata,
  probeSocialConnector,
  readLiveProbeSignal,
} from "@/lib/social-media/oauth/probes";
import { revokeSocialProviderGrant } from "@/lib/social-media/oauth/revocation";
import { disconnectSocialConnector } from "@/lib/social-media/oauth/connectors";
import {
  assertSocialProviderPauseAdmin,
  getPausedSocialProviders,
  pauseSocialProvider,
  unpauseSocialProvider,
} from "@/lib/social-media/oauth/provider-pause";
import { encryptSocialCredential } from "@/lib/social-media/oauth/crypto";
import type { StoredSocialCredential } from "@/lib/social-media/oauth/store";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubEncryptionKey() {
  vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
}

function stubTikTokEnv() {
  stubEncryptionKey();
  vi.stubEnv("TOKMETRIC_TIKTOK_OAUTH_ENABLED", "true");
  vi.stubEnv("TIKTOK_CLIENT_KEY", "tiktok-client-key");
  vi.stubEnv("TIKTOK_CLIENT_SECRET", "tiktok-client-secret");
  vi.stubEnv(
    "TIKTOK_REDIRECT_URI",
    "https://gemcybersecurityassist.com/api/tokmetric/oauth/callback",
  );
  vi.stubEnv(
    "TIKTOK_SOCIAL_REDIRECT_URI",
    "https://gemcybersecurityassist.com/api/social-media/oauth/tiktok/callback",
  );
  vi.stubEnv("TIKTOK_APP_AUDIT_APPROVED", "true");
}

function stubMetaEnv() {
  stubEncryptionKey();
  vi.stubEnv("META_SOCIAL_OAUTH_ENABLED", "true");
  vi.stubEnv("META_APP_ID", "meta-app-id");
  vi.stubEnv("META_APP_SECRET", "meta-app-secret");
  vi.stubEnv("META_GRAPH_API_VERSION", "v21.0");
  vi.stubEnv("META_SOCIAL_SCOPES", "pages_show_list pages_read_engagement");
  vi.stubEnv(
    "META_OAUTH_REDIRECT_URI",
    "https://gemcybersecurityassist.com/api/social-media/oauth/meta/callback",
  );
  vi.stubEnv("META_APP_REVIEW_APPROVED", "true");
}

function stubXEnv() {
  stubEncryptionKey();
  vi.stubEnv("X_SOCIAL_OAUTH_ENABLED", "true");
  vi.stubEnv("X_CLIENT_ID", "x-client-id");
  vi.stubEnv("X_CLIENT_SECRET", "x-client-secret");
  vi.stubEnv("X_SOCIAL_SCOPES", "tweet.read users.read offline.access");
  vi.stubEnv(
    "X_OAUTH_REDIRECT_URI",
    "https://gemcybersecurityassist.com/api/social-media/oauth/x/callback",
  );
}

function probeConfig(
  provider: SocialOAuthProvider,
  overrides: Partial<SocialOAuthProviderConfig> = {},
): SocialOAuthProviderConfig {
  return {
    provider,
    displayName: provider,
    enabled: true,
    clientId: `${provider.toLowerCase()}-client`,
    clientSecret: `${provider.toLowerCase()}-secret`,
    redirectUri: "https://gemcybersecurityassist.com/api/social-media/oauth/callback",
    authorizationUrl: "https://provider.example/authorize",
    tokenUrl:
      provider === "META"
        ? "https://graph.facebook.com/v21.0/oauth/access_token"
        : "https://provider.example/token",
    accountDiscoveryUrl: "https://provider.example/discover",
    scopes: ["profile"],
    usePkce: false,
    tokenClientAuthentication: "BODY",
    refreshMode: "NONE",
    additionalAuthorizationParameters: {},
    ...overrides,
  };
}

function credential(
  provider: SocialOAuthProvider,
  overrides: Partial<StoredSocialCredential> = {},
): StoredSocialCredential {
  return {
    provider,
    accessToken: `${provider.toLowerCase()}-access-token`,
    grantedScopes: ["profile"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("WS-A: TikTok unification", () => {
  it("adds TIKTOK to the unified OAuth provider set", () => {
    expect(socialOAuthProviders).toContain("TIKTOK");
    expect(parseSocialOAuthProvider("tiktok")).toBe("TIKTOK");
    expect(() => parseSocialOAuthProvider("indeed")).toThrow("not supported");
  });

  it("builds the unified TikTok config from the legacy credential source", () => {
    stubTikTokEnv();
    const config = getUnifiedTikTokProviderConfig();
    expect(config.provider).toBe("TIKTOK");
    expect(config.enabled).toBe(true);
    expect(config.clientId).toBe("tiktok-client-key");
    expect(config.clientSecret).toBe("tiktok-client-secret");
    expect(config.usePkce).toBe(true);
    expect(config.refreshMode).toBe("STANDARD");
    expect(config.clientIdTokenParameter).toBe("client_key");
    expect(config.scopes).toEqual(["user.info.basic"]);
    expect(config.authorizationUrl).toContain("tiktok.com");
  });

  it("validates the unified TikTok provider config", () => {
    stubTikTokEnv();
    const result = validateSocialOAuthProviderConfig("TIKTOK");
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("fails closed when the unified TikTok callback URL is missing", () => {
    stubTikTokEnv();
    vi.stubEnv("TIKTOK_SOCIAL_REDIRECT_URI", "");
    const result = validateSocialOAuthProviderConfig("TIKTOK");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("TIKTOK_SOCIAL_REDIRECT_URI");
  });

  it("fails closed when TikTok audit approval is missing", () => {
    stubTikTokEnv();
    vi.stubEnv("TIKTOK_APP_AUDIT_APPROVED", "");
    const result = validateSocialOAuthProviderConfig("TIKTOK");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("TIKTOK_APP_AUDIT_APPROVED");
  });

  it("builds a TikTok authorization URL with client_key and comma scopes", () => {
    stubTikTokEnv();
    const config = getSocialOAuthProviderConfig("TIKTOK");
    const url = buildSocialAuthorizationUrl({ config, state: "state-1", codeChallenge: "challenge-1" });
    expect(url.searchParams.get("client_key")).toBe("tiktok-client-key");
    expect(url.searchParams.get("client_id")).toBeNull();
    expect(url.searchParams.get("scope")).toBe("user.info.basic");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.toString()).not.toContain("tiktok-client-secret");
  });

  it("exchanges a TikTok authorization code with client_key body auth (mocked)", async () => {
    stubTikTokEnv();
    const seen: Array<{ url: string; body: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: URL, init: RequestInit) => {
        seen.push({ url: url.toString(), body: String(init.body) });
        return jsonResponse({
          access_token: "tiktok-access-token",
          refresh_token: "tiktok-refresh-token",
          expires_in: 86400,
          refresh_expires_in: 31536000,
          scope: "user.info.basic",
          open_id: "open-id-123",
          token_type: "Bearer",
        });
      }),
    );

    const config = getSocialOAuthProviderConfig("TIKTOK");
    const { credential: exchanged } = await exchangeSocialAuthorizationCode({
      config,
      code: "auth-code",
      codeVerifier: "verifier",
      requestedScopes: ["user.info.basic"],
    });

    expect(seen).toHaveLength(1);
    const body = new URLSearchParams(seen[0]!.body);
    expect(body.get("client_key")).toBe("tiktok-client-key");
    expect(body.get("client_id")).toBeNull();
    expect(body.get("code_verifier")).toBe("verifier");
    expect(exchanged.accessToken).toBe("tiktok-access-token");
    expect(exchanged.refreshToken).toBe("tiktok-refresh-token");
    expect(exchanged.externalAccountId).toBe("open-id-123");
    expect(exchanged.expiresAt).toBeDefined();
  });

  it("discovers the TikTok account via user/info (mocked)", async () => {
    stubTikTokEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            user: {
              open_id: "open-id-123",
              display_name: "GEM TikTok",
              username: "gemtiktok",
            },
          },
          error: { code: "ok" },
        }),
      ),
    );

    const accounts = await discoverSocialAccounts({
      config: getSocialOAuthProviderConfig("TIKTOK"),
      credential: credential("TIKTOK"),
    });

    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.accountType).toBe("TIKTOK_ACCOUNT");
    expect(accounts[0]!.externalAccountId).toBe("open-id-123");
    expect(accounts[0]!.displayName).toBe("GEM TikTok");
  });
});

describe("WS-A: Meta long-lived token refresh", () => {
  it("uses LONG_LIVED_EXCHANGE refresh mode for Meta", () => {
    stubMetaEnv();
    expect(getSocialOAuthProviderConfig("META").refreshMode).toBe("LONG_LIVED_EXCHANGE");
  });

  it("exchanges a Meta token via fb_exchange_token (mocked)", async () => {
    stubMetaEnv();
    const seen: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: URL, init: RequestInit) => {
        seen.push({ url: url.toString(), method: init.method });
        return jsonResponse({
          access_token: "meta-long-lived-token",
          token_type: "bearer",
          expires_in: 5184000,
        });
      }),
    );

    const config = getSocialOAuthProviderConfig("META");
    const before = Date.now();
    const { credential: refreshed } = await refreshSocialAccessToken({
      config,
      credential: credential("META", {
        accessToken: "meta-short-lived-token",
        grantedScopes: ["pages_show_list"],
      }),
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe("GET");
    const url = new URL(seen[0]!.url);
    expect(url.pathname).toBe("/v21.0/oauth/access_token");
    expect(url.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(url.searchParams.get("client_id")).toBe("meta-app-id");
    expect(url.searchParams.get("client_secret")).toBe("meta-app-secret");
    expect(url.searchParams.get("fb_exchange_token")).toBe("meta-short-lived-token");
    expect(refreshed.accessToken).toBe("meta-long-lived-token");
    const expiresAt = Date.parse(refreshed.expiresAt!);
    expect(expiresAt).toBeGreaterThanOrEqual(before + 5184000 * 1000 - 60_000);
  });

  it("treats Meta as refresh-supported without a refresh token", () => {
    stubMetaEnv();
    const config = getSocialOAuthProviderConfig("META");
    const result = evaluateSocialCredentialLifecycle(
      config,
      credential("META", {
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
    );
    expect(result.refreshSupported).toBe(true);
    expect(result.shouldRefresh).toBe(true);
    expect(result.connectorState).toBe("DEGRADED");
  });

  it("maps Meta exchange rejection to reauthorization and outages to unavailable", async () => {
    stubMetaEnv();
    const config = getSocialOAuthProviderConfig("META");
    const stored = credential("META");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Invalid token" } }, 400)),
    );
    await expect(refreshSocialAccessToken({ config, credential: stored })).rejects.toMatchObject({
      code: "SOCIAL_TOKEN_REFRESH_REJECTED",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Down" } }, 500)),
    );
    await expect(refreshSocialAccessToken({ config, credential: stored })).rejects.toMatchObject({
      code: "SOCIAL_TOKEN_REFRESH_UNAVAILABLE",
    });
  });
});

describe("WS-A: disconnect revocation", () => {
  it("records not_supported without any HTTP call for LinkedIn", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await revokeSocialProviderGrant({
      config: probeConfig("LINKEDIN"),
      credential: credential("LINKEDIN"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.supported).toBe(false);
    expect(result.outcome).toBe("not_supported");
    expect(Date.parse(result.attemptedAt)).not.toBeNaN();
  });

  it("revokes Meta grants via DELETE on /me/permissions (mocked)", async () => {
    stubMetaEnv();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await revokeSocialProviderGrant({
      config: getSocialOAuthProviderConfig("META"),
      // Unified Meta connectors store Page/Instagram ids, not the user id, so
      // revocation must target the token holder (/me), not the stored id.
      credential: credential("META", { externalAccountId: "page-123" }),
    });
    expect(result.outcome).toBe("revoked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("DELETE");
    expect(String(url)).toContain("/me/permissions");
    expect(String(url)).not.toContain("/page-123/permissions");
    expect(init.headers.Authorization).toBe("Bearer meta-access-token");
  });

  it("revokes X tokens via POST /2/oauth2/revoke (mocked)", async () => {
    stubXEnv();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const result = await revokeSocialProviderGrant({
      config: getSocialOAuthProviderConfig("X"),
      credential: credential("X"),
    });
    expect(result.outcome).toBe("revoked");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.x.com/2/oauth2/revoke");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("token")).toBe("x-access-token");
    expect(body.get("token_type_hint")).toBe("access_token");
    expect(init.headers.Authorization).toMatch(/^Basic /);
  });

  it("never throws: transport failure becomes a recorded failure", async () => {
    stubMetaEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    const result = await revokeSocialProviderGrant({
      config: getSocialOAuthProviderConfig("META"),
      credential: credential("META"),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toBeDefined();
  });

  it("attempts revocation and records the outcome on disconnect", async () => {
    stubXEnv();
    const stored = credential("X", { externalAccountId: "x-user-1" });
    const secretRef = encryptSocialCredential(stored);
    dbMocks.db.$queryRaw.mockResolvedValueOnce([
      {
        id: "conn-1",
        workspaceId: "ws-1",
        provider: "X",
        state: "CONNECTED",
        displayName: "X Company",
        externalAccountId: "x-user-1",
        grantedScopes: ["tweet.read"],
        safeMetadata: {},
        lastHealthAt: null,
        disabledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        secretRef,
        credentialExpiresAt: null,
        credentialRefreshExpiresAt: null,
        credentialRotatedAt: null,
      },
    ]);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "conn-1" }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    dbMocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    const result = await disconnectSocialConnector({ workspaceId: "ws-1", connectorId: "conn-1" });

    expect(result.connectorId).toBe("conn-1");
    expect(result.externalRevocationAttempted).toBe(true);
    expect(result.externalRevocationOutcome).toBe("revoked");
    expect(Date.parse(result.externalRevocationAt)).not.toBeNaN();
    // Local credential deletion still runs inside the transaction.
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalled();
    // The revocation outcome is merged into the connector metadata.
    const updateCall = tx.$queryRaw.mock.calls[0]![0] as { values: unknown[] };
    const metadataValue = updateCall.values.find(
      (value) => typeof value === "string" && value.includes("externalRevocationAttempted"),
    ) as string;
    expect(metadataValue).toBeDefined();
    const metadata = JSON.parse(metadataValue);
    expect(metadata.externalRevocationAttempted).toBe(true);
    expect(metadata.externalRevocationOutcome).toBe("revoked");
    expect(metadata.externalRevocationAt).toBe(result.externalRevocationAt);
  });

  it("still deletes local credentials when revocation fails", async () => {
    stubXEnv();
    const stored = credential("X", { externalAccountId: "x-user-1" });
    const secretRef = encryptSocialCredential(stored);
    dbMocks.db.$queryRaw.mockResolvedValueOnce([
      {
        id: "conn-2",
        workspaceId: "ws-1",
        provider: "X",
        state: "CONNECTED",
        displayName: "X Company",
        externalAccountId: "x-user-1",
        grantedScopes: ["tweet.read"],
        safeMetadata: {},
        lastHealthAt: null,
        disabledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        secretRef,
        credentialExpiresAt: null,
        credentialRefreshExpiresAt: null,
        credentialRotatedAt: null,
      },
    ]);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "conn-2" }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    dbMocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 500)));

    const result = await disconnectSocialConnector({ workspaceId: "ws-1", connectorId: "conn-2" });

    expect(result.externalRevocationAttempted).toBe(true);
    expect(result.externalRevocationOutcome).toBe("failed");
    expect(result.externalRevocationError).toBeDefined();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
});

describe("WS-A: read-only connector probe", () => {
  it("issues only GET requests for every provider", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: URL, init: RequestInit) => {
        calls.push({ url: url.toString(), method: init.method });
        const host = url.hostname;
        if (host.includes("facebook")) return jsonResponse({ id: "1", name: "Page" });
        if (host.includes("x.com")) return jsonResponse({ data: { id: "1", name: "GEM" } });
        if (host.includes("linkedin")) return jsonResponse({ elements: [] });
        if (host.includes("googleapis")) {
          return jsonResponse({ items: [{ id: "c", snippet: { title: "Channel" } }] });
        }
        if (host.includes("nextdoor")) {
          return jsonResponse({ profiles: [{ id: "p", business_name: "Biz" }] });
        }
        return jsonResponse({ data: { user: { open_id: "o", display_name: "TT" } } });
      }),
    );

    for (const provider of socialOAuthProviders) {
      const result = await probeSocialConnector({
        config: probeConfig(provider),
        credential: credential(provider, { externalAccountId: "ext-1" }),
      });
      expect(result.healthy).toBe(true);
      expect(result.checkedAt).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.scopes).toEqual(["profile"]);
    }

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.method).toBe("GET");
    }
  });

  it("reports unhealthy on provider auth failure without mutating", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: URL, init: RequestInit) => {
        calls.push(init.method || "GET");
        return jsonResponse({ error: "invalid token" }, 401);
      }),
    );
    const result = await probeSocialConnector({
      config: probeConfig("META"),
      credential: credential("META"),
    });
    expect(result.healthy).toBe(false);
    expect(result.accountName).toBeNull();
    expect(calls).toEqual(["GET"]);
  });

  it("never presents config-only state as a live probe", () => {
    expect(readLiveProbeSignal({})).toEqual({
      lastProbedAt: null,
      probeOk: null,
      source: "config",
    });
    expect(
      readLiveProbeSignal({
        liveProbeAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        liveProbeOk: true,
      }).source,
    ).toBe("config");
    const fresh = readLiveProbeSignal({
      liveProbeAt: new Date().toISOString(),
      liveProbeOk: true,
    });
    expect(fresh.source).toBe("live");
    expect(fresh.probeOk).toBe(true);
    expect(fresh.lastProbedAt).toBeDefined();
  });

  it("builds persistable live-probe metadata", () => {
    const metadata = buildLiveProbeMetadata({
      healthy: true,
      latencyMs: 42,
      accountName: "Page",
      scopes: ["a"],
      checkedAt: "2026-09-29T12:00:00.000Z",
    });
    expect(metadata.providerProbePerformed).toBe(true);
    expect(metadata.liveProbeAt).toBe("2026-09-29T12:00:00.000Z");
    expect(metadata.liveProbeOk).toBe(true);
    expect(metadata.liveProbeAccountName).toBe("Page");
  });
});

describe("WS-A: provider pause", () => {
  it("pauses and unpauses a provider", async () => {
    const pausedAt = new Date();
    dbMocks.db.$queryRaw
      .mockResolvedValueOnce([
        { workspaceId: "ws-1", provider: "X", pausedAt, pausedBy: "user-1", reason: "incident" },
      ])
      .mockResolvedValueOnce([{ provider: "X" }])
      .mockResolvedValueOnce([]);

    const paused = await pauseSocialProvider({
      workspaceId: "ws-1",
      provider: "x",
      pausedBy: "user-1",
      reason: "incident",
    });
    expect(paused.provider).toBe("X");
    expect(paused.reason).toBe("incident");

    expect(await unpauseSocialProvider({ workspaceId: "ws-1", provider: "X" })).toEqual({
      provider: "X",
      wasPaused: true,
    });
    expect(await unpauseSocialProvider({ workspaceId: "ws-1", provider: "X" })).toEqual({
      provider: "X",
      wasPaused: false,
    });
  });

  it("lists paused providers for a workspace", async () => {
    dbMocks.db.$queryRaw.mockResolvedValueOnce([{ provider: "X" }, { provider: "TIKTOK" }]);
    const paused = await getPausedSocialProviders("ws-1");
    expect(new Set(paused)).toEqual(new Set(["X", "TIKTOK"]));
  });

  it("rejects unknown providers with 400", async () => {
    await expect(pauseSocialProvider({ workspaceId: "ws-1", provider: "NOPE" })).rejects.toMatchObject({
      code: "UNSUPPORTED_SOCIAL_PROVIDER",
    });
    await expect(
      unpauseSocialProvider({ workspaceId: "ws-1", provider: "NOPE" }),
    ).rejects.toBeInstanceOf(TokMetricError);
  });

  it("restricts pause management to administrators", () => {
    expect(() => assertSocialProviderPauseAdmin(null, { role: "admin" })).not.toThrow();
    expect(() =>
      assertSocialProviderPauseAdmin({ role: { name: "Owner" } }, { role: "member" }),
    ).not.toThrow();
    expect(() =>
      assertSocialProviderPauseAdmin({ role: { name: "Member" } }, { role: "member" }),
    ).toThrowError(expect.objectContaining({ code: "PERMISSION_DENIED" }));
    expect(() => assertSocialProviderPauseAdmin(null, { role: "client" })).toThrowError(
      expect.objectContaining({ code: "PERMISSION_DENIED" }),
    );
  });
});
