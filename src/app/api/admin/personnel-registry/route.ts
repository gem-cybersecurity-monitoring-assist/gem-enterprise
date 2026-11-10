import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, requirePlatformOwner, getRequestContext } from "@/lib/api/auth-helpers";
import { emitAuditLog } from "@/lib/audit";
import { fetchRegistryRows, notionRequest, toManagerRecord, belongsToRegistry, publicationBlockers, sameSiteOrigin, buildUnapprovedDraftProperties } from "@/lib/personnel-registry-management";

export const dynamic="force-dynamic";
const uuid=z.string().regex(/^[\da-f-]{32,36}$/i);
const mutation=z.discriminatedUnion("action",[
 z.object({action:z.literal("saveDraft"),id:uuid,expectedLastEditedTime:z.string().min(10),role:z.string().trim().max(200),publicBio:z.string().trim().max(1900),reason:z.string().trim().min(10).max(500)}),
 z.object({action:z.literal("unpublish"),id:uuid,expectedLastEditedTime:z.string().min(10),confirmName:z.string().trim().min(1),reason:z.string().trim().min(10).max(500)}),
 z.object({action:z.literal("publish"),id:uuid,expectedLastEditedTime:z.string().min(10),confirmName:z.string().trim().min(1),reason:z.string().trim().min(10).max(500)}),
]);
const createDraftSchema=z.object({
 name:z.string().trim().min(3).max(150),
 role:z.string().trim().min(3).max(200),
 division:z.enum(["Executive","Cybersecurity","Operations","Real Estate","Finance","Support","AI Governance"]),
 type:z.enum(["Human","Function"]),
 publicBio:z.string().trim().max(1900),
 reason:z.string().trim().min(10).max(500),
});
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const safeId=(v:string)=>v.replace(/-/g,"").toLowerCase();

export async function GET(){
 const auth=await requireAdmin();if(!auth.ok)return auth.response;
 const result=await fetchRegistryRows();
 return respond({...result,viewerRole:auth.session.role,source:"GEM Production Directory & Verification Registry"});
}

