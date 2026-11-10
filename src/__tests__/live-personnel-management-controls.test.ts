import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const file=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
describe("live people and teams publishing authorization",()=>{
 it("uses the authoritative admin session and same-origin mutation checks",()=>{
  for(const path of ["src/app/api/admin/team-copy/route.ts","src/app/api/admin/personnel-registry/route.ts"]){
   const s=file(path);
   expect(s).toContain("await requireAdmin()");
   expect(s).toContain("sameSiteOrigin");
   expect(s).toContain("NOTION_API_TOKEN");
   expect(s).toContain("no-store");
  }
 });
 it("owner-only publication honors Notion evidence checks and explicit typed confirmation",()=>{
   const r=file("src/app/api/admin/personnel-registry/route.ts");
   expect(r).toContain("await requirePlatformOwner()");
   expect(r).toContain("publicationBlockers(current)");
   expect(r).toContain("command.confirmName!==found.name");
   expect(r).toContain('"Publish Approved":{checkbox:false}');
 });
 it("public routes read live source and do not embed credential names",()=>{
   for(const path of ["src/app/personnel/page.tsx","src/app/personnel/teams/[slug]/page.tsx"]){
     const s=file(path);
     expect(s).toContain("getLiveTeamContent()");
     expect(s).not.toContain("NOTION_API_TOKEN");
   }
 });
 it("provides an authenticated management UI in normal administration navigation",()=>{
   expect(file("src/lib/platformNavigation.ts")).toContain("/app/admin/personnel-management");
   expect(file("src/app/app/admin/personnel-management/page.tsx")).toContain("PersonnelLiveManager");
 });
});
