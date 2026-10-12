"use client";

import { useCallback, useEffect, useState } from "react";

type Event = {id:string; tenantId:string; source:string; sourceEventId:string; severity:string; title:string; description:string; occurredAt:string; state:string; requiresReview:boolean};
type Collector = {id:string; tenantId:string; source:string; label:string; enabled:boolean; revokedAt:string|null; expiresAt:string};
const box="rounded-xl border border-slate-700 bg-slate-900/70 p-5";
export default function SentinelSecurityPage() {
  const [events,setEvents]=useState<Event[]>([]);
  const [collectors,setCollectors]=useState<Collector[]>([]);
  const [state,setState]=useState<"loading"|"connected"|"unavailable">("loading");
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    try{
      const [a,b]=await Promise.all([
        fetch("/api/admin/sentinel/events",{cache:"no-store",credentials:"same-origin"}),
        fetch("/api/admin/sentinel/collectors",{cache:"no-store",credentials:"same-origin"})
      ]);
      if(!a.ok||!b.ok){setState("unavailable");setError(a.status===401||a.status===403?"Platform Owner access required.":"Sentinel database or authentication unavailable.");return;}
      const ev=await a.json(),co=await b.json();
      setEvents(ev.events ?? []);setCollectors(co.collectors ?? []);
      setError("");setState("connected");
    }catch{setState("unavailable");setError("Cannot reach Sentinel security endpoints.");}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const active=collectors.filter(c=>c.enabled&&!c.revokedAt&&new Date(c.expiresAt)>new Date()).length;
  return <main className="min-h-screen bg-[#001f3f] text-white px-4 py-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-[#ffbf00]">GEM Sentinel Security Operations</h1><p className="text-slate-300">Verified incident intake and governed monitoring — authorized organizations only</p></div>
        <button onClick={()=>void refresh()} className="rounded-lg bg-[#ffbf00] px-4 py-2 font-bold text-[#001f3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Refresh status</button>
      </header>
      {state==="unavailable" && <div role="alert" className={box+" border-amber-500"}>{error} No protection is implied while services are unavailable.</div>}
      <section aria-label="Sentinel readiness" className="grid gap-4 md:grid-cols-3">
        <div className={box}><p className="text-slate-300">Collector status</p><p className="text-2xl font-semibold">{state==="connected"?active:"Not verified"}</p><p className="text-sm text-slate-400">Enabled, unrevoked and unexpired collectors</p></div>
        <div className={box}><p className="text-slate-300">Persisted security events</p><p className="text-2xl font-semibold">{state==="connected"?events.length:"Not connected"}</p><p className="text-sm text-slate-400">Most recent 100 records, not a total count</p></div>
        <div className={box}><p className="text-slate-300">Service state</p><p className="text-xl font-semibold">{state==="connected"?"Incident records accessible":state==="loading"?"Checking…":"Unavailable"}</p><p className="text-sm text-slate-400">Collector enrollment and detection coverage require separate proof</p></div>
      </section>
      <section className={box}><h2 className="mb-3 text-xl font-semibold">Registered collectors</h2>
        {state==="connected" && collectors.length===0?<p className="text-slate-400">No collectors registered. No devices are protected by this service.</p>:null}
        <ul className="space-y-2">{collectors.map(c=><li key={c.id} className="rounded border border-slate-700 p-3"><b>{c.label}</b> — {c.source} — Organization {c.tenantId}<span className="ml-3 text-amber-300">{c.enabled&&!c.revokedAt?"Enabled (verify sensor coverage)":"Disabled"}</span></li>)}</ul>
      </section>
      <section className={box}><h2 className="mb-3 text-xl font-semibold">Verified incident records</h2>
        {state==="connected" && events.length===0?<p className="text-slate-400">No persisted incidents available. This does not mean the environment is free of threats.</p>:null}
        <ul className="space-y-3">{events.map(e=><li key={e.id} className="rounded border border-slate-700 p-4"><div className="flex flex-wrap justify-between gap-2"><b>{e.title}</b><span className="text-amber-300">{e.severity.toUpperCase()} · {e.state}</span></div><p className="text-sm text-slate-300">Organization: {e.tenantId} · Source: {e.source} · Event: {e.sourceEventId}</p><p className="mt-1 text-sm">{e.description || "No supplementary description supplied."}</p><p className="mt-2 text-xs text-slate-400">{new Date(e.occurredAt).toLocaleString()} {e.requiresReview?"· Operator review required":""}</p></li>)}</ul>
      </section>
      <p className="text-sm text-slate-400">Operational evidence only. Automated containment, financial account controls and VPN protection are not enabled by this page.</p>
    </div>
  </main>;
}
