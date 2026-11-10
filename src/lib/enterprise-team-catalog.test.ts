import { describe, expect, it } from "vitest";
import {
 divisions, enterpriseTeams, getDivision, getEnterpriseTeam, getRosterReference, historicalRoster,
} from "./enterprise-team-catalog";

describe("full internal enterprise team directory", () => {
 it("covers documented GEM/ATR organization and additional proposed functional teams", () => {
  expect(divisions.map(d=>d.id)).toEqual(["executive","security","realty","shared"]);
  expect(enterpriseTeams).toHaveLength(20);
  expect(new Set(enterpriseTeams.map(t=>t.slug)).size).toBe(20);
  expect(enterpriseTeams.some(t=>t.status==="documented")).toBe(true);
  expect(enterpriseTeams.some(t=>t.status==="planned")).toBe(true);
  expect(enterpriseTeams.some(t=>t.status==="restricted")).toBe(true);
  for(const division of divisions) {
    expect(getDivision(division.id)).toEqual(division);
    expect(enterpriseTeams.some(t=>t.division===division.id)).toBe(true);
  }
 });
 it("provides meaningful source-linked records, responsibilities, outputs and valid handoffs", () => {
  const slugs=new Set(enterpriseTeams.map(t=>t.slug));
  for(const team of enterpriseTeams){
   expect(team.title.length).toBeGreaterThan(12);
   expect(team.summary.length).toBeGreaterThan(60);
   expect(team.responsibilities.length).toBeGreaterThanOrEqual(3);
   expect(team.deliverables.length).toBe(3);
   expect(team.collaborators.length).toBeGreaterThan(0);
   for(const peer of team.collaborators)expect(slugs.has(peer)).toBe(true);
   expect(team.notionDetailUrl).toMatch(/^https:\/\/app\.notion\.com\/p\//);
   expect(team.sourceUrl).toMatch(/^https:\/\/app\.notion\.com\/p\//);
   expect(getEnterpriseTeam(team.slug)).toEqual(team);
  }
  expect(getEnterpriseTeam("unknown-team")).toBeNull();
  expect(getDivision("unknown-division")).toBeNull();
 });
 it("retains historic name and function references as review-only records", () => {
  expect(historicalRoster).toHaveLength(10);
  expect(new Set(historicalRoster.map(x=>x.slug)).size).toBe(10);
  const slugs=new Set(enterpriseTeams.map(t=>t.slug));
  for(const record of historicalRoster) {
   expect(slugs.has(record.department)).toBe(true);
   expect(record.notice.length).toBeGreaterThan(45);
   expect(record.sourceUrl).toContain("app.notion.com/p/");
   expect(getRosterReference(record.slug)).toEqual(record);
  }
  expect(getRosterReference("unknown")).toBeNull();
  expect(historicalRoster.find(x=>x.slug==="gregor-stewart")?.status).toBe("evidence-required");
  expect(historicalRoster.find(x=>x.slug==="ai-agent-overseer")?.status).toBe("planned");
 });
});
