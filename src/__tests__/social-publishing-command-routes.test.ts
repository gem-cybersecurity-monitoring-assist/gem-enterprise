import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const nav = readFileSync("src/components/social-media/SocialMediaSuiteNav.tsx", "utf8");
const createPage = readFileSync("src/app/app/social-media/create/page.tsx", "utf8");
const campaignsPage = readFileSync("src/app/app/social-media/campaigns/page.tsx", "utf8");
const queuePage = readFileSync("src/app/app/social-media/queue/page.tsx", "utf8");
const activityPage = readFileSync("src/app/app/social-media/activity/page.tsx", "utf8");
const settingsPage = readFileSync("src/app/app/social-media/settings/page.tsx", "utf8");
const notFound = readFileSync("src/app/app/social-media/not-found.tsx", "utf8");

describe("social publishing command routes", () => {
  it("exposes the Base44 replacement routes inside the authenticated GEM workspace", () => {
    for (const route of [
      "/app/social-media/create",
      "/app/social-media/campaigns",
      "/app/social-media/queue",
      "/app/social-media/activity",
      "/app/social-media/settings",
    ]) {
      expect(nav).toContain(route);
    }
  });

  it("reuses the governed production engines instead of creating a second publishing stack", () => {
    expect(createPage).toContain("ContentOrchestratorPanel");
    expect(campaignsPage).toContain("ContentOrchestratorPanel");
    expect(queuePage).toContain("SocialPublishingQueuePanel");
    expect(activityPage).toContain("SocialPublishingQueuePanel");
    expect(settingsPage).toContain("socialAccountsHref()");
  });

  it("keeps provider activation and queue writes outside these new operator pages", () => {
    expect(queuePage).not.toContain('method: "POST"');
    expect(activityPage).not.toContain('method: "POST"');
    expect(settingsPage).toContain("/app/command-center/social-media");
    expect(createPage).toContain("Preparation does not publish");
  });

  it("provides a safe recovery route for invalid social workspace paths", () => {
    expect(notFound).toContain("Social Media Suite page not found");
    expect(notFound).toContain('href="/app/social-media"');
  });
});
