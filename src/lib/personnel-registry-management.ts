import { isApprovedPublicDirectoryPage } from "@/lib/notion-public-directory";

const VERSION = "2025-09-03";
const MAX_PAGES = 10;
const PAGE_SIZE = 100;

type Obj = Record<string, unknown>;
const obj=(x:unknown):Obj|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Obj:null;
const prop=(p:unknown,k:string)=>obj(obj(p)?.[k]);
const select=(v:unknown):string=>{const p=prop(v,"select")??prop(v,"status");return typeof p?.name==="string"?p.name:"";};
const text=(v:unknown):string=>{
  const p=obj(v);
  for(const key of ["title","rich_text"]){
    const a=p?.[key];if(!Array.isArray(a))continue;
    const out=a.map(x=>{const y=obj(x);return typeof y?.plain_text==="string"?y.plain_text:typeof obj(y?.text)?.content==="string"?String(obj(y?.text)?.content):"";}).join("").trim();
    if(out)return out;
  }
  return "";
};
const date=(v:unknown):string=>typeof prop(v,"date")?.start==="string"?String(prop(v,"date")?.start):"";
const multi=(v:unknown):string[]=>{
  const a=obj(v)?.multi_select;
  return Array.isArray(a)?a.map(x=>obj(x)?.name).filter((x):x is string=>typeof x==="string"):[];
};
const uuid=(value:string)=>value.replace(/-/g,"").toLowerCase();

export interface PersonnelRegistryRecord {
  id:string;
  pageUrl:string;
  name:string;
  role:string;
  division:string;
  type:string;
  publicBio:string;
  verification:string;
  ceoApproval:string;
  audience:string[];
  websiteVisibility:string;
  publishApproved:boolean;
  photoStatus:string;
  reviewerPresent:boolean;
  lastVerified:string;
  expires:string;
  lastEditedTime:string;
  published:boolean;
  readyToPublish:boolean;
  blockers:string[];
}

export function publicationBlockers(page:unknown,now=new Date()):string[]{
  const p=obj(page)?.properties;
  const audience=multi(prop(p,"Audience"));
  const restricted=audience.some(x=>["vip","client","internal","super admin"].includes(x.toLowerCase()));
  const type=select(prop(p,"Type")).toLowerCase();
  const ceo=select(prop(p,"CEO Approval"));
  const verification=select(prop(p,"Verification Status"));
  const reviewer=obj(prop(p,"Reviewer"))?.people;
  const dateVerified=date(prop(p,"Last Verified"));
  const expiry=date(prop(p,"Expires"));
  const blockers:string[]=[];
  if(obj(page)?.archived===true||obj(page)?.in_trash===true)blockers.push("Archived");
  if(!["human","function"].includes(type))blockers.push("Type is not a public person/function");
  if(!audience.some(x=>x.toLowerCase()==="public")||restricted)blockers.push("Audience is not public-only");
  if(ceo!=="Approved")blockers.push("CEO approval not recorded");
  if(verification!=="Verified")blockers.push("Evidence verification incomplete");
  if(!Array.isArray(reviewer)||reviewer.length===0)blockers.push("Reviewer not assigned");
  if(!dateVerified||!Number.isFinite(Date.parse(dateVerified))||Date.parse(dateVerified)>now.getTime())blockers.push("Valid verification date missing");
  if(expiry){
    const validUntil=expiry.length===10?expiry+"T23:59:59.999Z":expiry;
    if(!Number.isFinite(Date.parse(validUntil))||Date.parse(validUntil)<now.getTime())blockers.push("Verification expired");
  }
  if(!text(prop(p,"Profile / Function")))blockers.push("Profile title missing");
  return blockers;
}

export function toManagerRecord(page:unknown):PersonnelRegistryRecord|null {
  const p=obj(page), props=p?.properties;
  if(typeof p?.id!=="string"||!props)return null;
  const name=text(prop(props,"Profile / Function"));
  if(!name)return null;
  const blockers=publicationBlockers(page);
  return {
    id:p.id,pageUrl:typeof p.url==="string"?p.url:"",
    name,role:text(prop(props,"Role")),division:select(prop(props,"Division")),
    type:select(prop(props,"Type")),publicBio:text(prop(props,"Public Bio")),
    verification:select(prop(props,"Verification Status")),
    ceoApproval:select(prop(props,"CEO Approval")),
    audience:multi(prop(props,"Audience")),
    websiteVisibility:select(prop(props,"Website Visibility")),
    publishApproved:obj(prop(props,"Publish Approved"))?.checkbox===true,
    photoStatus:select(prop(props,"Photo Status")),
    reviewerPresent:Array.isArray(obj(prop(props,"Reviewer"))?.people)&&((obj(prop(props,"Reviewer"))?.people as unknown[]).length>0),
    lastVerified:date(prop(props,"Last Verified")),
    expires:date(prop(props,"Expires")),
    lastEditedTime:typeof p.last_edited_time==="string"?p.last_edited_time:"",
    published:isApprovedPublicDirectoryPage(page),
    readyToPublish:blockers.length===0,
    blockers,
  };
}

