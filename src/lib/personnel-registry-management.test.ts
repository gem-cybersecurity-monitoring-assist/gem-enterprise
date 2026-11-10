import { describe, expect, it } from "vitest";
import { belongsToRegistry, publicationBlockers, sameSiteOrigin, toManagerRecord } from "./personnel-registry-management";

const text=(s:string)=>({rich_text:[{plain_text:s}]});
const title=(s:string)=>({title:[{plain_text:s}]});
const select=(s:string)=>({select:{name:s}});
const multi=(names:string[])=>({multi_select:names.map(name=>({name}))});
const page=(values:Record<string,unknown>={},extras:Record<string,unknown>={})=>({
 id:"11111111-2222-3333-4444-555555555555",
 parent:{type:"data_source_id",data_source_id:"7b16d9de-a86e-4aed-8ab7-7c9b937d3abc"},
 url:"https://www.notion.so/11111111222233334444555555555555",
 last_edited_time:"2026-11-10T06:00:00.000Z",
 properties:{
  "Profile / Function":title("Original staff record"),
  "Role":text("Security advisory"),
  "Public Bio":text("Reviewed and approved professional role explanation."),
  "Division":select("Cybersecurity"),
  "Type":select("Human"),
  "Publish Approved":{checkbox:false},
  "Website Visibility":select("Hidden"),
  "Audience":multi(["Public"]),
  "Verification Status":select("Verified"),
  "CEO Approval":select("Approved"),
  "Reviewer":{people:[{id:"staff-reviewer"}]},
  "Last Verified":{date:{start:"2026-11-09"}},
  "Photo Status":select("No Photo"),
  ...values,
 },...extras
});
describe("real Notion registry controls",()=>{
 it("flags absent verification before publishing, without exposing evidence files",()=>{
   const x=page({"Verification Status":select("Evidence Required"),"CEO Approval":select("Pending")});
   expect(publicationBlockers(x)).toContain("Evidence verification incomplete");
   expect(publicationBlockers(x)).toContain("CEO approval not recorded");
   const record=toManagerRecord(x)!;
   expect(record.published).toBe(false);
   expect(record.readyToPublish).toBe(false);
   expect(record).not.toHaveProperty("evidenceFiles");
   expect(record).not.toHaveProperty("licenseNumber");
 });
 it("requires an exact approved source database parent before a write",()=>{
   expect(belongsToRegistry(page(),"7b16d9de-a86e-4aed-8ab7-7c9b937d3abc")).toBe(true);
   expect(belongsToRegistry(page(),"11111111-1111-1111-1111-111111111111")).toBe(false);
   expect(belongsToRegistry(page({}, {parent:{type:"page_id",page_id:"7b16d9de-a86e-4aed-8ab7-7c9b937d3abc"}}),"7b16d9de-a86e-4aed-8ab7-7c9b937d3abc")).toBe(false);
 });
 it("rejects cross-origin writes",()=>{
   expect(sameSiteOrigin("https://www.gemcybersecurityassist.com","https://www.gemcybersecurityassist.com/api/admin/personnel-registry")).toBe(true);
   expect(sameSiteOrigin("https://outside.example","https://www.gemcybersecurityassist.com/api/admin/personnel-registry")).toBe(false);
   expect(sameSiteOrigin(null,"https://www.gemcybersecurityassist.com/api/admin/personnel-registry")).toBe(false);
 });
 it("prevents VIP or AI people from being marked publish-ready",()=>{
   expect(publicationBlockers(page({"Audience":multi(["Public","VIP"])}))).toContain("Audience is not public-only");
   expect(publicationBlockers(page({"Type":select("AI")}))).toContain("Type is not a public person/function");
 });
});
