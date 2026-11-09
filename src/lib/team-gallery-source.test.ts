import { describe, expect, it } from "vitest";
import {
  atrGalleryMedia,
  NOTION_ATR_MEDIA_PAGE_URL,
  NOTION_ATR_SOURCE_URL,
  NOTION_STAFF_SOURCE_URL,
  NOTION_TEAM_GALLERY_URL,
  teamGalleryEntries,
} from "./team-gallery-source";

describe("Notion team gallery editorial preview", () => {
  it("preserves nine original photographs and the Advertising source video without demo portraits", () => {
    expect(teamGalleryEntries).toHaveLength(10);
    expect(new Set(teamGalleryEntries.map((entry) => entry.slug)).size).toBe(10);
    const photos = teamGalleryEntries.filter((entry) => entry.mediaKind === "photograph");
    const videos = teamGalleryEntries.filter((entry) => entry.mediaKind === "video");
    expect(photos).toHaveLength(9);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ slug: "advertising", imageUrl: null });
    expect(new Set(photos.map((entry) => entry.imageUrl)).size).toBe(9);

    for (const entry of teamGalleryEntries) {
      if (entry.mediaKind === "photograph") {
        expect(entry.imageUrl).toMatch(/^https:\/\/bow-sunset-a14\.notion\.site\/image\/attachment/);
        expect(entry.imageUrl).toContain("imgBuildSrc=requestProxiedImageUrl");
        expect(entry.imageUrl).not.toContain("media.base44.com");
        expect(entry.imageUrl).not.toContain("img.notionusercontent.com");
      } else {
        expect(entry.imageUrl).toBeNull();
      }
      expect(entry.notionProfileUrl).toMatch(/^https:\/\/app\.notion\.com\/p\/413b/);
      expect(entry.identityVerified).toBe(false);
      expect(entry.summary.length).toBeGreaterThan(24);
      expect(entry.responsibilities.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("separates ATR company concepts from staff identity records", () => {
    expect(atrGalleryMedia).toHaveLength(3);
    for (const media of atrGalleryMedia) {
      expect(media.url.startsWith("https://caramel-mallet-6dc.notion.site/image/")).toBe(true);
      expect(media.caption).toBeTruthy();
      expect(teamGalleryEntries.some((entry) => entry.imageUrl === media.url)).toBe(false);
    }
  });

  it("keeps the live Notion links while avoiding automatic personnel publication", () => {
    expect(NOTION_TEAM_GALLERY_URL).toContain("393b5b56eac281a79024c9427df7480d");
    expect(NOTION_STAFF_SOURCE_URL).toContain("bow-sunset-a14.notion.site");
    expect(NOTION_ATR_SOURCE_URL).toContain("caramel-mallet-6dc.notion.site");
    expect(NOTION_ATR_MEDIA_PAGE_URL).toContain("413b5b56eac281c6b9a3d5becb1ff5a0");
    expect(teamGalleryEntries.find((entry) => entry.category === "unassigned")?.title).toMatch(/role pending/);
  });
});