export interface NewPersonnelDraft {
 name:string;role:string;publicBio:string;
 division:"Executive"|"Cybersecurity"|"Operations"|"Real Estate"|"Finance"|"Support"|"AI Governance";
 type:"Human"|"Function";
}
export function buildUnapprovedDraftProperties(draft:NewPersonnelDraft) {
 const rich=(value:string)=>value?[{type:"text",text:{content:value}}]:[];
 return {
   "Profile / Function":{title:rich(draft.name)},
   "Role":{rich_text:rich(draft.role)},
   "Division":{select:{name:draft.division}},
   "Type":{select:{name:draft.type}},
   "Public Bio":{rich_text:rich(draft.publicBio)},
   "Publish Approved":{checkbox:false},
   "Website Visibility":{select:{name:"Hidden"}},
   "Audience":{multi_select:[{name:"Internal"}]},
   "Verification Status":{select:{name:"Evidence Required"}},
   "CEO Approval":{select:{name:"Pending"}},
   "Photo Status":{select:{name:"No Photo"}},
   "Public License Display":{select:{name:"Not Applicable"}},
 };
}

export interface RegistryResult {
 status:"connected"|"not_configured"|"provider_error";
 records:PersonnelRegistryRecord[];
}

export async function fetchRegistryRows(
 env:{NOTION_API_TOKEN?:string;NOTION_PERSONNEL_DATA_SOURCE_ID?:string}={
   NOTION_API_TOKEN:process.env.NOTION_API_TOKEN,
   NOTION_PERSONNEL_DATA_SOURCE_ID:process.env.NOTION_PERSONNEL_DATA_SOURCE_ID,
 },
 request:typeof fetch=fetch
):Promise<RegistryResult>{
 const token=env.NOTION_API_TOKEN?.trim();
 const source=env.NOTION_PERSONNEL_DATA_SOURCE_ID?.trim().replace(/^collection:\/\//,"");
 if(!token||!source||!/^[\da-f-]{32,36}$/i.test(source))return {status:"not_configured",records:[]};
 const rows:unknown[]=[];let cursor:string|undefined;let complete=false;
 try{
   for(let i=0;i<MAX_PAGES;i++){
     const r=await request(`https://api.notion.com/v1/data_sources/${encodeURIComponent(source)}/query`,{
       method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","Notion-Version":VERSION},
       cache:"no-store",signal:AbortSignal.timeout(9000),
       body:JSON.stringify({page_size:PAGE_SIZE,...(cursor?{start_cursor:cursor}:{})}),
     });
     if(!r.ok)return {status:"provider_error",records:[]};
     const body=obj(await r.json());
     if(!body||!Array.isArray(body.results))return {status:"provider_error",records:[]};
     rows.push(...body.results);
     if(body.has_more!==true){complete=true;break;}
     cursor=typeof body.next_cursor==="string"?body.next_cursor:undefined;
     if(!cursor)return {status:"provider_error",records:[]};
   }
 }catch{return {status:"provider_error",records:[]};}
 if(!complete)return {status:"provider_error",records:[]};
 return {status:"connected",records:rows.map(toManagerRecord).filter((x):x is PersonnelRegistryRecord=>x!==null)};
}

export function belongsToRegistry(page:unknown,sourceId:string):boolean {
 const parent=obj(obj(page)?.parent);
 const id=typeof parent?.data_source_id==="string"?parent.data_source_id:"";
 return !!id&&uuid(id)===uuid(sourceId);
}

export async function notionRequest(
 token:string,path:string,opts:{method:"GET"|"PATCH";body?:unknown},request:typeof fetch=fetch,
):Promise<Obj|null>{
 const r=await request("https://api.notion.com/v1"+path,{
   method:opts.method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","Notion-Version":VERSION},
   ...(opts.body?{body:JSON.stringify(opts.body)}:{}),
   cache:"no-store",signal:AbortSignal.timeout(9000),
 });
 if(!r.ok)return null;
 return obj(await r.json());
}

export function sameSiteOrigin(origin:string|null,requestUrl:string):boolean {
 if(!origin)return false;
 try{
   const actual=new URL(origin),expected=new URL(requestUrl);
   return actual.protocol==="https:"&&actual.host===expected.host;
 }catch{return false;}
}
