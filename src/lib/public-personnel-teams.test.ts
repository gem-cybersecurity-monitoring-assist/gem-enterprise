import { describe, expect, it } from "vitest";
import {
  getPublicFunctionalTeam, publicDivisions, publicFunctionalTeams,
} from "./public-personnel-teams";
import { enterpriseTeams, historicalRoster } from "./enterprise-team-catalog";

describe("public personnel functional directory safety and completeness", () => {
  it("covers each nonrestricted organizational function and all public division groups", () => {
    expect(publicDivisions.map(d=>d.id)).toEqual(["executive", "security", "realty", "shared"]);
    expect(publicFunctionalTeams).toHaveLength(19);
    expect(publicFunctionalTeams.length).toBe(enterpriseTeams.filter(team=>team.status!=="restricted").length);
    expect(new Set(publicFunctionalTeams.map(team=>team.slug)).size).toBe(publicFunctionalTeams.length);
    for (const group of publicDivisions) {
      expect(publicFunctionalTeams.some(team=>team.division===group.id)).toBe(true);
    }
  });
  it("never publishes restricted VIP desks, individual people, source links or private roster metadata", () => {
    const raw = JSON.stringify(publicFunctionalTeams);
    expect(getPublicFunctionalTeam("vip-relationships")).toBeNull();
    expect(raw).not.toContain("sourceUrl");
    expect(raw).not.toContain("notionDetailUrl");
    expect(publicFunctionalTeams.every(team=>!("licenseNumber" in team) && !("sourceUrl" in team))).toBe(true);
    for (const entry of historicalRoster.filter(entry=>entry.status!=="function-recorded")) {
      if(entry.label==="AI Agent Overseer")continue;
      expect(raw).not.toContain(entry.label);
    }
  });
  it("links each public team slug to an individual detailed role profile", () => {
    for(const team of publicFunctionalTeams) {
      expect(getPublicFunctionalTeam(team.slug)).toEqual(team);
      expect(team.mission.length).toBeGreaterThan(60);
      expect(team.responsibilities.length).toBeGreaterThanOrEqual(3);
      expect(team.deliverables).toHaveLength(3);
    }
    expect(getPublicFunctionalTeam("not-a-team")).toBeNull();
  });
});
