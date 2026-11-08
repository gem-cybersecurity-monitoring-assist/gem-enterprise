import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adminPortalNavGroups, clientPortalNavGroups } from "@/lib/platformNavigation";

const source = (path: string) => readFileSync(path, "utf8");

describe("private GEM SaaS control plane contract", () => {
  it("is listed for administrators but not in the compact client menu", () => {
    expect(adminPortalNavGroups.flatMap((group) => group.items).some((item) => item.href === "/app/command-center/saas")).toBe(true);
    expect(clientPortalNavGroups.flatMap((group) => group.items).some((item) => item.href === "/app/command-center/saas")).toBe(false);
  });
  it("guards the inventory API at the server and disallows caching", () => {
    const route = source("src/app/api/command-center/saas-capabilities/route.ts");
    expect(route).toContain("requireAdmin()");
    expect(route).toContain("if (!gate.ok) return gate.response");
    expect(route).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(route).not.toContain("POST(");
    expect(route).not.toContain("DELETE(");
    expect(route).not.toContain("PUT(");
  });
  it("uses the authenticated command-center snapshot rather than fabricated numbers", () => {
    const component = source("src/components/command-center/SaaSOperationalSnapshot.tsx");
    expect(component).toContain('fetch("/api/command-center/snapshot"');
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain('record.source !== "database"');
    expect(component).toContain("No sample figures are substituted.");
  });
  it("keeps the private page out of search engines", () => {
    const page = source("src/app/app/command-center/saas/page.tsx");
    expect(page).toContain("index: false");
    expect(page).toContain("<SaaSOperationalSnapshot />");
    expect(page).toContain('href="/app/command-center"');
  });
});
