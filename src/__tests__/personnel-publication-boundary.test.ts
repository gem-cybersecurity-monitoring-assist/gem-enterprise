import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPublicFunctionalTeam, publicFunctionalTeams } from "@/lib/public-personnel-teams";

const read = (p: string) => readFileSync(join(process.cwd(),p),"utf8");

describe("public people and team publication controls",()=>{
  it("shows functional overview even when no staff records are approved",()=>{
    const page=read("src/app/personnel/page.tsx");
    expect(page).toContain("<PersonnelFunctionsExplorer teams={teamContent.teams} divisions={publicDivisions} />");
    expect(page).toContain("Individual professional profiles are awaiting publication approval");
    expect(page).toContain("id=\"approved-people\"");
    expect(page).toContain('href="#team-functions"');
    expect(page).not.toContain("Directory publication is not configured");
  });
  it("only emits role-level team data into the client component",()=>{
    const explorer=read("src/components/public/PersonnelFunctionsExplorer.tsx");
    expect(explorer).toContain("import type { PublicFunctionalTeam }");
    expect(explorer).toContain("/personnel/teams/");
    expect(explorer).not.toContain("historicalRoster");
    expect(explorer).not.toContain("NOTION_API_TOKEN");
  });
  it("does not open restricted VIP organization roles publicly",()=>{
    const teamPage=read("src/app/personnel/teams/[slug]/page.tsx");
    expect(getPublicFunctionalTeam("vip-relationships")).toBeNull();
    expect(teamPage).toContain("if(!team) notFound()");
    expect(teamPage).toContain("getLiveTeamContent");
    expect(publicFunctionalTeams.map(t=>t.status)).not.toContain("restricted");
  });
  it("404s private or missing people, looking them up only in the approved public result",()=>{
    const detail=read("src/app/personnel/profile/[id]/page.tsx");
    expect(detail).toContain('if (directory.status !== "ready") notFound()');
    expect(detail).toContain("const profile = directory.profiles.find(item=>item.id===id)");
    expect(detail).toContain("if (!profile) notFound()");
    expect(detail).not.toContain("NOTION_API_TOKEN");
    expect(detail).not.toContain("sourceUrl");
  });
});
