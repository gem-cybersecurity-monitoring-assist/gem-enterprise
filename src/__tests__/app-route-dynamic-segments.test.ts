import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `next build` accepts sibling dynamic folders with different slug names
// (e.g. connectors/[id] and connectors/[provider]), but `next dev` and
// `next start` refuse to route at all: "You cannot use different slug names
// for the same dynamic path". This walks src/app the way Next.js resolves URLs
// (route groups "(x)" and parallel slots "@x" add no URL segment) and fails if
// any URL position has more than one dynamic slug name.
const APP_DIR = join(process.cwd(), "src/app");
const DYNAMIC = /^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/;

function collect(dir: string, urlPath: string, slugs: Map<string, Set<string>>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const transparent = /^\(.*\)$/.test(name) || name.startsWith("@");
    const dynamic = DYNAMIC.exec(name);
    if (dynamic) {
      const names = slugs.get(urlPath) ?? new Set<string>();
      names.add(dynamic[1]);
      slugs.set(urlPath, names);
    }
    collect(join(dir, name), transparent ? urlPath : `${urlPath}/${dynamic ? "[]" : name}`, slugs);
  }
}

describe("app router dynamic segments", () => {
  it("uses one slug name per dynamic URL position", () => {
    const slugs = new Map<string, Set<string>>();
    collect(APP_DIR, "", slugs);
    const conflicts = [...slugs]
      .filter(([, names]) => names.size > 1)
      .map(([path, names]) => `${path || "/"}: ${[...names].sort().join(" vs ")}`);
    expect(conflicts).toEqual([]);
  });
});
