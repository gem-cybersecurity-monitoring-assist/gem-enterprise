import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requirePlatformOwner, getRequestContext } from "@/lib/api/auth-helpers";
import { emitAuditLog } from "@/lib/audit";
import { getLiveTeamContent, validateTeamCopyUpdate, DEFAULT_TEAM_COPY_PAGE_ID, parseTeamCodeBlock } from "@/lib/live-team-copy";
import { notionRequest, sameSiteOrigin } from "@/lib/personnel-registry-management";

export const dynamic="force-dynamic";
const uuid=(s:string)=>s.replace(/-/g,"").toLowerCase();
const respond=(payload:unknown,status=200)=>NextResponse.json(payload,{status,headers:{"Cache-Control":"no-store"}});
const schema=z.object({
  slug:z.string().min(4).max(90),
  blockId:z.string().regex(/^[\da-f-]{32,36}$/i),
  expectedLastEditedTime:z.string().min(10),
  title:z.string().trim().min(5).max(170),
  overview:z.string().trim().min(10).max(300),
  mission:z.string().trim().min(30).max(1300),
  responsibilities:z.array(z.string().trim().min(8).max(240)).length(3),
  deliverables:z.array(z.string().trim().min(5).max(160)).length(3),
  reason:z.string().trim().min(10).max(500),
});

export async function GET(){
  const gate=await requireAdmin();if(!gate.ok)return gate.response;
  const source=await getLiveTeamContent();
  return respond({...source,sourcePageUrl:"https://app.notion.com/p/414b5b56eac281e79621fd4f447e3216",viewerRole:gate.session.role});
}

export async function PATCH(req:NextRequest){
  const gate=await requirePlatformOwner();if(!gate.ok)return gate.response;
  if(!sameSiteOrigin(req.headers.get("origin"),req.url))return respond({error:"Cross-origin change refused"},403);
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return respond({error:"Team content is invalid",details:parsed.error.flatten()},400);
  const {reason,blockId,expectedLastEditedTime,...candidate}=parsed.data;
  const validation=validateTeamCopyUpdate(candidate);
  if(!validation.ok)return respond({error:validation.error},400);
  const token=process.env.NOTION_API_TOKEN?.trim();
  const pageId=process.env.NOTION_TEAM_COPY_PAGE_ID?.trim()||DEFAULT_TEAM_COPY_PAGE_ID;
  if(!token)return respond({error:"The website content connection is not active",code:"NOTION_NOT_CONNECTED"},503);
  try{
    const current=await getLiveTeamContent();
    if(current.status!=="connected")return respond({error:"Website team source is missing, incomplete or unavailable"},503);
    const record=current.records.find(x=>x.slug===candidate.slug);
    if(!record||uuid(record.blockId)!==uuid(blockId))return respond({error:"Unknown team content block"},404);
    if(record.lastEditedTime!==expectedLastEditedTime)return respond({error:"The team copy changed in Notion; refresh before saving",code:"STALE_RECORD"},409);
    const previous=await notionRequest(token,`/blocks/${encodeURIComponent(blockId)}`,{method:"GET"});
    if(!previous)return respond({error:"Unable to revalidate source block"},503);
    if(uuid(String(previous.id??""))!==uuid(blockId)||previous.last_edited_time!==expectedLastEditedTime||
       parseTeamCodeBlock(previous)?.slug!==candidate.slug) return respond({error:"Source content changed; refresh before saving"},409);

    const rawJson=JSON.stringify(validation.copy);
    if(rawJson.length>1900)return respond({error:"Team content exceeds Notion's single-block size; shorten the description"},400);
    const saved=await notionRequest(token,`/blocks/${encodeURIComponent(blockId)}`,{
      method:"PATCH",body:{code:{rich_text:[{type:"text",text:{content:rawJson}}],language:"json"}},
    });
    if(!saved||parseTeamCodeBlock(saved)?.slug!==candidate.slug)return respond({error:"Notion did not confirm the published change"},503);
    revalidatePath("/personnel");
    revalidatePath(`/personnel/teams/${candidate.slug}`);
    await emitAuditLog({userId:gate.session.userId,action:"admin_action",resource:"notion_website_team_copy",
      resourceId:candidate.slug,metadata:{operation:"apply_live_team_copy",reason,blockId},...getRequestContext(req)});
    return respond({ok:true,updatedAt:saved.last_edited_time,slug:candidate.slug});
  }catch(err){
    console.error("[live-team-copy] Save failed",err instanceof Error?err.name:"error");
    return respond({error:"Live team content update failed"},503);
  }
}
