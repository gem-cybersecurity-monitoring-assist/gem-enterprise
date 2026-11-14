import { afterEach, describe, expect, it, vi } from "vitest";
import { getSocialOAuthProviderConfig } from "@/lib/social-media/oauth/config";
import { probeSocialConnector } from "@/lib/social-media/oauth/probes";
import type { StoredSocialCredential } from "@/lib/social-media/oauth/store";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function setup(payload: unknown, status = 200) {
  vi.stubEnv("META_GRAPH_API_VERSION", "v27.0");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
    status, headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  const credential: StoredSocialCredential = {
    provider: "META", accessToken: "test-page-token", externalAccountId: "123456789",
    grantedScopes: ["instagram_basic"],
  };
  return { config: getSocialOAuthProviderConfig("META"), credential, fetchMock };
}

describe("exact Meta destination probes", () => {
  it("checks the saved Instagram account rather than the Page owning its token", async () => {
    const input = setup({ id: "123456789", username: "test_instagram", name: "Instagram name" });
    const result = await probeSocialConnector({ ...input, accountType: "INSTAGRAM_PROFESSIONAL" });
    expect(result).toMatchObject({ healthy: true, accountName: "test_instagram" });
    const [url, init] = input.fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/v27.0/123456789");
    expect(url.searchParams.get("fields")).toBe("id,username,name");
    expect(init.method).toBe("GET");
    expect(url.toString()).not.toContain(input.credential.accessToken);
    expect(JSON.stringify(result)).not.toContain(input.credential.accessToken);
  });

  it("checks the exact saved Facebook Page", async () => {
    const input = setup({ id: "123456789", name: "Test Page" });
    expect(await probeSocialConnector({ ...input, accountType: "META_PAGE" }))
      .toMatchObject({ healthy: true, accountName: "Test Page" });
    expect(input.fetchMock.mock.calls[0][0].searchParams.get("fields")).toBe("id,name");
  });

  it.each([{ id: "987654321", name: "Wrong Page" }, { name: "Missing ID" }, { error: "denied" }])(
    "rejects a successful HTTP response with the wrong or missing identity: %j", async payload => {
      const input = setup(payload);
      expect(await probeSocialConnector({ ...input, accountType: "INSTAGRAM_PROFESSIONAL" }))
        .toMatchObject({ healthy: false, accountName: null });
    },
  );

  it.each([undefined, "../me", "123?fields=access_token", ""]) (
    "rejects an invalid destination before sending any token: %s", async id => {
      const input = setup({}); input.credential.externalAccountId = id;
      await expect(probeSocialConnector(input)).rejects.toMatchObject({ code: "SOCIAL_PROBE_ACCOUNT_REQUIRED" });
      expect(input.fetchMock).not.toHaveBeenCalled();
    },
  );

  it("fails closed when Meta rejects access", async () => {
    const input = setup({ error: "denied" }, 403);
    expect(await probeSocialConnector({ ...input, accountType: "INSTAGRAM_PROFESSIONAL" }))
      .toMatchObject({ healthy: false, accountName: null });
  });
});
