import { describe, expect, it, vi } from "vitest";
import { belongsToRegistry, fetchRegistryRows, publicationBlockers, sameSiteOrigin, toManagerRecord } from "./personnel-registry-management";

const title=(v:string)=>({title:[{plain_text:v}]});
const rich=(v:string)=>({rich_text:[{plain_text:v}]});
const sel=(v:string)=>({select:{name:v}});
const dataSourceId="7b16d9de-a86e-4aed-8ab7-7c9b937d3abc";
const mockPage=(overrides:Record<string,unknown>={})=>({
  id:"3b0b5b56-eac2-81a1-aa47-ed2de5c00e10",
  last_edited_time:"2026-11-10T06:00:00.000Z",
  parent:{type:"data_source_id",data_source_id:dataSourceId},
  properties:{
    "Profile / Function":title("Named Employee"),
    Role:rich("Department Professional"),
    Division:sel("Cybersecurity"),
    Type:sel("Human"),
    "Public Bio":rich("Approved text"),
    "Website Visibility":sel("Hidden"),
    "Publish Approved":{checkbox:false},
    "Verification Status":sel("Evidence Required"),
    "CEO Approval":sel("Pending"),
    Audience:{multi_select:[{name:"Internal"}]},
    "Last Verified":{date:null},
    Reviewer:{people:[]},
    "Photo Status":sel("No Photo"),
    ...overrides,
  },
});

describe("authenticated GEM Notion registry management",()=>{
  it("shows real unpublished rows with clear evidence blockers",()=>{
    const row=toManagerRecord(mockPage());
    expect(row?.name).toBe("Named Employee");
    expect(row?.published).toBe(false);
    expect(row?.readyToPublish).toBe(false);
    expect(row?.blockers).toContain("Evidence verification incomplete");
    expect(row?.publicBio).toBe("Approved text");
    expect(row).not.toHaveProperty("License Number");
    expect(row).not.toHaveProperty("Evidence Files");
  });
  it("never treats a VIP, AI or unverified person as publishable",()=>{
    const approved={
      "Website Visibility":sel("Public"),
      "Publish Approved":{checkbox:true},
      "Verification Status":sel("Verified"),
      "CEO Approval":sel("Approved"),
      Audience:{multi_select:[{name:"Public"}]},
      "Last Verified":{date:{start:"2026-11-10"}},
      Reviewer:{people:[{id:"reviewer"}]},
    };
    expect(publicationBlockers(mockPage(approved))).toHaveLength(0);
    expect(toManagerRecord(mockPage(approved))?.published).toBe(true);
    expect(publicationBlockers(mockPage({...approved,Type:sel("AI")}))).toContain("Type is not a public person/function");
    expect(publicationBlockers(mockPage({...approved,Audience:{multi_select:[{name:"VIP"},{name:"Public"}]}}))).toContain("Audience is not public-only");
    expect(publicationBlockers(mockPage({...approved,"Verification Status":sel("Suspended")}))).toContain("Evidence verification incomplete");
  });
  it("binds changes to exactly the approved data source and same origin",()=>{
    expect(belongsToRegistry(mockPage(),dataSourceId)).toBe(true);
    expect(belongsToRegistry(mockPage(),"11111111-1111-1111-1111-111111111111")).toBe(false);
    expect(sameSiteOrigin("https://www.gemcybersecurityassist.com","https://www.gemcybersecurityassist.com/api/admin/personnel-registry")).toBe(true);
    expect(sameSiteOrigin("https://evil.example","https://www.gemcybersecurityassist.com/api/admin/personnel-registry")).toBe(false);
    expect(sameSiteOrigin(null,"https://www.gemcybersecurityassist.com/api/admin/personnel-registry")).toBe(false);
  });
  it("fetches real registry rows with pagination and no public-data leakage",async()=>{
    const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({results:[mockPage()],has_more:false}),{status:200}));
    const result=await fetchRegistryRows({NOTION_API_TOKEN:"test",NOTION_PERSONNEL_DATA_SOURCE_ID:dataSourceId},request as unknown as typeof fetch);
    expect(result.status).toBe("connected");
    expect(result.records).toHaveLength(1);
    expect(result.records[0].published).toBe(false);
    expect(String(request.mock.calls[0][0])).toContain("/data_sources/"+dataSourceId+"/query");
    expect(JSON.stringify(result)).not.toContain("test");
  });
  it("returns disconnected instead of sample records when no credentials exist",async()=>{
    const request=vi.fn();
    expect(await fetchRegistryRows({},request as unknown as typeof fetch)).toEqual({status:"not_configured",records:[]});
    expect(request).not.toHaveBeenCalled();
  });
});
