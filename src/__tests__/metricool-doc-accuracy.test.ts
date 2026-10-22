/**
 * Metricool documentation accuracy test.
 *
 * The doc at docs/integrations/metricool.md must honestly describe what
 * public/metricool-init.js is: a website visitor tracker (be.js + hash), and
 * must state what it is not (not wired to social scheduling). This test keeps
 * the doc pinned to the real snippet instead of drifting into claimed
 * capabilities.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("metricool integration doc accuracy", () => {
  const snippet = readFileSync(join(repoRoot, "public/metricool-init.js"), "utf8");
  const doc = readFileSync(join(repoRoot, "docs/integrations/metricool.md"), "utf8");

  const trackerUrl = "https://tracker.metricool.com/resources/be.js";
  const siteHash = "3d19f1c1f08799a08dca4eaa5a85e91";

  it("documents the real tracker URL and site hash from the init snippet", () => {
    // Ground truth: the snippet itself contains these values.
    expect(snippet).toContain(trackerUrl);
    expect(snippet).toContain(siteHash);
    // The doc must state exactly the same values.
    expect(doc).toContain(trackerUrl);
    expect(doc).toContain(siteHash);
  });

  it("honestly states Metricool is not wired to social scheduling", () => {
    expect(doc).toMatch(/not wired/i);
    expect(doc).toMatch(/HUMAN_REQUIRED/);
    // No claim of implemented autoposting/metrics capability.
    expect(doc).not.toMatch(/autoposting is (implemented|available|enabled)/i);
  });
});
