import { afterEach, describe, expect, it, vi } from "vitest";
import type { db } from "@/lib/db";
vi.mock("@/lib/db", () => ({ db: { $queryRaw: vi.fn(() => { throw new Error("legacy database must not be used"); }) } }));
import { consumeSocialOAuthAuthorizationAttempt, createSocialOAuthAuthorizationAttempt } from "@/lib/social-media/oauth/store";
import { decryptSocialCredential } from "@/lib/social-media/oauth/crypto";
afterEach(() => vi.unstubAllEnvs());
describe("scoped OAuth attempt persistence", () => {
  it("stores PKCE only as encrypted ciphertext on the supplied database", async () => {
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
    const query = vi.fn().mockResolvedValue([{ nonce: "nonce-1" }]);
    const database = { $queryRaw: query } as unknown as typeof db;
    await createSocialOAuthAuthorizationAttempt({ nonce: "nonce-1", workspaceId: "workspace-1", actorId: "owner-1", provider: "X", codeVerifier: "private-pkce", requestedScopes: ["users.read"], redirectUri: "https://example.com/callback", redirectAfter: "/app/social-media/accounts" }, database);
    const sql = query.mock.calls[0][0];
    expect(JSON.stringify(sql.values)).not.toContain("private-pkce");
    const ciphertext = sql.values.find((value: unknown) => typeof value === "string" && value.startsWith("v1."));
    expect(decryptSocialCredential(ciphertext)).toEqual({ codeVerifier: "private-pkce" });
  });
  it("rejects a consumed, expired or wrong-owner attempt without falling back to another database", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const database = { $queryRaw: query } as unknown as typeof db;
    await expect(consumeSocialOAuthAuthorizationAttempt({ nonce: "nonce-1", workspaceId: "workspace-1", actorId: "owner-1", provider: "X", createdAt: Date.now() }, database)).rejects.toMatchObject({ code: "SOCIAL_OAUTH_ATTEMPT_INVALID" });
    const sql = query.mock.calls[0][0];
    expect(sql.strings.join("")).toContain("consumed_at IS NULL");
    expect(sql.strings.join("")).toContain("expires_at > CURRENT_TIMESTAMP");
    expect(sql.values).toEqual(["nonce-1", "workspace-1", "owner-1", "X"]);
  });
});
