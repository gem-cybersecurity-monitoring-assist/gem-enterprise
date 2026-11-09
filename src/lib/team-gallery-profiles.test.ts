import { describe, expect, it } from "vitest";
import { getTeamProfileEditorial, teamProfileEditorials } from "./team-gallery-profiles";
import { teamGalleryEntries } from "./team-gallery-source";

describe("native enterprise profile editorial collection", () => {
  it("provides one full native profile for every source-linked role", () => {
    expect(teamProfileEditorials).toHaveLength(teamGalleryEntries.length);
    expect(new Set(teamProfileEditorials.map((profile) => profile.slug)).size).toBe(10);
    expect(new Set(teamProfileEditorials.map((profile) => profile.slug))).toEqual(
      new Set(teamGalleryEntries.map((entry) => entry.slug)),
    );
    for (const profile of teamProfileEditorials) {
      expect(profile.purpose.length).toBeGreaterThan(35);
      expect(profile.narrative.length).toBeGreaterThan(45);
      expect(profile.outputs).toHaveLength(3);
      expect(profile.workflow).toHaveLength(4);
      expect(profile.shotBriefs).toHaveLength(10);
      expect(profile.shotBriefs.map((shot) => shot.order)).toEqual([1,2,3,4,5,6,7,8,9,10]);
      expect(profile.shotBriefs.every((shot) => shot.description.length > 20)).toBe(true);
      expect(getTeamProfileEditorial(profile.slug)).toEqual(profile);
    }
  });

  it("does not resolve unknown profiles or invent identities", () => {
    expect(getTeamProfileEditorial("unknown")).toBeNull();
    const advertising = getTeamProfileEditorial("advertising");
    const unassigned = getTeamProfileEditorial("unassigned-photo");
    expect(advertising).toBeTruthy();
    expect(unassigned?.functionalArea).toContain("Unassigned");
    expect(teamGalleryEntries.every((item) => item.identityVerified === false)).toBe(true);
  });
});
