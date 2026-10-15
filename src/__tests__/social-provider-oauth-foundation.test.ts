import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSocialOAuthProviderConfig,
  parseSocialOAuthProvider,
  socialOAuthProviders,
  validateSocialOAuthProviderConfig,
} from "@/lib/social-media/oauth/config";
import {
  createSocialPkcePair,
  decryptSocialCredential,
  encryptSocialCredential,
} from "@/lib/social-media/oauth/crypto";
import { buildSocialAuthorizationUrl } from "@/lib/social-media/oauth/client";
import {
  decodeSocialOAuthState,
  encodeSocialOAuthState,
} from "@/lib/social-media/oauth/state";
import { getSafeSocialOAuthReadiness } from "@/lib/social-media/oauth/readiness";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function configureX() {
  vi.stubEnv("X_SOCIAL_OAUTH_ENABLED", "true");
  vi.stubEnv("X_CLIENT_ID", "x-client-id");
  vi.stubEnv("X_CLIENT_SECRET", "x-secret-that-must-not-leak");
  vi.stubEnv("X_SOCIAL_SCOPES", "tweet.read tweet.write users.read offline.access");
  vi.stubEnv(
    "X_OAUTH_REDIRECT_URI",
    "https://gemcybersecurityassist.com/api/social-media/oauth/x/callback",
  );
  vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("SOCIAL_OAUTH_STATE_SECRET", "social-state-secret-for-tests");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cross-platform social OAuth foundation", () => {
  it("supports only governed OAuth providers and excludes Indeed", () => {
    expect(socialOAuthProviders).toEqual(["META", "X", "LINKEDIN", "YOUTUBE", "NEXTDOOR"]);
    expect(parseSocialOAuthProvider("meta")).toBe("META");
    expect(() => parseSocialOAuthProvider("indeed")).toThrow("not supported");
  });

  it("fails closed when credentials, scopes, or encryption are missing", () => {
    const result = validateSocialOAuthProviderConfig("X");
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        "X_OAUTH_DISABLED",
        "CLIENT_ID",
        "CLIENT_SECRET",
        "REDIRECT_URI",
        "SCOPES",
        "SOCIAL_TOKEN_ENCRYPTION_KEY",
      ]),
    );
  });

  it("requires YouTube API audit evidence before channel discovery and upload authorization", () => {
    vi.stubEnv("YOUTUBE_SOCIAL_OAUTH_ENABLED", "true");
    vi.stubEnv("GOOGLE_SOCIAL_CLIENT_ID", "google-client");
    vi.stubEnv("GOOGLE_SOCIAL_CLIENT_SECRET", "google-secret");
    vi.stubEnv(
      "YOUTUBE_SOCIAL_SCOPES",
      "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload",
    );
    vi.stubEnv(
      "YOUTUBE_OAUTH_REDIRECT_URI",
      "https://gemcybersecurityassist.com/api/social-media/oauth/youtube/callback",
    );
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 5).toString("base64"));

    const blocked = validateSocialOAuthProviderConfig("YOUTUBE");
    expect(blocked.ok).toBe(false);
    expect(blocked.missing).toContain("YOUTUBE_DATA_API_AUDIT_APPROVED");

    vi.stubEnv("YOUTUBE_DATA_API_AUDIT_APPROVED", "true");
    expect(validateSocialOAuthProviderConfig("YOUTUBE").ok).toBe(true);
  });

  it("returns secret-safe readiness metadata", () => {
    configureX();
    const readiness = getSafeSocialOAuthReadiness();
    const serialized = JSON.stringify(readiness);
    expect(readiness.find((provider) => provider.provider === "X")?.readyToAuthorize).toBe(true);
    expect(serialized).not.toContain("x-secret-that-must-not-leak");
    expect(serialized).not.toContain(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);
    expect(readiness.every((provider) => provider.externalPublishingEnabled === false)).toBe(true);
  });

  it("uses PKCE for X and places no client secret in the authorization URL", () => {
    configureX();
    const config = getSocialOAuthProviderConfig("X");
    const pkce = createSocialPkcePair();
    const url = buildSocialAuthorizationUrl({
      config,
      state: "signed-state",
      codeChallenge: pkce.challenge,
    });
    expect(url.origin).toBe("https://x.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(url.toString()).not.toContain("x-secret-that-must-not-leak");
  });

  it("signs OAuth state and rejects tampering", () => {
    vi.stubEnv("SOCIAL_OAUTH_STATE_SECRET", "state-signing-secret");
    const encoded = encodeSocialOAuthState({
      nonce: "nonce-1",
      workspaceId: "workspace-1",
      actorId: "actor-1",
      provider: "X",
      createdAt: Date.now(),
    });
    expect(decodeSocialOAuthState(encoded)).toMatchObject({
      nonce: "nonce-1",
      workspaceId: "workspace-1",
      actorId: "actor-1",
      provider: "X",
    });
    const [body, signature] = encoded.split(".");
    expect(() => decodeSocialOAuthState(`${body}x.${signature}`)).toThrow();
  });

  it("encrypts connector credentials using authenticated encryption", () => {
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    const credential = {
      accessToken: "access-token-that-must-never-be-plaintext",
      refreshToken: "refresh-token-that-must-never-be-plaintext",
    };
    const encrypted = encryptSocialCredential(credential);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(credential.accessToken);
    expect(encrypted).not.toContain(credential.refreshToken);
    expect(decryptSocialCredential<typeof credential>(encrypted)).toEqual(credential);
  });

  it("creates additive durable tables with RLS, safe deletion, and covering indexes", () => {
    const migration = source(
      "prisma/migrations/20260722013500_social_provider_oauth_foundation/migration.sql",
    );
    const actorIndexMigration = source(
      "prisma/migrations/20260722024500_social_oauth_attempt_actor_index/migration.sql",
    );
    expect(migration).toContain('CREATE TABLE "social_connectors"');
    expect(migration).toContain('CREATE TABLE "social_connector_credentials"');
    expect(migration).toContain('CREATE TABLE "social_oauth_authorization_attempts"');
    expect(migration).toContain("social_oauth_redirect_after_check");
    expect(migration).toContain('ALTER TABLE "social_connectors" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain(
      'ALTER TABLE "social_connector_credentials" ENABLE ROW LEVEL SECURITY',
    );
    expect(migration).toContain(
      'ALTER TABLE "social_oauth_authorization_attempts" ENABLE ROW LEVEL SECURITY',
    );
    expect(migration).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE "social_connector_credentials" FROM PUBLIC',
    );
    expect(migration).toContain(
      'CONSTRAINT "social_oauth_authorization_attempts_actor_id_fkey"',
    );
    expect(migration).toMatch(
      /FOREIGN KEY \("actor_id"\) REFERENCES "users"\("id"\)\s+ON DELETE CASCADE/,
    );
    expect(actorIndexMigration).toContain(
      'CREATE INDEX "social_oauth_authorization_attempts_actor_id_idx"',
    );
    expect(actorIndexMigration).toContain(
      'ON "social_oauth_authorization_attempts"("actor_id")',
    );
    expect(migration).not.toContain("publish_enabled");
    expect(migration).not.toContain("external_write_allowed");
  });

  it("protects start, callback, persistence, inventory, and disconnect routes", () => {
    const start = source("src/app/api/social-media/oauth/[provider]/start/route.ts");
    const callback = source("src/app/api/social-media/oauth/[provider]/callback/route.ts");
    const connectors = source("src/app/api/social-media/connectors/route.ts");
    const store = source("src/lib/social-media/oauth/store.ts");
    expect(start).toContain("requireTokMetricSession");
    expect(start).toContain('requirePermission(membership, "manage", "connectors")');
    expect(start).toContain('enforceEmergencyLocks(params.workspaceId, "connector")');
    expect(start).toContain("createSocialOAuthAuthorizationAttempt");
    expect(start).toContain('response.headers.set("Cache-Control", "no-store, max-age=0")');
    expect(callback).toContain("getSessionFromRequest(request)");
    expect(callback).toContain("session.userId !== actorId");
    expect(callback).toContain('requirePermission(membership, "manage", "connectors")');
    expect(callback).toContain('enforceEmergencyLocks(state.workspaceId, "connector")');
    expect(callback).toContain("consumeSocialOAuthAuthorizationAttempt");
    expect(callback).toContain('response.headers.set("Cache-Control", "no-store, max-age=0")');
    expect(callback).toContain("externalPublishingEnabled: false");
    expect(store).toContain('await enforceEmergencyLocks(input.workspaceId, "connector")');
    expect(connectors).toContain("requireWorkspaceAccess");
    expect(connectors).toContain("requireSameOrigin(request)");
    expect(connectors).toContain("CROSS_ORIGIN_REQUEST_BLOCKED");
    expect(connectors).toContain('enforceEmergencyLocks(body.workspaceId, "connector")');
    expect(connectors).toContain("credentialDeleted: true");
    expect(connectors).not.toContain("accessToken");
    expect(connectors).not.toContain("refreshToken");
  });

  it("preserves multiple accounts and allows reauthorization after disconnect", () => {
    const panel = source("src/components/social-media/SocialConnectorPanel.tsx");
    expect(panel).toContain("connectorsByProvider");
    expect(panel).toContain('connector.state === "DISCONNECTED"');
    expect(panel).toContain("providerConnectors.map");
    expect(panel).toContain("Authorize another account");
    expect(panel).toContain("Authorize account");
    expect(panel).toContain("Delete stored authorization");
    expect(panel).toContain("do not enable publishing");
    expect(panel).not.toContain("Publish now");
  });
});
