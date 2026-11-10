import { describe, expect, it } from "vitest";
import { buildUnapprovedDraftProperties } from "./personnel-registry-management";

describe("authoritative Notion personnel draft creation",()=>{
 const draft={name:"Unapproved Example",role:"Unassigned professional role",division:"Cybersecurity" as const,type:"Human" as const,publicBio:"Unverified role summary"};

 it("always creates restricted unpublished records, even when the caller proposes a profile",()=>{
   const fields=buildUnapprovedDraftProperties(draft);
   expect(fields["Publish Approved"]).toEqual({checkbox:false});
   expect(fields["Website Visibility"]).toEqual({select:{name:"Hidden"}});
   expect(fields["Audience"]).toEqual({multi_select:[{name:"Internal"}]});
   expect(fields["Verification Status"]).toEqual({select:{name:"Evidence Required"}});
   expect(fields["CEO Approval"]).toEqual({select:{name:"Pending"}});
   expect(fields["Public License Display"]).toEqual({select:{name:"Not Applicable"}});
 });
 it("retains exact title, division, type and public draft text",()=>{
   const fields=buildUnapprovedDraftProperties({...draft,type:"Function"});
   expect(fields["Profile / Function"].title[0].text.content).toBe("Unapproved Example");
   expect(fields["Division"]).toEqual({select:{name:"Cybersecurity"}});
   expect(fields["Type"]).toEqual({select:{name:"Function"}});
   expect(fields["Public Bio"].rich_text[0].text.content).toContain("Unverified role");
 });
});
