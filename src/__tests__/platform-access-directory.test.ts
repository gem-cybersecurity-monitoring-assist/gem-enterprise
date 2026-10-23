import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accessPortalEntries } from "@/lib/accessPortals";
import { canonicalRoutes, legacyRedirects } from "@/lib/siteRoutes";

const source = (path: string) => readFileSync(path, "utf8");

describe("GEM platform access directory", () => {
  it("defines a stable public doorway for every platform role", () => {
    expect(accessPortalEntries.map((portal) => portal.id)).toEqual([
      "login",
      "client",
      "team",
      "admin",
      "super_admin",
    ]);
    expect(accessPortalEntries.map((portal) => portal.href)).toEqual([
      "/login",
      "/client-login?next=%2Fapp%2Fworkspace",
      "/team-login?next=%2Fapp%2Fworkspace",
      "/admin-login?next=%2Fapp%2Fadmin",
      "/super-admin-login?next=%2Fapp%2Fadmin",
    ]);
  });

  it("renders the same access directory on home, login, and enterprise solutions", () => {
    expect(source("src/app/page.tsx")).toContain("<PlatformAccessDirectory />");
    expect(source("src/app/login/page.tsx")).toContain('<PlatformAccessDirectory exclude="login" compact headingLevel={1} />');
    expect(source("src/app/enterprise-solutions/page.tsx")).toContain("<PlatformAccessDirectory />");
  });

  it("keeps sign-in and Workspace OS routes canonical", () => {
    const routes = new Set(canonicalRoutes.map((route) => route.path));
    for (const path of [
      "/login",
      "/client-login",
      "/team-login",
      "/admin-login",
      "/super-admin-login",
      "/app/workspace",
    ]) {
      expect(routes.has(path)).toBe(true);
    }
    expect(legacyRedirects.some((redirect) => redirect.source === "/login")).toBe(false);
  });

  it("keeps every login page outside the public navigation chrome", () => {
    const proxy = source("src/proxy.ts");
    expect(proxy).toContain('["/login", "/client-login", "/team-login", "/admin-login", "/super-admin-login"]');
    expect(proxy).toContain('requestHeaders.set("x-is-portal", "1")');
  });

  it("keeps access-page heading order and portal navigation accessible", () => {
    const directory = source("src/components/home/PlatformAccessDirectory.tsx");
    const login = source("src/components/auth/RoleLoginPortal.tsx");
    expect(directory).toContain('const Heading = headingLevel === 1 ? "h1" : "h2"');
    expect(directory).toContain('const CardHeading = headingLevel === 1 ? "h2" : "h3"');
    expect(directory).toContain('<CardHeading className="mt-5 text-lg font-bold text-white">');
    expect(directory).not.toContain('<h3 className="mt-5 text-lg font-bold text-white">');
    expect(directory).toContain("scroll-mt-24");
    expect(login).toContain('<nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Choose sign-in portal">');
    expect(login).toContain('aria-current={item.kind === portal ? "page" : undefined}');
    expect(login).toContain("normalizeLoginError(body.error)");
    expect(login).not.toContain("setServerError(body.error ||");
    expect(login).not.toContain('<h2 className="mt-8 max-w-xl');
  });
});
