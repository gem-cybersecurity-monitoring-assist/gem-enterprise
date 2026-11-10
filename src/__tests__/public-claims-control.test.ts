import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { priorityClaimRoutes, publicClaims } from "@/lib/publicClaims";
import {
  scanTextForControlledClaims,
  validatePublicClaims,
} from "@/lib/publicClaimsControl";

const require = createRequire(import.meta.url);
const nextConfig = require("../../next.config.js") as {
  rewrites: () => Promise<{
    beforeFiles: Array<{ source: string; destination: string }>;
    afterFiles: Array<{ source: string; destination: string }>;
  }>;
};

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("public claims control", () => {
  it("keeps the claims registry structurally valid", () => {
    expect(validatePublicClaims(publicClaims)).toEqual([]);
  });

  it("covers every priority public route", () => {
    const registeredRoutes = new Set(publicClaims.map((claim) => claim.route));

    for (const route of priorityClaimRoutes) {
      expect(registeredRoutes.has(route), `${route} is missing from the registry`).toBe(true);
    }
  });

  it("requires evidence and safe wording for every critical claim", () => {
    const criticalClaims = publicClaims.filter((claim) => claim.risk === "critical");

    expect(criticalClaims.length).toBeGreaterThan(0);
    for (const claim of criticalClaims) {
      expect(claim.evidenceRequired.length).toBeGreaterThan(0);
      expect(claim.owner.length).toBeGreaterThan(0);
      expect(claim.publicationAction).not.toBe("allow");
      expect(claim.approvedWording).not.toBe(claim.currentWording);
    }
  });

  it("detects language that requires claims review", () => {
    const sample =
      "Live 24/7 monitoring is delivered by 40+ specialists with encrypted real-time messaging and a response within 2 hours.";
    const matches = scanTextForControlledClaims(sample);
    const keys = new Set(matches.map((match) => match.key));

    expect(keys).toEqual(
      new Set([
        "live-or-active",
        "round-the-clock",
        "staff-count",
        "encryption",
        "real-time",
        "fixed-response-time",
      ]),
    );
  });

  it("places controlled presentations in front of legacy high-risk pages", async () => {
    const rewrites = await nextConfig.rewrites();

    expect(rewrites.beforeFiles).toEqual(
      expect.arrayContaining([
        { source: "/hub", destination: "/hub-controlled" },
        { source: "/company", destination: "/company-controlled" },
        { source: "/request-access", destination: "/request-access-controlled" },
      ]),
    );
  });

  it("keeps the controlled hub free of the blocked performance claims", () => {
    const page = source("src/app/hub-controlled/page.tsx");

    expect(page).toContain("Exact capabilities are confirmed in writing for each engagement");
    expect(page).not.toContain("6 minutes");
    expect(page).not.toContain("24/7");
    expect(page).not.toContain("executed automatically");
    expect(page).not.toContain("< 4hr Response");
  });

  it("keeps the controlled company page free of fictional identities and counts", () => {
    const page = source("src/app/company-controlled/page.tsx");

    expect(page).toContain("Evidence-led publication");
    expect(page).not.toContain("Alexander Mercer");
    expect(page).not.toMatch(/\b\d+\+\s+(?:Analysts|Advisors|Specialists|Professionals)/);
    expect(page).not.toContain("National Cybersecurity Alliance");
  });

  it("provides navigable leadership and team function anchors without exposing roster claims", () => {
    const page = source("src/app/company-controlled/page.tsx");

    expect(page).toContain('id="leadership"');
    expect(page).toContain('id="teams"');
    expect(page).toContain('href="/personnel"');
    expect(page).toContain("GEM Cybersecurity & Monitoring Assist");
    expect(page).toContain("Alliance Trust Realty (ATR)");
    expect(page).toContain("Shared enterprise operations");
    expect(page).toContain("identity matching, image consent and role approval");
    expect(page).not.toContain("Sarah Johnson");
    expect(page).not.toContain("40+ Specialists");
    expect(page).not.toContain("24/7 staffed");
  });

  it("keeps public access requests non-binding and free of response promises", () => {
    const page = source("src/app/request-access-controlled/page.tsx");

    expect(page).toContain("non-binding request for information and qualification");
    expect(page).toContain("does not guarantee acceptance");
    expect(page).not.toContain("10 business days");
    expect(page).not.toContain("We respond to every submission");
  });
});
