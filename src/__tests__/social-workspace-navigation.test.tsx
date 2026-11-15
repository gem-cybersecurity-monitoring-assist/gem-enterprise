import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialMediaSuiteNav } from "@/components/social-media/SocialMediaSuiteNav";
import { SocialWorkspaceChooser } from "@/components/social-media/SocialWorkspaceChooser";

const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/social-media/accounts",
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

function links(markup: string) {
  return Array.from(markup.matchAll(/href="([^"]+)"/g), (match) =>
    new URL(match[1].replaceAll("&amp;", "&"), "https://example.test"),
  );
}

describe("social workspace navigation", () => {
  beforeEach(() => { navigation.query = ""; });

  it("keeps the workspace on every suite and channel link without forwarding callback state", () => {
    navigation.query = "workspace=workspace%2Bone&code=transient&state=transient&connectionState=connected";
    const urls = links(renderToStaticMarkup(<SocialMediaSuiteNav />));
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) {
      expect(url.searchParams.get("workspace")).toBe("workspace+one");
      expect(url.searchParams.has("code")).toBe(false);
      expect(url.searchParams.has("state")).toBe(false);
      expect(url.searchParams.has("connectionState")).toBe(false);
      expect(url.pathname.startsWith("/app/social-media")).toBe(true);
    }
    expect(urls.filter((url) => url.searchParams.has("provider"))).toHaveLength(5);
  });

  it("updates links after workspace changes instead of holding the previous selection", () => {
    navigation.query = "workspace=first";
    expect(links(renderToStaticMarkup(<SocialMediaSuiteNav />))[0].searchParams.get("workspace")).toBe("first");
    navigation.query = "workspace=second";
    for (const url of links(renderToStaticMarkup(<SocialMediaSuiteNav />))) {
      expect(url.searchParams.get("workspace")).toBe("second");
    }
  });

  it("retains existing unscoped routes when no workspace is selected", () => {
    for (const url of links(renderToStaticMarkup(<SocialMediaSuiteNav />))) {
      expect(url.searchParams.has("workspace")).toBe(false);
    }
  });

  it("renders only supplied accessible workspaces and preserves the selected channel", () => {
    const markup = renderToStaticMarkup(<SocialWorkspaceChooser
      workspaces={[{ id: "one+1", name: "GEM <Operations>" }, { id: "two", name: "Second workspace" }]}
      selectedId="one+1"
      destination="INSTAGRAM_PROFESSIONAL"
    />);
    const urls = links(markup);
    expect(urls.map((url) => url.searchParams.get("workspace"))).toEqual(["one+1", "two"]);
    expect(urls.every((url) => url.searchParams.get("provider") === "INSTAGRAM_PROFESSIONAL")).toBe(true);
    expect(markup).toContain("GEM &lt;Operations&gt;");
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Social workspaces"');
  });

  it("does not invent a workspace option or select a forbidden requested workspace", () => {
    const markup = renderToStaticMarkup(<SocialWorkspaceChooser
      workspaces={[{ id: "allowed", name: "Allowed workspace" }]}
      selectedId="forbidden"
    />);
    expect(links(markup).map((url) => url.searchParams.get("workspace"))).toEqual(["allowed"]);
    expect(markup).not.toContain("forbidden");
    expect(markup).not.toContain("aria-current");
    expect(renderToStaticMarkup(<SocialWorkspaceChooser workspaces={[]} selectedId={null} />)).toBe("");
  });
});
