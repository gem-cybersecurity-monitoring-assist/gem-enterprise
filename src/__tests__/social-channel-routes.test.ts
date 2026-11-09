import { describe, expect, it } from "vitest";
import { matchesSocialDestination, oauthByDestination, socialAccountsHref, socialChannels } from "@/lib/social-media/channel-routes";

describe("social channel routes", () => {
  it("preserves the workspace and resolves each destination to its OAuth handler", () => {
    const workspace = "workspace+1";
    expect(socialChannels.map(({ id }) => oauthByDestination[id])).toEqual(["TIKTOK", "META", "X", "META", "YOUTUBE"]);
    for (const { id } of socialChannels) {
      const url = new URL(socialAccountsHref(id, workspace), "https://example.test");
      expect(url.pathname).toBe("/app/social-media/accounts");
      expect(url.searchParams.get("provider")).toBe(id);
      expect(url.searchParams.get("workspace")).toBe(workspace);
    }
  });

  it("keeps Facebook Pages and Instagram professional accounts distinct", () => {
    const facebook = { accountType: "META_PAGE" };
    const instagram = { accountType: "INSTAGRAM_PROFESSIONAL" };
    expect(matchesSocialDestination("META", facebook, "FACEBOOK_PAGE")).toBe(true);
    expect(matchesSocialDestination("META", instagram, "FACEBOOK_PAGE")).toBe(false);
    expect(matchesSocialDestination("META", instagram, "INSTAGRAM_PROFESSIONAL")).toBe(true);
    expect(matchesSocialDestination("META", facebook, "INSTAGRAM_PROFESSIONAL")).toBe(false);
    expect(matchesSocialDestination("META", {}, "FACEBOOK_PAGE")).toBe(false);
    expect(matchesSocialDestination("X", instagram, "INSTAGRAM_PROFESSIONAL")).toBe(false);
  });
});
