import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WixMarketEntryConsolePage from "@/app/app/admin/market/wix/page";

const page = readFileSync("src/app/app/admin/market/wix/page.tsx", "utf8");
const nav = readFileSync("src/lib/platformNavigation.ts", "utf8");

describe("GEM Wix market-entry control hub", () => {
  it("renders meaningful illustration text and distinguishes the two consultation flows", () => {
    const markup = renderToStaticMarkup(createElement(WixMarketEntryConsolePage));
    expect(markup).toContain('alt="Illustration of a cybersecurity operations team reviewing digital security dashboards."');
    expect(markup).toContain("Illustrative artwork");
    expect(markup).toContain("$199 GEM Business Security");
    expect(markup).toContain("listed at $200 and $300");
    expect(markup).toContain('href="/app/social-media"');
    expect(markup).toContain("not a current passing scan");
  });
  it("keeps the authorized Wix website and uploaded replacement artwork", () => {
    expect(page).toContain("https://firmgem.wixsite.com/gem-assist-1");
    expect(page).toContain("1c4f14_bea61101b3ad4719bddcda39ec42f3ac~mv2.png");
    expect(page).toContain("fcfea988-421b-4278-b5e5-dfbb7ee1532d");
  });

  it("uses the existing governed GEM review CTA without treating Wix general inquiries as approved GEM clients", () => {
    expect(page).toContain("utm_source=wix-gem-assist-1");
    expect(page).toContain("utm_medium=organic");
    expect(page).toContain("founding-first-20");
    expect(page).toContain("does not automatically become a GEM client record");
  });

  it("preserves operator controls and exposes the hub only within admin navigation", () => {
    expect(page).toContain("15 serious findings");
    expect(page).toContain("Do not delete customer records");
    expect(nav).toContain('href: "/app/admin/market/wix"');
    expect(nav).toContain('label: "GEM Wix Control"');
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("process.env");
  });
});
