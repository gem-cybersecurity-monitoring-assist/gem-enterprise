import { describe, expect, it, vi } from "vitest";
import { getLiveTeamContent, mergeTeamCopy, validateTeamCopyUpdate } from "./live-team-copy";
import { publicFunctionalTeams } from "./public-personnel-teams";

const mkBlock=(slug:string,i:number)=>{
 const t=publicFunctionalTeams.find(t=>t.slug===slug)!;
 return {type:"code",id:String(i).padStart(32,"0"),last_edited_time:"2026-11-10T06:00:00.000Z",
 code:{rich_text:[{type:"text",plain_text:JSON.stringify({
 slug:t.slug,title:t.title,overview:t.overview,mission:t.mission,
 responsibilities:t.responsibilities,deliverables:t.deliverables,
 })}]}};
};
describe("live Notion team editor source",()=>{
 it("requires a server-side integration and falls back to source-safe roles",async()=>{
   const request=vi.fn();
   const result=await getLiveTeamContent({},request as unknown as typeof fetch);
   expect(result.status).toBe("not_configured");
   expect(result.teams).toHaveLength(19);
   expect(request).not.toHaveBeenCalled();
 });
 it("matches all 19 original roles from Notion code blocks without exposing restricted VIP desks",()=>{
   const merged=mergeTeamCopy(publicFunctionalTeams.map((t,i)=>mkBlock(t.slug,i)));
   expect(merged.status).toBe("connected");
   expect(merged.records).toHaveLength(19);
   expect(merged.teams.map(t=>t.slug)).toEqual(publicFunctionalTeams.map(t=>t.slug));
   expect(merged.teams.some(t=>t.slug==="vip-relationships")).toBe(false);
 });
 it("rejects malformed updates and allows a properly structured original role",()=>{
   const value=validateTeamCopyUpdate({slug:"security-operations",title:"Not enough"});
   expect(value.ok).toBe(false);
   const legitimate=publicFunctionalTeams.find(t=>t.slug==="security-operations")!;
   expect(validateTeamCopyUpdate(legitimate).ok).toBe(true);
 });
 it("fails closed when Notion fails",async()=>{
   const request=vi.fn().mockResolvedValue(new Response("denied",{status:403}));
   const res=await getLiveTeamContent({NOTION_API_TOKEN:"test",NOTION_TEAM_COPY_PAGE_ID:"414b5b56-eac2-81e7-9621-fd4f447e3216"},request as unknown as typeof fetch);
   expect(res.status).toBe("provider_error");
   expect(res.teams).toHaveLength(19);
 });
 it("returns live source content, no-store fetch, and never returns a server secret",async()=>{
   const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({results:publicFunctionalTeams.map((t,i)=>mkBlock(t.slug,i)),has_more:false}),{status:200}));
   const result=await getLiveTeamContent({NOTION_API_TOKEN:"server-only-token",NOTION_TEAM_COPY_PAGE_ID:"414b5b56-eac2-81e7-9621-fd4f447e3216"},request as unknown as typeof fetch);
   expect(result.status).toBe("connected");
   expect(request.mock.calls[0][1].cache).toBe("no-store");
   expect(JSON.stringify(result)).not.toContain("server-only-token");
 });
});
