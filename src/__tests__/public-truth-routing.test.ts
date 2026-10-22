import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const nextConfig = require("../../next.config.js") as {
  redirects: () => Promise<
    Array<{ source: string; destination: string; permanent: boolean }>
  >;
};

describe("public truth routing", () => {
  it("routes public demo and preview entry points to controlled production pages", async () => {
    const redirects = await nextConfig.redirects();
    expect(existsSync(join(process.cwd(), "src/app/community/page.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/hub/page.tsx"))).toBe(true);

    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: "/enterprise-demo",
          destination: "/enterprise-solutions",
          permanent: false,
        },
        {
          source: "/enterprise-demo/watch",
          destination: "/enterprise-solutions",
          permanent: false,
        },
        {
          source: "/preview",
          destination: "/company",
          permanent: false,
        },
        {
          source: "/tokmetric/review-demo",
          destination: "/tokmetric/app-review",
          permanent: false,
        },
      ]),
    );
  });

  it("keeps unverified community claims behind a disclosed, no-index preview", async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).toContainEqual({
      source: "/community",
      destination: "/community-hub",
      permanent: false,
    });

    const previewSource = readFileSync(
      join(process.cwd(), "src/app/community-hub/page.tsx"),
      "utf8",
    );
    expect(previewSource).toContain("Fictional interface preview");
    expect(previewSource).toContain("No live members, opportunities");
    expect(previewSource).toContain("index: false");
  });

  it("permanently routes open registration to controlled onboarding", async () => {
    const redirects = await nextConfig.redirects();

    expect(redirects).toContainEqual({
      source: "/register",
      destination: "/get-started",
      permanent: true,
    });
  });
});
