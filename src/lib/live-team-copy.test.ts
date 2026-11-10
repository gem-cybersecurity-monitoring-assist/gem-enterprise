import { describe, expect, it, vi } from "vitest";
import { publicFunctionalTeams } from "@/lib/public-personnel-teams";
import { getLiveTeamContent, mergeTeamCopy, parseTeamCodeBlock, validateTeamCopyUpdate } from "./live-team-copy";

const example=publicFunctionalTeams[0];
const valid=() => ({
  slug:example.slug,title:example.title,overview:example.overview,mission:example.mission,
  responsibilities:[...example.responsibilities],deliverables:[...example.deliverables],
});
const block=(value:unknown,id="b1")=>({
  id,last_edited_time:"2026-11-10T06:00:00.000Z",
  type:"code",code:{language:"json",rich_text:[{plain_text:JSON.stringify(value)}]},
});

describe("live Notion website team source",()=>{
  it("validates each structured team block against a known nonrestricted role",()=>{
    const parsed=parseTeamCodeBlock(block(valid()));
    expect(parsed?.slug).toBe(example.slug);
    expect(parseTeamCodeBlock(block({...valid(),slug:"vip-relationships"}))).toBeNull();
    expect(parseTeamCodeBlock(block({...valid(),mission:"Short"}))).toBeNull();
    expect(parseTeamCodeBlock(block({...valid(),responsibilities:["a"]}))).toBeNull();
    expect(parseTeamCodeBlock({type:"paragraph",paragraph:{rich_text:[]}})).toBeNull();
  });
  it("never changes the immutable division, slug or documented status via an editorial override",()=>{
    const source={...valid(),title:"Updated live department title",mission:example.mission+" Editorial update."};
    const result=mergeTeamCopy([block(source)]);
    expect(result.status).toBe("partial");
    expect(result.records).toHaveLength(1);
    expect(result.teams).toHaveLength(19);
    expect(result.teams.find(x=>x.slug===example.slug)).toMatchObject({
      title:"Updated live department title",
      division:example.division,
      status:example.status,
    });
    expect(result.teams.some(t=>t.slug==="vip-relationships")).toBe(false);
  });
  it("checks the full updated payload and fails closed if not configured",async()=>{
    expect(validateTeamCopyUpdate(valid()).ok).toBe(true);
    expect(validateTeamCopyUpdate({...valid(),slug:"unknown-role"}).ok).toBe(false);
    const request=vi.fn();
    const empty=await getLiveTeamContent({},request as unknown as typeof fetch);
    expect(empty.status).toBe("not_configured");
    expect(empty.records).toHaveLength(0);
    expect(empty.teams).toHaveLength(19);
    expect(request).not.toHaveBeenCalled();
  });
  it("reads the real Notion API and preserves fallback when the provider errors",async()=>{
    const response=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results:[block(valid())],has_more:false,
    }),{status:200,headers:{"Content-Type":"application/json"}}));
    const live=await getLiveTeamContent({
      NOTION_API_TOKEN:"safe-test-token",NOTION_TEAM_COPY_PAGE_ID:"414b5b56-eac2-81e7-9621-fd4f447e3216"
    },response as unknown as typeof fetch);
    expect(live.status).toBe("partial");
    expect(live.records[0].slug).toBe(example.slug);
    expect(String(response.mock.calls[0][0])).toContain("/blocks/414b5b56-eac2-81e7-9621-fd4f447e3216/children");

    const error=vi.fn().mockResolvedValue(new Response("Not found",{status:404}));
    const unavailable=await getLiveTeamContent({NOTION_API_TOKEN:"test",NOTION_TEAM_COPY_PAGE_ID:"414b5b56-eac2-81e7-9621-fd4f447e3216"},error as unknown as typeof fetch);
    expect(unavailable.status).toBe("provider_error");
    expect(unavailable.teams).toHaveLength(19);
  });
});
