import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enterpriseTeams, historicalRoster } from "@/lib/enterprise-team-catalog";

function read(path: string) { return readFileSync(join(process.cwd(), path), "utf8"); }

describe("full Teams Gallery integration", () => {
 it("connects the protected gallery to division and functional profile pages", () => {
  const gallery = read("src/components/admin/TeamGalleryPreview.tsx");
  const directory = read("src/components/admin/EnterpriseTeamDirectory.tsx");
  const team = read("src/app/app/admin/team-gallery/teams/[slug]/page.tsx");
  const division = read("src/app/app/admin/team-gallery/divisions/[division]/page.tsx");
  const roster = read("src/app/app/admin/team-gallery/roster/[slug]/page.tsx");
  expect(gallery).toContain("<EnterpriseTeamDirectory />");
  expect(directory).toContain("team-gallery/teams/");
  expect(directory).toContain("team-gallery/divisions/");
  expect(directory).toContain("team-gallery/roster/");
  expect(team).toContain("getEnterpriseTeam");
  expect(team).toContain("notFound()");
  expect(division).toContain("getDivision");
  expect(division).toContain("notFound()");
  expect(roster).toContain("getRosterReference");
  expect(roster).toContain("notFound()");
  expect(enterpriseTeams).toHaveLength(20);
  expect(historicalRoster).toHaveLength(10);
 });
 it("does not expose the reviewed roster as a public employee directory", () => {
  const directory=read("src/components/admin/EnterpriseTeamDirectory.tsx");
  const roster=read("src/app/app/admin/team-gallery/roster/[slug]/page.tsx");
  const publicDirectory=read("src/lib/notion-public-directory.ts");
  const proxy=read("src/proxy.ts");
  expect(directory).toContain("Historical roster");
  expect(roster).toContain("No public employee profile");
  expect(publicDirectory).toContain("Publish Approved");
  expect(proxy).toContain("/app/admin/");
 });
 it("removes unsupported demo leadership and fabricated headcounts from company profile", () => {
  const page=read("src/app/company/page.tsx");
  for(const demo of ["Alexander Mercer", "Samira Okonkwo", "Marcus Thornton", "Catherine Voss", "40+ Specialists", "15+ Analysts", "8+ Attorneys"]) {
   expect(page).not.toContain(demo);
  }
  expect(page).toContain("Leadership &amp; Oversight Functions");
  expect(page).toContain('href="/personnel"');
  expect(page).toContain("no membership or partnership is asserted".toLowerCase().split(" ").slice(0,3).join(" "));
 });
});
