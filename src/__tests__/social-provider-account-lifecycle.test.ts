import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  SocialOAuthProvider,
  SocialOAuthProviderConfig,
} from "@/lib/social-media/oauth/config";
import { discoverSocialAccounts } from "@/lib/social-media/oauth/discovery";
import { refreshSocialAccessToken } from "@/lib/social-media/oauth/client";
import { evaluateSocialCredentialLifecycle } from "@/lib/social-media/oauth/lifecycle";
import type { StoredSocialCredential } from "@/lib/social-media/oauth/store";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function providerConfig(
  provider: SocialOAuthProvider,
  overrides: Partial<SocialOAuthProviderConfig> = {},
): SocialOAuthProviderConfig {
  return {
    provider,
    displayName: provider,
    enabled: true,
    clientId: `${provider.toLowerCase()}-client`,
    clientSecret: `${provider.toLowerCase()}-secret`,
    redirectUri: `https://gemcybersecurityassist.com/api/social-media/oauth/${provider.toLowerCase()}/callback`,
    authorizationUrl: "https://provider.example/authorize",
    tokenUrl: "https://provider.example/token",
    accountDiscoveryUrl: "https://provider.example/me",
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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("social provider account discovery and credential lifecycle", () => {
  it("discovers the authenticated X account without retaining the raw response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: "2244994945",
          name: "GEM Enterprise",
          username: "GEMEnterprise",
          verified: true,
          protected: false,
          description: "raw provider field that is intentionally not persisted",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await discoverSocialAccounts({
      config: providerConfig("X", {
        accountDiscoveryUrl: "https://api.x.com/2/users/me",
        refreshMode: "STANDARD",
        usePkce: true,
      }),
      credential: credential("X", { refreshToken: "x-refresh" }),
    });

    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      externalAccountId: "2244994945",
      displayName: "GEM Enterprise",
      username: "GEMEnterprise",
      accountType: "X_USER",
    });
    expect(accounts[0].safeMetadata).toEqual({
      username: "GEMEnterprise",
      verified: true,
      protected: false,
    });
    expect(JSON.stringify(accounts[0].safeMetadata)).not.toContain("description");
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/2/users/me");
  });

  it("discovers every managed Meta Page and scopes each Page access token to its connector", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            {
              id: "page-1",
              name: "GEM Cybersecurity",
              access_token: "page-secret-1",
              tasks: ["PROFILE_PLUS_CREATE_CONTENT", "PROFILE_PLUS_ANALYZE"],
              instagram_business_account: {
                id: "ig-1",
                username: "gemcybersecurityassist",
                name: "GEM Cybersecurity",
              },
            },
            {
              id: "page-2",
              name: "Alliance Trust Realty",
              access_token: "page-secret-2",
              tasks: ["PROFILE_PLUS_CREATE_CONTENT"],
            },
          ],
        }),
      ),
    );

    const accounts = await discoverSocialAccounts({
      config: providerConfig("META", {
        accountDiscoveryUrl: "https://graph.facebook.com/v24.0/me/accounts",
      }),
      credential: credential("META", { accessToken: "user-token" }),
    });

    expect(accounts.map((account) => account.externalAccountId)).toEqual(["page-1", "page-2"]);
    expect(accounts[0].credential.accessToken).toBe("page-secret-1");
    expect(accounts[1].credential.accessToken).toBe("page-secret-2");
    expect(accounts[0].safeMetadata).toMatchObject({
      linkedInstagramAccountPresent: true,
      instagramBusinessAccountId: "ig-1",
      instagramUsername: "gemcybersecurityassist",
    });
    expect(JSON.stringify(accounts.map((account) => account.safeMetadata))).not.toContain(
      "page-secret",
    );
  });

  it("discovers multiple YouTube channels and Nextdoor profiles deterministically", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: "channel-b", snippet: { title: "Channel B" }, status: { privacyStatus: "public" } },
            { id: "channel-a", snippet: { title: "Channel A", customUrl: "@channel-a" } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          profiles: [
            { id: "profile-2", name: "Neighborhood Profile" },
            {
              id: "profile-1",
              is_entity_profile: true,
              entity_page: { id: "entity-1", name: "GEM Local Business" },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const youtube = await discoverSocialAccounts({
      config: providerConfig("YOUTUBE", {
        accountDiscoveryUrl: "https://www.googleapis.com/youtube/v3/channels",
        refreshMode: "STANDARD",
      }),
      credential: credential("YOUTUBE"),
    });
    const nextdoor = await discoverSocialAccounts({
      config: providerConfig("NEXTDOOR", {
        accountDiscoveryUrl: "https://nextdoor.com/external/api/partner/v1/me/profiles/",
      }),
      credential: credential("NEXTDOOR"),
    });

    expect(youtube.map((account) => account.externalAccountId)).toEqual([
      "channel-a",
      "channel-b",
    ]);
    expect(nextdoor.map((account) => account.externalAccountId)).toEqual([
      "profile-1",
      "profile-2",
    ]);
    expect(nextdoor[0].accountType).toBe("NEXTDOOR_ENTITY_PROFILE");
  });

  it("classifies healthy, refreshable, and reauthorization-only credentials", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    const x = providerConfig("X", { refreshMode: "STANDARD" });
    const linkedIn = providerConfig("LINKEDIN", { refreshMode: "REAUTHORIZE" });

    expect(
      evaluateSocialCredentialLifecycle(
        x,
        credential("X", { expiresAt: "2026-07-22T13:00:00.000Z", refreshToken: "refresh" }),
        now,
      ).lifecycle,
    ).toBe("HEALTHY");
    expect(
      evaluateSocialCredentialLifecycle(
        x,
        credential("X", { expiresAt: "2026-07-22T11:59:00.000Z", refreshToken: "refresh" }),
        now,
      ),
    ).toMatchObject({ lifecycle: "EXPIRED_REFRESHABLE", shouldRefresh: true });
    expect(
      evaluateSocialCredentialLifecycle(
        linkedIn,
        credential("LINKEDIN", { expiresAt: "2026-07-22T11:59:00.000Z" }),
        now,
      ),
    ).toMatchObject({
      lifecycle: "REAUTHORIZATION_REQUIRED",
      connectorState: "REAUTHORIZATION_REQUIRED",
      shouldRefresh: false,
    });
  });

  it("rotates standard refresh credentials while preserving a non-rotated refresh token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "rotated-access-token",
        token_type: "bearer",
        expires_in: 7200,
        scope: "tweet.read users.read offline.access",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const config = providerConfig("X", {
      tokenUrl: "https://api.x.com/2/oauth2/token",
      tokenClientAuthentication: "BASIC",
      refreshMode: "STANDARD",
      scopes: ["tweet.read", "users.read", "offline.access"],
    });
    const refreshed = await refreshSocialAccessToken({
      config,
      credential: credential("X", {
        refreshToken: "existing-refresh-token",
        externalAccountId: "x-account",
        expiresAt: "2026-07-22T11:00:00.000Z",
      }),
    });

    expect(refreshed.credential.accessToken).toBe("rotated-access-token");
    expect(refreshed.credential.refreshToken).toBe("existing-refresh-token");
    expect(refreshed.credential.externalAccountId).toBe("x-account");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(request.body)).toContain("grant_type=refresh_token");
    expect(String(request.body)).toContain("refresh_token=existing-refresh-token");
    expect(String(request.headers)).not.toContain("existing-refresh-token");
  });

  it("keeps discovery, persistence, lifecycle checks, and UI fail-closed", () => {
    const callback = source("src/app/api/social-media/oauth/[provider]/callback/route.ts");
    const health = source("src/app/api/social-media/connectors/health/route.ts");
    const accountStore = source("src/lib/social-media/oauth/account-store.ts");
    const panel = source("src/components/social-media/SocialConnectorPanel.tsx");

    expect(callback).toContain("discoverSocialAccounts");
    expect(callback).toContain("persistDiscoveredSocialConnectors");
    expect(callback).toContain("providerAccountDiscoveryPerformed: true");
    expect(accountStore).toContain("database.$transaction");
    expect(accountStore).toContain("externalPublishingEnabled: false");
    expect(health).toContain("requireSameOrigin(request)");
    expect(health).toContain('requirePermission(membership, "manage", "connectors")');
    expect(health).toContain('enforceEmergencyLocks(workspaceId, "connector", database)');
    expect(health).toContain("externalPublishingActionTaken: false");
    expect(panel).toContain("Check credential health");
    expect(panel).toContain("do not enable publishing");
    expect(panel).not.toContain("Publish now");
  });
});
