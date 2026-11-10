import { publicFunctionalTeams, type PublicFunctionalTeam } from "@/lib/public-personnel-teams";

const NOTION_VERSION = "2025-09-03";
export const DEFAULT_TEAM_COPY_PAGE_ID = "414b5b56-eac2-81e7-9621-fd4f447e3216";

type UnknownRecord = Record<string, unknown>;
const rec = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord : null;

export interface ManagedTeamCopy {
  blockId: string;
  lastEditedTime: string;
  slug: string;
}
export interface LiveTeamContentResult {
  status: "connected" | "not_configured" | "provider_error" | "partial";
  teams: PublicFunctionalTeam[];
  records: ManagedTeamCopy[];
}

function textValue(value: unknown): string {
  const r = rec(value);
  if (typeof r?.plain_text === "string") return r.plain_text;
  const t = rec(r?.text);
  return typeof t?.content === "string" ? t.content : "";
}

export function parseTeamCodeBlock(block: unknown): (Partial<PublicFunctionalTeam> & { slug: string }) | null {
  const raw = rec(block);
  if (raw?.type !== "code" || raw.in_trash === true || raw.archived === true) return null;
  const code = rec(raw.code);
  if (!Array.isArray(code?.rich_text)) return null;
  const json = code.rich_text.map(textValue).join("");
  if (json.length < 30 || json.length > 3500) return null;

  try {
    const v = rec(JSON.parse(json));
    if (!v || typeof v.slug !== "string" || !publicFunctionalTeams.some(x=>x.slug===v.slug)) return null;
    if (
      typeof v.title !== "string" || v.title.length < 5 || v.title.length > 170 ||
      typeof v.overview !== "string" || v.overview.length < 10 || v.overview.length > 300 ||
      typeof v.mission !== "string" || v.mission.length < 30 || v.mission.length > 1300 ||
      !Array.isArray(v.responsibilities) || v.responsibilities.length !== 3 ||
      !v.responsibilities.every(x=>typeof x === "string" && x.length>=8 && x.length<=240) ||
      !Array.isArray(v.deliverables) || v.deliverables.length !== 3 ||
      !v.deliverables.every(x=>typeof x === "string" && x.length>=5 && x.length<=160)
    ) return null;
    return {
      slug: v.slug, title: v.title, overview: v.overview, mission: v.mission,
      responsibilities: v.responsibilities, deliverables: v.deliverables,
    };
  } catch {
    return null;
  }
}

export function mergeTeamCopy(blocks: unknown[]): LiveTeamContentResult {
  const bySlug = new Map<string, Partial<PublicFunctionalTeam>>();
  const records: ManagedTeamCopy[] = [];

  for(const block of blocks) {
    const value = parseTeamCodeBlock(block);
    const raw = rec(block);
    if (!value || !raw || typeof raw.id !== "string" || typeof raw.last_edited_time !== "string") continue;
    if (bySlug.has(value.slug)) continue;
    bySlug.set(value.slug, value);
    records.push({slug:value.slug,blockId:raw.id,lastEditedTime:raw.last_edited_time});
  }
  const teams = publicFunctionalTeams.map(team => ({
    ...team,
    ...(bySlug.get(team.slug) ?? {}),
    slug: team.slug,
    division: team.division,
    status: team.status,
  }));
  return {
    status: bySlug.size === publicFunctionalTeams.length ? "connected" : "partial",
    teams, records,
  };
}

export function validateTeamCopyUpdate(
  input: unknown,
): {ok: true; copy: Pick<PublicFunctionalTeam,"slug"|"title"|"overview"|"mission"|"responsibilities"|"deliverables">} |
   {ok: false; error: string} {
  const r = rec(input);
  if (!r || typeof r.slug !== "string") return {ok:false,error:"Unknown team record"};
  const trial = parseTeamCodeBlock({
    type:"code",
    code:{rich_text:[{plain_text:JSON.stringify(r)}]},
  });
  if (!trial || !trial.title || !trial.overview || !trial.mission || !trial.responsibilities || !trial.deliverables) {
    return {ok:false,error:"Invalid team content. Provide a title, overview, mission and exactly three responsibilities and deliverables."};
  }
  return {ok:true,copy:{
    slug:trial.slug,title:trial.title,overview:trial.overview,mission:trial.mission,
    responsibilities:trial.responsibilities,deliverables:trial.deliverables,
  }};
}

export async function getLiveTeamContent(
  env: {NOTION_API_TOKEN?:string;NOTION_TEAM_COPY_PAGE_ID?:string} = process.env,
  request: typeof fetch = fetch,
): Promise<LiveTeamContentResult> {
  const fallback: LiveTeamContentResult = {status:"not_configured",teams:[...publicFunctionalTeams],records:[]};
  const token = env.NOTION_API_TOKEN?.trim();
  const pageId = env.NOTION_TEAM_COPY_PAGE_ID?.trim() || DEFAULT_TEAM_COPY_PAGE_ID;
  if (!token || !/^[\da-f-]{32,36}$/i.test(pageId)) return fallback;

  try {
    const blocks: unknown[] = [];
    let cursor: string | undefined;
    let finished=false;
    for(let i=0;i<3;i+=1) {
      const url=new URL(`https://api.notion.com/v1/blocks/${encodeURIComponent(pageId)}/children`);
      url.searchParams.set("page_size","100");
      if(cursor)url.searchParams.set("start_cursor",cursor);
      const response=await request(url.toString(),{
        method:"GET",
        headers:{Authorization:`Bearer ${token}`,"Notion-Version":NOTION_VERSION},
        cache:"no-store",signal:AbortSignal.timeout(8000),
      });
      if(!response.ok) return {...fallback,status:"provider_error"};
      const body=rec(await response.json());
      if (!body || !Array.isArray(body.results)) return {...fallback,status:"provider_error"};
      blocks.push(...body.results);
      if(body.has_more!==true){finished=true;break;}
      cursor=typeof body.next_cursor==="string" ? body.next_cursor:undefined;
      if(!cursor)return {...fallback,status:"provider_error"};
    }
    if(!finished)return {...fallback,status:"provider_error"};
    return mergeTeamCopy(blocks);
  } catch {
    return {...fallback,status:"provider_error"};
  }
}
