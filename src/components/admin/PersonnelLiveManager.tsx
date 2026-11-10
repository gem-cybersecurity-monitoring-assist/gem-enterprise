"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, RefreshCw, Save, ShieldAlert, UsersRound } from "lucide-react";
import type { LiveTeamContentResult } from "@/lib/live-team-copy";
import type { PersonnelRegistryRecord, RegistryResult } from "@/lib/personnel-registry-management";

type RegistryResponse=RegistryResult & {viewerRole?:string};
type TeamResponse=LiveTeamContentResult & {viewerRole?:string;sourcePageUrl?:string};
type Action="saveDraft"|"publish"|"unpublish";
const empty=(value:string|undefined|null)=>value??"";

async function readJson<T>(url:string):Promise<T>{
  const r=await fetch(url,{cache:"no-store",credentials:"same-origin"});
  if(!r.ok)throw new Error("Unable to load the live management source");
  return r.json() as Promise<T>;
}

function SourceStatus({state}:{state:string}) {
  const active=state==="connected";
  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${active?"border-emerald-300/30 bg-emerald-300/10 text-emerald-200":"border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>
    {active?"Connected to live source":state==="partial"?"Source content needs review":state==="not_configured"?"Connection authorization required":"Source temporarily unavailable"}
  </span>;
}

export function PersonnelLiveManager() {
  const [registry,setRegistry]=useState<RegistryResponse|null>(null);
  const [teamSource,setTeamSource]=useState<TeamResponse|null>(null);
  const [tab,setTab]=useState<"teams"|"people">("teams");
  const [selectedTeam,setSelectedTeam]=useState("executive-office");
  const [selectedPerson,setSelectedPerson]=useState("");
  const [teamDraft,setTeamDraft]=useState({title:"",overview:"",mission:"",responsibilities:["","",""],deliverables:["","",""]});
  const [personDraft,setPersonDraft]=useState({role:"",publicBio:""});
  const [confirmName,setConfirmName]=useState("");
  const [reason,setReason]=useState("");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [refreshedAt,setRefreshedAt]=useState("");

  const refresh=useCallback(async()=>{
    try{
      const [newRegistry,newTeamSource]=await Promise.all([
        readJson<RegistryResponse>("/api/admin/personnel-registry"),
        readJson<TeamResponse>("/api/admin/team-copy"),
      ]);
      setRegistry(newRegistry);
      setTeamSource(newTeamSource);
      setRefreshedAt(new Date().toLocaleTimeString());
      setError("");
      setSelectedPerson(old=>old&&newRegistry.records.some(r=>r.id===old)?old:newRegistry.records[0]?.id??"");
    }catch(err){setError(err instanceof Error?err.message:"Unable to refresh live sources");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    void refresh();
    const handle=window.setInterval(()=>{if(!busy)void refresh()},30000);
    return ()=>window.clearInterval(handle);
  },[refresh,busy]);

  const role=teamSource?.viewerRole??registry?.viewerRole??"";
  const owner=role==="super_admin";
  const team=teamSource?.teams.find(t=>t.slug===selectedTeam)??teamSource?.teams[0];
  const teamRecord=teamSource?.records.find(x=>x.slug===team?.slug);
  const person=registry?.records.find(x=>x.id===selectedPerson);
  const currentRecords=useMemo(()=>registry?.records.filter(x=>
    [x.name,x.role,x.division].some(t=>t.toLowerCase().includes(search.trim().toLowerCase())))??[],
    [registry,search]);
  useEffect(()=>{
    if(!team)return;
    setTeamDraft({title:team.title,overview:team.overview,mission:team.mission,
      responsibilities:[...team.responsibilities],deliverables:[...team.deliverables]});
  },[team?.slug,team?.title,team?.mission,team?.overview,team?.responsibilities,team?.deliverables]);
  useEffect(()=>{
    if(!person)return;
    setPersonDraft({role:person.role,publicBio:person.publicBio});
    setConfirmName("");
  },[person?.id,person?.lastEditedTime]);

  const write=async(url:string,payload:unknown)=>{
    setBusy(true);setError("");setNotice("");
    try{
      const result=await fetch(url,{method:"PATCH",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const reply=await result.json().catch(()=>({error:"The server returned an unreadable response"}));
      if(!result.ok)throw new Error(reply.error??"Operation did not complete");
      setNotice("The source confirmed the change. The live website now reads the updated publication state.");
      await refresh();
    }catch(err){setError(err instanceof Error?err.message:"The requested operation failed");}
    finally{setBusy(false);}
  };

  const saveTeam=async()=>{
    if(!team||!teamRecord||!owner)return;
    await write("/api/admin/team-copy",{
      slug:team.slug,blockId:teamRecord.blockId,expectedLastEditedTime:teamRecord.lastEditedTime,
      ...teamDraft,reason,
    });
  };
  const changePerson=async(action:Action)=>{
    if(!person)return;
    const payload=action==="saveDraft"?
      {action,id:person.id,expectedLastEditedTime:person.lastEditedTime,...personDraft}:
      {action,id:person.id,expectedLastEditedTime:person.lastEditedTime,confirmName,reason};
    await write("/api/admin/personnel-registry",payload);
  };

  return <main className="space-y-6 pb-14 text-slate-100">
    <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#143048] via-[#0c1b30] to-[#081423] p-6 sm:p-9">
      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
        <UsersRound className="h-5 w-5"/> Connected personnel publishing
      </div>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">People &amp; Teams · Live Management</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
        Manage authoritative source records from your administrator session. Edits read and write
        to Notion, not a sample database. The public website displays only approved people,
        while team descriptions update from the dedicated website-copy source.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/personnel" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-[#061423]">Open live public page <ArrowRight className="h-4 w-4"/></Link>
        <Link href="/app/admin/team-gallery" className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-200">Original media review</Link>
        <button type="button" onClick={()=>void refresh()} disabled={loading||busy} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm text-slate-200 disabled:opacity-50"><RefreshCw className="h-4 w-4"/> Refresh now</button>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Source checks every 30 seconds while this page is open. {refreshedAt? `Last checked: ${refreshedAt}`:"Connecting to sources…"}
      </p>
    </header>

    {notice&&<p role="status" className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-5 py-4 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-[#0b1b2b] p-5"><p className="text-sm text-slate-400">Department profiles</p><p className="mt-2 text-3xl font-bold">{teamSource?.teams.length??"—"}</p><div className="mt-3"><SourceStatus state={teamSource?.status??"loading"}/></div></div>
      <div className="rounded-2xl border border-white/10 bg-[#0b1b2b] p-5"><p className="text-sm text-slate-400">Registry records</p><p className="mt-2 text-3xl font-bold">{registry?.status==="connected"?registry.records.length:"—"}</p><div className="mt-3"><SourceStatus state={registry?.status??"loading"}/></div></div>
      <div className="rounded-2xl border border-white/10 bg-[#0b1b2b] p-5"><p className="text-sm text-slate-400">Approved published people</p><p className="mt-2 text-3xl font-bold">{registry?.status==="connected"?registry.records.filter(x=>x.published).length:"—"}</p><p className="mt-3 text-xs text-slate-400">From the verified publication gate only</p></div>
    </div>

    {(registry?.status==="not_configured"||teamSource?.status==="not_configured")&&
      <div className="rounded-2xl border border-amber-300/25 bg-[#1d2027] p-5 sm:p-6">
        <p className="flex items-center gap-2 font-semibold text-amber-100"><ShieldAlert className="h-5 w-5"/> Notion production authorization is missing</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">The website does not have its own Notion integration token. No write controls will claim success until the real integration has been authorized and saved server-side. Your ChatGPT Notion connection does not automatically grant a Vercel server token.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-cyan-300">Notion integrations <ExternalLink className="h-3.5 w-3.5"/></a>
          <a href="https://vercel.com/admin-25521151s-projects/support371-gem-enterprise/settings/environment-variables" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-cyan-300">Server environment <ExternalLink className="h-3.5 w-3.5"/></a>
        </div>
      </div>}

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Live personnel management sections">
      <button role="tab" aria-selected={tab==="teams"} onClick={()=>{setTab("teams");setNotice("");}} className={`rounded-full border px-5 py-2.5 text-sm font-bold ${tab==="teams"?"border-cyan-300 bg-cyan-300 text-[#061423]":"border-white/20 text-slate-200"}`}>Department website copy</button>
      <button role="tab" aria-selected={tab==="people"} onClick={()=>{setTab("people");setNotice("");}} className={`rounded-full border px-5 py-2.5 text-sm font-bold ${tab==="people"?"border-cyan-300 bg-cyan-300 text-[#061423]":"border-white/20 text-slate-200"}`}>Personnel publication</button>
    </div>

    {tab==="teams"&&team&&<section className="grid gap-5 xl:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.7fr)]">
      <aside className="max-h-[640px] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1929] p-4" aria-label="Select a team">
        {teamSource?.teams.map(t=><button key={t.slug} onClick={()=>{setSelectedTeam(t.slug);setNotice("");}} className={`w-full rounded-xl border p-3 text-left text-sm ${t.slug===team.slug?"border-cyan-300/60 bg-cyan-300/10 text-cyan-200":"border-transparent text-slate-300 hover:bg-white/10"}`}>{t.title}</button>)}
      </aside>
      <div className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1929] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{team.title}</h2>
          <Link href={`/personnel/teams/${team.slug}`} target="_blank" className="inline-flex gap-1.5 text-xs text-cyan-300">Live page <ExternalLink className="h-4 w-4"/></Link>
        </div>
        {!owner&&<p className="text-sm text-amber-200">Only the platform owner may publish changes to public team copy.</p>}
        {teamSource?.status!=="connected"&&<p className="text-sm text-amber-100">Live publishing is unavailable until all structured Notion blocks are connected and validated.</p>}
        <label className="block text-sm text-slate-300">Team title<input value={teamDraft.title} onChange={e=>setTeamDraft(p=>({...p,title:e.target.value}))} maxLength={170} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"/></label>
        <label className="block text-sm text-slate-300">Short summary<textarea rows={2} value={teamDraft.overview} onChange={e=>setTeamDraft(p=>({...p,overview:e.target.value}))} maxLength={300} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"/></label>
        <label className="block text-sm text-slate-300">Mission and work definition<textarea rows={5} value={teamDraft.mission} onChange={e=>setTeamDraft(p=>({...p,mission:e.target.value}))} maxLength={1300} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"/></label>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["responsibilities","deliverables"] as const).map(field=><div key={field} className="space-y-3">
            <h3 className="text-sm font-semibold capitalize">{field}</h3>
            {teamDraft[field].map((entry,i)=><label className="block text-xs text-slate-400" key={i}>Item {i+1}<textarea rows={2} value={entry} onChange={e=>setTeamDraft(p=>({...p,[field]:p[field].map((v,k)=>k===i?e.target.value:v)}))} className="mt-1 w-full rounded-lg border border-white/15 bg-[#081320] p-2 text-sm text-slate-100"/></label>)}
          </div>)}
        </div>
        <label className="block text-sm text-slate-300">Publication reason / change reference<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="Required reason for this public change" className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"/></label>
        <button type="button" onClick={()=>void saveTeam()} disabled={!owner||busy||!teamRecord||teamSource?.status!=="connected"||reason.trim().length<10} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-[#061423] disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4"/> Save directly to live website source</button>
        <p className="text-xs leading-6 text-slate-400">Changing this source updates the public Personnel directory and individual team page. Staff names and credentials have a separate verification process.</p>
      </div>
    </section>}

    {tab==="people"&&<section className="grid gap-5 xl:grid-cols-[minmax(230px,.8fr)_minmax(0,1.7fr)]">
      <aside className="space-y-3 rounded-2xl border border-white/10 bg-[#0b1929] p-4">
        <label className="block text-xs text-slate-400">Search registry records<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, role, division" className="mt-2 w-full rounded-lg border border-white/15 bg-[#081320] p-3 text-sm text-white"/></label>
        <div className="max-h-[550px] space-y-2 overflow-y-auto">
          {currentRecords.map(r=><button key={r.id} onClick={()=>{setSelectedPerson(r.id);setNotice("");}} className={`w-full rounded-xl border p-3 text-left ${person?.id===r.id?"border-cyan-300/60 bg-cyan-300/10":"border-transparent hover:bg-white/10"}`}>
            <span className="block text-sm font-semibold">{r.name}</span><span className="mt-1 block text-xs text-slate-400">{r.role||r.type}</span>
            <span className={`mt-2 block text-[11px] ${r.published?"text-emerald-300":"text-amber-200"}`}>{r.published?"Published":"Not published"}</span>
          </button>)}
          {!currentRecords.length&&<p className="text-sm text-slate-400">No accessible records match the search.</p>}
        </div>
      </aside>
      {person?<div className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1929] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs uppercase tracking-wider text-cyan-300">{person.type} · {person.division}</p><h2 className="mt-2 text-2xl font-bold">{person.name}</h2></div>
          {person.pageUrl&&<a href={person.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 text-xs text-cyan-300">Original record <ExternalLink className="h-4 w-4"/></a>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[["Verification",person.verification],["CEO approval",person.ceoApproval],["Visibility",person.websiteVisibility],["Photo",person.photoStatus]].map(([label,value])=><span key={label} className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300">{label}: {value||"Not recorded"}</span>)}
        </div>
        <label className="block text-sm text-slate-300">Role<input disabled={person.publishApproved||person.websiteVisibility==="Public"||busy} value={personDraft.role} onChange={e=>setPersonDraft(p=>({...p,role:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white disabled:opacity-50"/></label>
        <label className="block text-sm text-slate-300">Public biography<textarea rows={6} maxLength={1900} disabled={person.publishApproved||person.websiteVisibility==="Public"||busy} value={personDraft.publicBio} onChange={e=>setPersonDraft(p=>({...p,publicBio:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white disabled:opacity-50"/></label>
        <button type="button" onClick={()=>void changePerson("saveDraft")} disabled={busy||person.publishApproved||person.websiteVisibility==="Public"} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/35 px-4 py-2.5 text-sm font-bold text-cyan-300 disabled:opacity-40"><Save className="h-4 w-4"/> Save draft to Notion</button>
        <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-5">
          <h3 className="text-lg font-bold">Publication evidence and approval gates</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">Publication is unavailable unless an authorized reviewer has independently verified the source record, CEO approval, audience, identity and expiry.</p>
          {person.blockers.length>0?<ul className="mt-3 space-y-2">{person.blockers.map(blocker=><li key={blocker} className="text-xs text-amber-100">• {blocker}</li>)}</ul>:
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4"/> Record meets configured evidence gates</p>}
          <label className="mt-5 block text-sm text-slate-300">Type the full record name to confirm<input value={confirmName} onChange={e=>setConfirmName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"/></label>
          <label className="mt-4 block text-sm text-slate-300">Reason for publication action<input value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"/></label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={()=>void changePerson("publish")} disabled={!owner||busy||!person.readyToPublish||person.published||confirmName!==person.name||reason.trim().length<10} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#05211a] disabled:opacity-40">Approve for public display</button>
            <button type="button" onClick={()=>void changePerson("unpublish")} disabled={busy||!person.publishApproved&&!person.websiteVisibility.includes("Public")||confirmName!==person.name||reason.trim().length<10} className="rounded-xl border border-rose-300/40 px-4 py-2.5 text-sm font-bold text-rose-200 disabled:opacity-40">Hide immediately</button>
          </div>
          {!owner&&<p className="mt-3 text-xs text-slate-400">Only the platform owner can approve a profile for publication.</p>}
        </section>
      </div>:<div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm text-slate-400">
        {registry?.status==="connected"?"No registry item selected":"The authoritative Notion registry is not yet connected to this application."}
      </div>}
    </section>}
  </main>;
}
