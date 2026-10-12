"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronRight, CircleHelp,
  ClipboardCheck, Copy, ExternalLink, Fingerprint, KeyRound, LockKeyhole,
  Plus, RefreshCw, Search, ServerCog, Settings2, ShieldAlert, ShieldCheck,
  ShieldOff, X,
} from "lucide-react";

type SecurityEvent = {
  id:string; tenantId:string; source:string; sourceEventId:string;
  severity:string; title:string; description:string; occurredAt:string;
  state:string; requiresReview:boolean;
};
type Collector = {
  id:string; tenantId:string; source:string; label:string;
  consentReference:string; consentVerifiedAt:string|null;
  enabled:boolean; revokedAt:string|null; expiresAt:string;
};
type View = "overview"|"connections"|"incidents";
type LoadState = "loading"|"connected"|"restricted"|"unavailable";
type Source = "wazuh"|"suricata"|"osquery"|"prowler"|"trivy"|"gem";
const sources: Source[] = ["wazuh","suricata","osquery","prowler","trivy","gem"];
const panel = "rounded-[1.35rem] border border-white/15 bg-[#0a2948] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.14)] sm:p-6";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffbf00]";
const inputStyle = "mt-2 min-h-12 w-full rounded-xl border border-white/25 bg-[#031a31] px-4 text-base text-white placeholder:text-slate-400 " + focus;
const buttonBase = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition " + focus;
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}
function statusForCollector(c:Collector) {
  if (c.revokedAt) return "Revoked";
  if (new Date(c.expiresAt) <= new Date()) return "Expired";
  if (!c.enabled) return "Inactive";
  return "Enabled — sensor unverified";
}
function eventColor(severity:string) {
  if (severity==="critical" || severity==="high") return "border-rose-400/50 bg-rose-400/10 text-rose-200";
  if (severity==="medium") return "border-amber-400/45 bg-amber-400/10 text-amber-200";
  return "border-slate-500 bg-slate-700/40 text-slate-200";
}
export default function SentinelSecurityPage() {
  const [view,setView] = useState<View>("overview");
  const [events,setEvents] = useState<SecurityEvent[]>([]);
  const [collectors,setCollectors] = useState<Collector[]>([]);
  const [state,setState] = useState<LoadState>("loading");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [query,setQuery] = useState("");
  const [severityFilter,setSeverityFilter] = useState("all");
  const [tenantId,setTenantId] = useState("");
  const [source,setSource] = useState<Source>("wazuh");
  const [label,setLabel] = useState("");
  const [consentReference,setConsentReference] = useState("");
  const [oneTimeKey,setOneTimeKey] = useState<string|null>(null);
  const [createdId,setCreatedId] = useState("");
  const [consentAttested,setConsentAttested] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [eventsResponse,collectorsResponse] = await Promise.all([
        fetch("/api/admin/sentinel/events",{credentials:"same-origin",cache:"no-store"}),
        fetch("/api/admin/sentinel/collectors",{credentials:"same-origin",cache:"no-store"}),
      ]);
      if (!eventsResponse.ok || !collectorsResponse.ok) {
        const restricted = [401,403].includes(eventsResponse.status) || [401,403].includes(collectorsResponse.status);
        setState(restricted?"restricted":"unavailable");
        setMessage(restricted
          ? "This workspace requires an authenticated Platform Owner account. Access has not been relaxed."
          : "Sentinel incident storage or authentication is unavailable. No live monitoring is confirmed.");
        setEvents([]);
        setCollectors([]);
        return;
      }
      const [eventsData,collectorsData] = await Promise.all([eventsResponse.json(),collectorsResponse.json()]);
      setEvents(Array.isArray(eventsData.events)?eventsData.events:[]);
      setCollectors(Array.isArray(collectorsData.collectors)?collectorsData.collectors:[]);
      setState("connected");
      setMessage("");
    } catch {
      setState("unavailable");
      setMessage("Unable to contact the Sentinel services. Check your login and database connection.");
      setEvents([]);
      setCollectors([]);
    }
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const enabled = collectors.filter(c=>c.enabled&&!c.revokedAt&&new Date(c.expiresAt)>new Date()).length;
  const highPriority = events.filter(e=>e.severity==="high" || e.severity==="critical").length;
  const filteredEvents = useMemo(()=>events.filter(e=>{
    const text=(e.title+" "+e.tenantId+" "+e.source+" "+e.sourceEventId).toLowerCase();
    return text.includes(query.toLowerCase().trim()) && (severityFilter==="all" || e.severity===severityFilter);
  }),[events,query,severityFilter]);

  async function registerCollector(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId.trim() || !label.trim() || !consentReference.trim()) return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/admin/sentinel/collectors",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({tenantId:tenantId.trim(),source,label:label.trim(),consentReference:consentReference.trim()}),
      });
      const data=await response.json();
      if (!response.ok) throw new Error(typeof data.error==="string"?data.error:"Registration failed");
      setOneTimeKey(data.collectorKey);
      setCreatedId(data.id);
      setTenantId("");setLabel("");setConsentReference("");setConsentAttested(false);
      await refresh();
      setMessage("Collector registered but disabled. Save its key securely and verify client consent before activation.");
    } catch (error) {
      setMessage(error instanceof Error?error.message:"Collector registration failed.");
    } finally {setBusy(false);}
  }
  async function activateCollector(c:Collector) {
    if (!consentAttested || !c.consentReference) {
      setMessage("First confirm that written customer consent has been independently verified.");
      return;
    }
    if (!window.confirm("Activate "+c.label+"? Confirm that the consent reference is independently verified, the exact asset is authorized, and credentials are safely installed.")) return;
    await changeCollector(c,"activate");
  }
  async function changeCollector(c:Collector,action:"activate"|"revoke") {
    if (action==="revoke"&&!window.confirm("Permanently revoke "+c.label+"? The collector will stop accepting new alerts.")) return;
    setBusy(true);setMessage("");
    try {
      const body=action==="activate"
        ? {action,id:c.id,consentReference:c.consentReference,consentConfirmed:true}
        : {action,id:c.id};
      const response=await fetch("/api/admin/sentinel/collectors",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body),
      });
      const data=await response.json();
      if (!response.ok) throw new Error(typeof data.error==="string"?data.error:"Collector update failed");
      setConsentAttested(false);
      await refresh();
      setMessage(action==="activate"?"Collector enabled. Monitoring still requires a connected, verified sensor.":"Collector revoked.");
    } catch (error) {
      setMessage(error instanceof Error?error.message:"Collector update failed.");
    } finally {setBusy(false);}
  }
  async function copyKey() {
    if (!oneTimeKey) return;
    try {await navigator.clipboard.writeText(oneTimeKey);setMessage("Key copied. Store it in a trusted local secret manager, never in chat or source code.");}
    catch {setMessage("Copy unavailable. Use a trusted device and secure storage to save the one-time key.");}
  }

  const isOnline=state==="connected";
  return (
    <main className="min-h-screen rounded-3xl bg-[#001f3f] p-3 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-[#ffbf00]/35 bg-[radial-gradient(ellipse_at_top_right,rgba(255,191,0,0.2),transparent_52%),linear-gradient(135deg,#10395f_0%,#001f3f_75%)] p-6 sm:p-8 lg:p-10">
          <div className="relative z-10 flex flex-col items-start gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ffbf00]/50 bg-[#ffbf00]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#ffe3a0]">
                <ShieldCheck size={16} aria-hidden="true"/> GEM Security Command Center
              </p>
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                GEM <span className="text-[#ffbf00]">Sentinel.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                Manage security connections, review real incidents, and see exactly what is ready to protect.
              </p>
              <p className="mt-3 text-sm font-semibold text-[#ffe3a0]">For authorized Platform Owners · No paid subscription required</p>
            </div>
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 lg:grid-cols-1">
              <button onClick={()=>{setView("connections");document.getElementById("sentinel-content")?.scrollIntoView?.({behavior:"smooth"});}}
                className={buttonBase+" bg-[#ffbf00] text-[#001f3f] hover:bg-[#ffe09b]"}>
                <Plus size={20} aria-hidden="true"/> Set up protection <ArrowRight size={18} aria-hidden="true"/>
              </button>
              <button disabled={busy} onClick={()=>void refresh()} className={buttonBase+" border border-white/40 bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"}>
                <RefreshCw size={18} aria-hidden="true"/> Refresh live status
              </button>
            </div>
          </div>
        </header>

        <section aria-label="Current operating status" className="grid gap-3 sm:grid-cols-3">
          <div className={panel}>
            <div className="flex items-center gap-2 text-sm font-bold text-[#ffd56e]"><ServerCog size={19} aria-hidden="true"/> Database connection</div>
            <p className="mt-3 text-2xl font-black sm:text-3xl" aria-live="polite">{state==="loading"?"Checking...":isOnline?"Accessible":state==="restricted"?"Restricted":"Unavailable"}</p>
            <p className="mt-2 text-sm text-slate-300">Only confirms Sentinel API and incident storage access.</p>
          </div>
          <div className={panel}>
            <div className="flex items-center gap-2 text-sm font-bold text-[#ffd56e]"><Activity size={19} aria-hidden="true"/> Enabled connections</div>
            <p className="mt-3 text-4xl font-black" aria-live="polite">{isOnline?enabled:"—"}</p>
            <p className="mt-2 text-sm text-slate-300">An enabled connection does not prove device protection.</p>
          </div>
          <div className={panel}>
            <div className="flex items-center gap-2 text-sm font-bold text-[#ffd56e]"><ShieldAlert size={19} aria-hidden="true"/> High-priority records</div>
            <p className="mt-3 text-4xl font-black" aria-live="polite">{isOnline?highPriority:"—"}</p>
            <p className="mt-2 text-sm text-slate-300">Within the latest {isOnline?events.length:0} retrieved records, not all-time incidents.</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4" role="status" aria-live="polite">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-200" aria-hidden="true"/>
          <p className="flex-1 text-sm font-medium leading-6 text-amber-50">
            <strong>Protection status: Not yet verified.</strong> {isOnline
              ? "The security database responds, but connected device coverage and alert delivery must be tested separately."
              : "Live protection is not confirmed. The security database or authorized owner session must be available first."}
          </p>
          {state==="restricted"?<Link href="/login" className="font-bold text-[#ffbf00] underline underline-offset-4">Sign in <ExternalLink size={14} className="inline"/></Link>:null}
        </div>
        {message?<div role="alert" className="rounded-xl border border-cyan-200/40 bg-cyan-200/10 p-4 text-sm leading-6 text-white">{message}</div>:null}

        <nav aria-label="Sentinel workspace" className="grid grid-cols-3 gap-2 rounded-2xl border border-white/15 bg-[#082846] p-2" id="sentinel-content">
          {([
            ["overview","Overview",Activity],["connections","Connections",Settings2],["incidents","Incidents",ShieldAlert],
          ] as const).map(([id,title,Icon])=><button key={id} type="button" aria-current={view===id?"page":undefined}
            onClick={()=>setView(id)} className={"flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-bold sm:text-base "+focus+
              (view===id?" bg-[#ffbf00] text-[#001f3f]":" bg-white/[0.04] text-white hover:bg-white/15")}>
            <Icon size={18} aria-hidden="true"/><span>{title}</span></button>)}
        </nav>

        {view==="overview"?<div className="grid gap-4 lg:grid-cols-5">
          <section className={panel+" lg:col-span-3"} aria-labelledby="welcome-title">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-[#ffbf00]/20 p-3 text-[#ffbf00]"><ClipboardCheck size={27}/></span>
              <div><p className="text-xs font-black uppercase tracking-wider text-[#ffd56e]">Start here</p><h2 id="welcome-title" className="text-2xl font-black sm:text-3xl">Three steps to get started</h2></div>
            </div>
            <ol className="mt-6 space-y-5">
              {[
                ["Confirm access","Sign in as the Platform Owner and connect approved GEM data storage."],
                ["Register an authorized sensor","Add a collector for a real organization and keep the issued key securely."],
                ["Verify before activating","Review written consent, activate deliberately, then test one real lab alert."],
              ].map(([name,desc],i)=><li key={name} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffbf00] text-xl font-black text-[#001f3f]">{i+1}</span><div><p className="text-lg font-extrabold">{name}</p><p className="mt-1 text-sm leading-6 text-slate-300">{desc}</p></div></li>)}
            </ol>
            <button onClick={()=>setView("connections")} className={buttonBase+" mt-7 w-full bg-[#ffbf00] text-[#001f3f] sm:w-auto"}>Open connection setup <ChevronRight size={18}/></button>
          </section>
          <section className={panel+" lg:col-span-2"} aria-labelledby="quick-title">
            <h2 id="quick-title" className="text-2xl font-black">Quick access</h2>
            <p className="mt-2 text-sm text-slate-300">Move between GEM security services without losing your place.</p>
            <div className="mt-5 space-y-3">
              <Link className={buttonBase+" w-full justify-between border border-[#ffbf00]/60 bg-[#ffbf00]/10 text-[#ffbf00] hover:bg-[#ffbf00]/20"} href="/app/admin/sentinel/readiness">Check Database Connection <ArrowRight size={17}/></Link>
              <Link className={buttonBase+" w-full justify-between bg-[#ffbf00] text-[#001f3f] hover:bg-[#ffe09b]"} href="/app/admin/sentinel/organizations">Authorize organizations <ArrowRight size={17}/></Link>
              <Link className={buttonBase+" w-full justify-between border border-white/25 bg-white/10 text-white hover:bg-white/20"} href="/app/admin">Admin Center <ArrowRight size={17}/></Link>
              <Link className={buttonBase+" w-full justify-between border border-white/25 bg-white/10 text-white hover:bg-white/20"} href="/app/command-center">Command Center <ArrowRight size={17}/></Link>
              <Link className={buttonBase+" w-full justify-between border border-white/25 bg-white/10 text-white hover:bg-white/20"} href="/intel">Sentinel Intelligence <ArrowRight size={17}/></Link>
              <Link className={buttonBase+" w-full justify-between border border-white/25 bg-white/10 text-white hover:bg-white/20"} href="/app/admin/audit">Audit evidence <ArrowRight size={17}/></Link>
            </div>
            <p className="mt-5 flex gap-2 rounded-xl bg-white/5 p-3 text-sm leading-6 text-slate-300"><LockKeyhole className="mt-1 shrink-0" size={17}/> Pages retain their own role and permission checks.</p>
          </section>
        </div>:null}

        {view==="connections"?<div className="grid gap-4 xl:grid-cols-5">
          <section className={panel+" xl:col-span-2"} aria-labelledby="register-title">
            <p className="text-xs font-black uppercase tracking-wider text-[#ffd56e]">Step 1 · Registration</p>
            <h2 id="register-title" className="mt-2 text-2xl font-black">Add a security connection</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Only register a sensor for an organization with a signed agreement. New connections start disabled.</p>
            <Link href="/app/admin/sentinel/organizations" className="mt-3 inline-flex min-h-11 items-center gap-2 font-bold text-[#ffbf00] underline underline-offset-4">First, approve the organization <ArrowRight size={17}/></Link>
            <form onSubmit={e=>void registerCollector(e)} className="mt-5 space-y-4">
              <label className="block text-sm font-bold">Organization ID
                <input className={inputStyle} autoComplete="off" required minLength={3} maxLength={128} pattern="[A-Za-z0-9_-]{3,128}"
                  placeholder="Existing GEM organization" value={tenantId} onChange={e=>setTenantId(e.target.value)}/>
              </label>
              <label className="block text-sm font-bold">Security technology
                <select className={inputStyle} value={source} onChange={e=>setSource(e.target.value as Source)}>
                  {sources.map(s=><option value={s} key={s}>{s.toUpperCase()}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold">Connection name
                <input className={inputStyle} required minLength={3} maxLength={100} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Authorized Wazuh lab sensor"/>
              </label>
              <label className="block text-sm font-bold">Signed consent reference
                <input className={inputStyle} required minLength={12} maxLength={160} value={consentReference} onChange={e=>setConsentReference(e.target.value)}
                  placeholder="Reference held in your approved records"/>
              </label>
              <button className={buttonBase+" w-full bg-[#ffbf00] text-[#001f3f] disabled:opacity-50"} disabled={!isOnline||busy} type="submit"><Plus size={18}/> {busy?"Processing…":"Register disabled connection"}</button>
              {!isOnline?<p className="text-sm text-amber-200">Registration is disabled until the owner session and database are available.</p>:null}
            </form>
          </section>
          <section className={panel+" xl:col-span-3"} aria-labelledby="collector-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wider text-[#ffd56e]">Step 2 · Control access</p><h2 id="collector-title" className="mt-2 text-2xl font-black">Registered connections</h2></div>
              <span className="rounded-full border border-white/30 px-3 py-1 text-sm font-bold">{isOnline?collectors.length:"Not connected"} listed</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">Confirm real customer consent before enabling any collector. Enabled does not mean a sensor is sending alerts.</p>
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200/30 bg-amber-200/10 p-4 text-sm leading-6">
              <input type="checkbox" checked={consentAttested} onChange={e=>setConsentAttested(e.target.checked)} className="mt-1 h-5 w-5 accent-[#ffbf00]"/>
              <span>I independently reviewed written consent and the exact authorized device or network scope.</span>
            </label>
            <div className="mt-5 space-y-3">
              {isOnline&&collectors.length===0?<div className="rounded-xl border border-dashed border-white/25 p-7 text-center"><ServerCog className="mx-auto mb-3 text-[#ffbf00]" size={30}/><p className="font-bold">No connections registered</p><p className="mt-1 text-sm text-slate-300">Use the form to register your first authorized collector.</p></div>:null}
              {collectors.map(c=><article key={c.id} className="rounded-xl border border-white/20 bg-[#031e37] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-extrabold">{c.label}</h3><p className="text-xs text-slate-300">{c.source.toUpperCase()} · {c.tenantId}</p></div>
                  <span className="rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-xs font-bold text-amber-100">{statusForCollector(c)}</span>
                </div>
                <p className="mt-3 break-words text-xs text-slate-300">Consent reference: {c.consentReference}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!c.revokedAt&&!c.enabled&&new Date(c.expiresAt)>new Date()?
                    <button disabled={busy||!consentAttested} onClick={()=>void activateCollector(c)}
                      className={buttonBase+" bg-[#ffbf00] text-[#001f3f] disabled:cursor-not-allowed disabled:opacity-40"}><Check size={17}/> Activate after verification</button>:null}
                  {!c.revokedAt?<button disabled={busy} onClick={()=>void changeCollector(c,"revoke")} className={buttonBase+" border border-rose-300/55 text-rose-200 hover:bg-rose-300/10 disabled:opacity-50"}><ShieldOff size={17}/> Revoke</button>:null}
                </div>
              </article>)}
            </div>
            <div className="mt-6 rounded-xl border border-white/15 bg-white/[0.04] p-4">
              <h3 className="flex items-center gap-2 font-black"><CircleHelp size={18} className="text-[#ffbf00]"/> Next after registration</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Install an authorized sensor, save its one-time credential securely, verify its alert delivery, and review incidents here. The dashboard never installs software onto a client device automatically.</p>
            </div>
          </section>
        </div>:null}

        {view==="incidents"?<section className={panel} aria-labelledby="incidents-title">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div><p className="text-xs font-black uppercase tracking-wider text-[#ffd56e]">Evidence, not estimates</p><h2 id="incidents-title" className="mt-2 text-2xl font-black sm:text-3xl">Security incidents</h2>
              <p className="mt-2 text-sm text-slate-300">Only the latest 100 stored incident records. No results is not proof of safety.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative"><span className="sr-only">Search incidents</span><Search size={18} className="pointer-events-none absolute left-4 top-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="Find organization or event" className="min-h-12 w-full rounded-xl border border-white/25 bg-[#031a31] py-3 pl-11 pr-3 text-base text-white sm:w-64"/></label>
              <label><span className="sr-only">Filter severity</span><select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/25 bg-[#031a31] px-3 text-base text-white sm:w-44">
                {["all","critical","high","medium","low","informational"].map(s=><option key={s} value={s}>{s==="all"?"All severities":s}</option>)}
              </select></label>
            </div>
          </div>
          {isOnline&&filteredEvents.length===0?<div className="mt-6 rounded-xl border border-dashed border-white/25 p-7 text-center"><ShieldCheck className="mx-auto mb-3 text-[#ffbf00]" size={32}/>
            <p className="font-bold">No matching stored incidents</p><p className="mt-2 text-sm text-slate-300">Confirm your collector is sending real events before interpreting an empty list.</p></div>:null}
          <ul className="mt-5 space-y-3">{filteredEvents.map(e=><li key={e.id} className="rounded-xl border border-white/15 bg-[#031e37] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-lg font-extrabold">{e.title}</h3><span className={"rounded-full border px-3 py-1 text-xs font-black uppercase "+eventColor(e.severity)}>{e.severity}</span></div>
            <p className="mt-2 text-sm text-slate-200">{e.description||"No additional description available."}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300"><span>Organization: {e.tenantId}</span><span>Source: {e.source}</span><span>Event: {e.sourceEventId}</span><span>{formatDate(e.occurredAt)}</span></div>
            {e.requiresReview?<p className="mt-3 text-sm font-bold text-amber-200"><AlertTriangle size={15} className="mr-1 inline"/> Operator review required</p>:null}
          </li>)}</ul>
          {!isOnline?<p className="mt-5 text-sm text-amber-200">Incident data is unavailable until access and persistence are verified.</p>:null}
        </section>:null}

        <footer className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300">
          <p className="flex items-center gap-2 font-bold text-white"><Fingerprint size={19} className="text-[#ffbf00]"/> Controlled access is part of the protection.</p>
          <p className="mt-2">This page does not claim active VPN protection, bank-account controls, deployed Wazuh sensors, or automated containment. All live safeguards require real integrations, authorized customer scope and measured acceptance testing.</p>
          <div className="mt-4 flex flex-wrap gap-4"><Link href="/app/command-center" className="font-bold text-[#ffbf00] underline underline-offset-4">Command Center</Link><Link href="/app/admin" className="font-bold text-[#ffbf00] underline underline-offset-4">Admin Center</Link><Link href="/app/support" className="font-bold text-[#ffbf00] underline underline-offset-4">Support</Link></div>
        </footer>
      </div>
      {oneTimeKey?<div role="presentation" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="collector-key-title" className="w-full max-w-lg rounded-2xl border border-[#ffbf00]/50 bg-[#072846] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><KeyRound size={30} className="text-[#ffbf00]"/><h2 id="collector-key-title" className="mt-3 text-2xl font-black">Save your collector key</h2></div>
            <button aria-label="Close one-time key" onClick={()=>{setOneTimeKey(null);setCreatedId("");}} className={"rounded-lg border border-white/30 p-2 "+focus}><X size={20}/></button></div>
          <p className="mt-3 text-sm leading-6 text-amber-100">This credential is shown only once and will not be returned by the API again. Store it in a trusted secret manager. Do not paste it in chat, email, Telegram or GitHub.</p>
          <p className="mt-3 break-all rounded-xl border border-white/20 bg-[#00172d] p-4 font-mono text-sm select-all">{oneTimeKey}</p>
          <p className="mt-2 break-all text-xs text-slate-300">Collector ID: {createdId}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={()=>void copyKey()} className={buttonBase+" flex-1 bg-[#ffbf00] text-[#001f3f]"}><Copy size={17}/> Copy securely</button>
            <button onClick={()=>{setOneTimeKey(null);setCreatedId("");}} className={buttonBase+" flex-1 border border-white/35 text-white"}>I saved the key</button>
          </div>
        </section>
      </div>:null}
    </main>
  );
}