export async function POST(req:NextRequest){
 const gate=await requireAdmin();if(!gate.ok)return gate.response;
 if(!sameSiteOrigin(req.headers.get("origin"),req.url))return respond({error:"Cross-origin write refused"},403);
 const parsed=createDraftSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return respond({error:"Invalid personnel draft data",details:parsed.error.flatten()},400);
 const token=process.env.NOTION_API_TOKEN?.trim();
 const source=process.env.NOTION_PERSONNEL_DATA_SOURCE_ID?.trim().replace(/^collection:\/\//,"");
 if(!token||!source||!uuid.safeParse(source).success)
   return respond({error:"Live Notion personnel registry is not connected",code:"NOTION_NOT_CONNECTED"},503);
 try{
   const current=await fetchRegistryRows();
   if(current.status!=="connected")return respond({error:"Source registry unavailable. No draft was created."},503);
   const targetName=parsed.data.name.toLocaleLowerCase();
   if(current.records.some(r=>r.name.trim().toLocaleLowerCase()===targetName))
     return respond({error:"This name already exists in the registry. Open the existing record instead.",code:"DUPLICATE_RECORD"},409);
   const {name,role,division,type,publicBio}=parsed.data;
   if(!name||!role||!division||!type||publicBio===undefined)
     return respond({error:"Personnel draft fields are required"},400);
   const properties=buildUnapprovedDraftProperties({name,role,division,type,publicBio});
   const response=await fetch("https://api.notion.com/v1/pages",{
     method:"POST",
     headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","Notion-Version":"2025-09-03"},
     cache:"no-store",signal:AbortSignal.timeout(9000),
     body:JSON.stringify({parent:{type:"data_source_id",data_source_id:source},properties}),
   });
   if(!response.ok){
     console.error("[personnel-registry] Notion draft create returned",response.status);
     return respond({error:"The Notion registry did not accept this draft",code:"NOTION_CREATE_FAILED"},503);
   }
   const created=await response.json();
   if(!belongsToRegistry(created,source))
     return respond({error:"The created draft could not be verified against the authorized registry"},503);
   const record=toManagerRecord(created);
   if(!record||record.publishApproved||record.websiteVisibility!=="Hidden"||record.published)
     return respond({error:"The draft creation did not meet the required unpublished state"},503);
   await emitAuditLog({
     userId:gate.session.userId,action:"admin_action",resource:"notion_personnel_registry",resourceId:record.id,
     metadata:{operation:"create_unverified_draft",name:record.name,reason:parsed.data.reason,editorRole:gate.session.role},
     ...getRequestContext(req),
   });
   revalidatePath("/personnel");
   return respond({ok:true,record},201);
 }catch(error){
   console.error("[personnel-registry] Draft creation failed",error instanceof Error?error.name:"error");
   return respond({error:"The Notion personnel draft could not be created"},503);
 }
}

export async function PATCH(req:NextRequest){
 const gate=await requireAdmin();if(!gate.ok)return gate.response;
 if(!sameSiteOrigin(req.headers.get("origin"),req.url))return respond({error:"Cross-origin write refused"},403);
 const parse=mutation.safeParse(await req.json().catch(()=>null));
 if(!parse.success)return respond({error:"Invalid change request"},400);
 const command=parse.data;
 if(command.action==="publish"){
   const owner=await requirePlatformOwner();
   if(!owner.ok)return owner.response;
 }
 const token=process.env.NOTION_API_TOKEN?.trim(),source=process.env.NOTION_PERSONNEL_DATA_SOURCE_ID?.trim().replace(/^collection:\/\//,"");
 if(!token||!source)return respond({error:"Notion management connection is not active",code:"NOTION_NOT_CONNECTED"},503);

 try{
   const current=await notionRequest(token,`/pages/${encodeURIComponent(command.id)}`,{method:"GET"});
   if(!current)return respond({error:"Notion record unavailable"},503);
   if(!belongsToRegistry(current,source))return respond({error:"Not in approved registry"},404);
   const found=toManagerRecord(current);
   if(!found||safeId(found.id)!==safeId(command.id))return respond({error:"Registry item not found"},404);
   if(found.lastEditedTime!==command.expectedLastEditedTime)return respond({error:"Record changed since it was loaded. Refresh before editing.",code:"STALE_RECORD"},409);

   let properties:Record<string,unknown>;
   if(command.action==="saveDraft"){
     if(found.publishApproved||found.websiteVisibility==="Public"){
       return respond({error:"Unpublish this record before changing its public role or biography."},409);
     }
     properties={
       "Role":{rich_text:command.role?[{type:"text",text:{content:command.role}}]:[]},
       "Public Bio":{rich_text:command.publicBio?[{type:"text",text:{content:command.publicBio}}]:[]},
     };
   }else{
     if(command.confirmName!==found.name)return respond({error:"Typed confirmation does not match the record title"},400);
     if(command.action==="publish"){
       const blockers=publicationBlockers(current);
       if(blockers.length)return respond({error:"Evidence or authorization checks are incomplete",blockers},409);
       properties={"Publish Approved":{checkbox:true},"Website Visibility":{select:{name:"Public"}}};
     }else{
       properties={"Publish Approved":{checkbox:false},"Website Visibility":{select:{name:"Hidden"}}};
     }
   }
   const updated=await notionRequest(token,`/pages/${encodeURIComponent(command.id)}`,{method:"PATCH",body:{properties}});
   if(!updated)return respond({error:"Notion did not confirm the update"},503);
   const saved=toManagerRecord(updated);
   if(!saved)return respond({error:"Notion returned an unreadable record"},502);
   if(command.action==="publish"&&!saved.published)return respond({error:"Publication was not confirmed by the verification gate"},409);
   if(command.action==="unpublish"&&(saved.publishApproved||saved.websiteVisibility==="Public"))return respond({error:"Hide operation could not be verified"},503);
   const ctx=getRequestContext(req);
   await emitAuditLog({
     userId:gate.session.userId,action:"admin_action",resource:"notion_personnel_registry",resourceId:saved.id,
     metadata:{operation:command.action,reason:"reason" in command?command.reason:undefined,beforePublish:found.published,afterPublish:saved.published,editorRole:gate.session.role},
     ...ctx,
   });
   revalidatePath("/personnel");
   revalidatePath(`/personnel/profile/${saved.id}`);
   return respond({ok:true,record:saved});
 }catch(error){
   console.error("[personnel-registry] Notion operation failed",error instanceof Error?error.name:"error");
   return respond({error:"The registry action could not be completed"},503);
 }
}
