import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExperianAuthorizationUrl,
  exchangeExperianAuthorizationCode,
  requestExperianDeveloperToken,
  verifyExperianRead,
} from "@/lib/experian/client";
import {
  getExperianConfig,
  getSafeExperianReadiness,
  isExperianUrl,
  validateExperianConfig,
} from "@/lib/experian/config";
import {
  decryptExperianCredential,
  encryptExperianCredential,
} from "@/lib/experian/crypto";
import { decodeExperianState, encodeExperianState } from "@/lib/experian/state";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function configureDeveloperMode() {
  vi.stubEnv("EXPERIAN_CONNECTION_ENABLED", "true");
  vi.stubEnv("EXPERIAN_ENVIRONMENT", "sandbox");
  vi.stubEnv("EXPERIAN_AUTH_MODE", "DEVELOPER_PASSWORD");
  vi.stubEnv("EXPERIAN_CLIENT_ID", "experian-client-id");
  vi.stubEnv("EXPERIAN_CLIENT_SECRET", "experian-client-secret");
  vi.stubEnv("EXPERIAN_DEVELOPER_USERNAME", "developer-user");
  vi.stubEnv("EXPERIAN_DEVELOPER_PASSWORD", "developer-password");
  vi.stubEnv("EXPERIAN_TOKEN_URL", "https://sandbox-us-api.experian.com/oauth2/v1/token");
  vi.stubEnv("EXPERIAN_IDENTITY_URL", "https://sandbox-us-api.experian.com/connect/v3/me");
  vi.stubEnv("EXPERIAN_IDENTITY_ID_PATH", "account.id");
  vi.stubEnv("EXPERIAN_APPROVED_CAPABILITIES", "credit-report:read");
  vi.stubEnv("EXPERIAN_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));
  vi.stubEnv("EXPERIAN_STATE_SECRET", "experian-state-secret-for-tests");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Experian account connection", () => {
  it("fails closed until the provider contract and encryption are configured", () => {
    const readiness = validateExperianConfig();
    expect(readiness.ok).toBe(false);
    expect(readiness.missing).toEqual(
      expect.arrayContaining([
        "EXPERIAN_CONNECTION_ENABLED",
        "EXPERIAN_CLIENT_ID",
        "EXPERIAN_CLIENT_SECRET",
        "EXPERIAN_IDENTITY_URL",
        "EXPERIAN_TOKEN_ENCRYPTION_KEY",
      ]),
    );
  });

  it("accepts only HTTPS Experian endpoints", () => {
    expect(isExperianUrl("https://sandbox-us-api.experian.com/oauth2/v1/token")).toBe(true);
    expect(isExperianUrl("http://sandbox-us-api.experian.com/oauth2/v1/token")).toBe(false);
    expect(isExperianUrl("https://experian.com.attacker.example/token")).toBe(false);
    expect(isExperianUrl("https://example.com/experian/token")).toBe(false);
  });

  it("recognizes a complete documented Developer Portal configuration", () => {
    configureDeveloperMode();
    const readiness = validateExperianConfig();
    expect(readiness.ok).toBe(true);
    expect(readiness.config.authMode).toBe("DEVELOPER_PASSWORD");
    const safe = JSON.stringify(getSafeExperianReadiness());
    expect(safe).not.toContain("experian-client-secret");
    expect(safe).not.toContain("developer-password");
  });

  it("requires explicit provider approval for consumer authorization", () => {
    configureDeveloperMode();
    vi.stubEnv("EXPERIAN_AUTH_MODE", "AUTHORIZATION_CODE");
    vi.stubEnv("EXPERIAN_DEVELOPER_USERNAME", "");
    vi.stubEnv("EXPERIAN_DEVELOPER_PASSWORD", "");
    vi.stubEnv("EXPERIAN_AUTHORIZATION_URL", "https://connect.experian.com/oauth/authorize");
    vi.stubEnv("EXPERIAN_REDIRECT_URI", "https://gemcybersecurityassist.com/api/integrations/experian/callback");
    vi.stubEnv("EXPERIAN_SCOPES", "openid report.read");
    vi.stubEnv("EXPERIAN_TOKEN_CLIENT_AUTHENTICATION", "BODY");
    expect(validateExperianConfig().missing).toContain("EXPERIAN_CONSUMER_DELEGATION_APPROVED");
    vi.stubEnv("EXPERIAN_CONSUMER_DELEGATION_APPROVED", "true");
    expect(validateExperianConfig().ok).toBe(true);
  });

  it("keeps the client secret out of the hosted authorization URL", () => {
    configureDeveloperMode();
    vi.stubEnv("EXPERIAN_AUTH_MODE", "AUTHORIZATION_CODE");
    vi.stubEnv("EXPERIAN_AUTHORIZATION_URL", "https://connect.experian.com/oauth/authorize");
    vi.stubEnv("EXPERIAN_REDIRECT_URI", "https://gemcybersecurityassist.com/api/integrations/experian/callback");
    vi.stubEnv("EXPERIAN_SCOPES", "openid report.read");
    vi.stubEnv("EXPERIAN_TOKEN_CLIENT_AUTHENTICATION", "BODY");
    vi.stubEnv("EXPERIAN_CONSUMER_DELEGATION_APPROVED", "true");
    const config = getExperianConfig();
    const url = buildExperianAuthorizationUrl({
      config,
      state: "signed-state",
      codeChallenge: "pkce-challenge",
    });
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(url.toString()).not.toContain("experian-client-secret");
  });

  it("supports provider-issued Basic client authentication for code exchange", async () => {
    configureDeveloperMode();
    vi.stubEnv("EXPERIAN_AUTH_MODE", "AUTHORIZATION_CODE");
    vi.stubEnv("EXPERIAN_TOKEN_CLIENT_AUTHENTICATION", "BASIC");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "access-token", token_type: "Bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await exchangeExperianAuthorizationCode({
      config: getExperianConfig(),
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      requestedScopes: ["report.read"],
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    const body = new URLSearchParams(String(init.body));
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("experian-client-id:experian-client-secret").toString("base64")}`,
    );
    expect(body.get("client_id")).toBeNull();
    expect(body.get("client_secret")).toBeNull();
    expect(body.get("code_verifier")).toBe("pkce-verifier");
  });

  it("uses Experian's documented password-grant request without exposing it to the browser", async () => {
    configureDeveloperMode();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "header.eyJzdWIiOiJkZXZlbG9wZXItYWNjb3VudCJ9.signature",
          refresh_token: "refresh-token",
          token_type: "Bearer",
          expires_in: "1800",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const credential = await requestExperianDeveloperToken(getExperianConfig());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Grant_type")).toBe("password");
    expect(JSON.parse(String(init.body))).toMatchObject({
      username: "developer-user",
      password: "developer-password",
      client_id: "experian-client-id",
      client_secret: "experian-client-secret",
    });
    expect(credential.tokenSubject).toBe("developer-account");
  });

  it("requires a successful read and returns only an opaque account reference and digest", async () => {
    configureDeveloperMode();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            account: { id: "raw-account-id", label: "Sandbox application" },
            report: { score: 812, fullName: "Never Persist This" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const verified = await verifyExperianRead({
      config: getExperianConfig(),
      credential: {
        accessToken: "access-token",
        tokenType: "Bearer",
        grantedScopes: [],
      },
    });
    expect(verified.externalAccountReference).toMatch(/^[a-f0-9]{64}$/);
    expect(verified.externalAccountReference).not.toContain("raw-account-id");
    expect(verified.responseDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(verified.displayLabel).toBe("Experian sandbox API account");
    expect(JSON.stringify(verified)).not.toContain("Never Persist This");
    expect(JSON.stringify(verified)).not.toContain("812");
  });

  it("encrypts credentials and rejects state tampering", () => {
    configureDeveloperMode();
    const encrypted = encryptExperianCredential({ accessToken: "secret-token" });
    expect(encrypted).not.toContain("secret-token");
    expect(decryptExperianCredential(encrypted)).toEqual({ accessToken: "secret-token" });

    const state = encodeExperianState({
      nonce: "nonce",
      workspaceId: "workspace",
      actorId: "actor",
      createdAt: Date.now(),
    });
    expect(decodeExperianState(state).workspaceId).toBe("workspace");
    const [body, signature] = state.split(".");
    expect(() => decodeExperianState(`${body}x.${signature}`)).toThrow();
  });

  it("provisions protected tables and protected lifecycle routes", () => {
    const migration = source(
      "prisma/migrations/20260925150000_experian_account_connection/migration.sql",
    );
    expect(migration).toContain('CREATE TABLE "experian_connections"');
    expect(migration).toContain('CREATE TABLE "experian_connection_credentials"');
    expect(migration).toContain('CREATE TABLE "experian_authorization_attempts"');
    expect(migration).toContain('ALTER TABLE "experian_connection_credentials" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "experian_connection_credentials" FROM PUBLIC');

    for (const path of [
      "src/app/api/integrations/experian/connect/route.ts",
      "src/app/api/integrations/experian/verify/route.ts",
      "src/app/api/integrations/experian/disconnect/route.ts",
    ]) {
      const route = source(path);
      expect(route).toContain("authorizeExperianWorkspace");
      expect(route).toContain("requireSameOriginExperianMutation");
    }
    expect(source("src/app/api/integrations/experian/start/route.ts")).toContain(
      "createExperianAuthorizationAttempt",
    );
    expect(source("src/app/api/integrations/experian/callback/route.ts")).toContain(
      "consumeExperianAuthorizationAttempt",
    );
  });
});
