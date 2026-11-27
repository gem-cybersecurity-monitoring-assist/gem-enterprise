import { afterEach, describe, expect, it, vi } from "vitest";
import { probeSocialConnector } from "@/lib/social-media/oauth/probes";
import { getSocialOAuthProviderConfig } from "@/lib/social-media/oauth/config";
import type { StoredSocialCredential } from "@/lib/social-media/oauth/store";

const credential: StoredSocialCredential = { provider: "X", accessToken: "test-access", externalAccountId: "123", grantedScopes: ["users.read"] };
afterEach(() => vi.unstubAllGlobals());
describe("X identity verification", () => {
  it.each([[{ data: { id: "123", name: "Account" } }, true], [{ data: { id: "456", name: "Different account" } }, false], [{ data: { name: "No ID" } }, false], [{ errors: [{ message: "Denied" }] }, false]])("matches the exact saved account: %j", async (body, healthy) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal("fetch", fetchMock);
    expect((await probeSocialConnector({ config: getSocialOAuthProviderConfig("X"), credential })).healthy).toBe(healthy);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });
  it("rejects a missing account ID before provider access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(probeSocialConnector({ config: getSocialOAuthProviderConfig("X"), credential: { ...credential, externalAccountId: undefined } })).rejects.toMatchObject({ code: "SOCIAL_PROBE_ACCOUNT_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
