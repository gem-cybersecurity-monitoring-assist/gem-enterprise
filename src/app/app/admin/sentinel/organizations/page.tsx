"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleHelp, LockKeyhole, Plus, RefreshCw, ShieldAlert, ShieldOff } from "lucide-react";

type Tenant = {
  id:string; name:string; consentReference:string;
  enabled:boolean; consentVerifiedAt:string|null; createdAt:string;
};
type ResponseData = {status?:string; tenants?:Tenant[]; error?:string; message?:string};
const input="mt-2 w-full min-h-12 rounded-xl border border-slate-500 bg-[#08263f] px-4 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffbf00]";
const button="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffbf00]";
export default function SentinelOrganizationsPage() {
  const [mode,setMode]=useState<"loading"|"dedicated"|"shared_mode"|"unavailable">("loading");
  const [items,setItems]=useState<Tenant[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [tenantId,setTenantId]=useState("");
  const [name,setName]=useState("");
  const [consentReference,setConsentReference]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const response=await fetch("/api/admin/sentinel/tenants",{cache:"no-store",credentials:"same-origin"});
      const data:ResponseData=await response.json();
      if(!response.ok) {
        setItems([]);setMode("unavailable");
        setError(response.status===401||response.status===403
          ?"An authenticated Platform Owner account is required."
          :data.error||"The Sentinel database is not accessible.");
        return;
      }
      setItems(data.tenants||[]);
      setMode(data.status==="dedicated"?"dedicated":"shared_mode");
      setError("");
    }catch{
      setMode("unavailable");setItems([]);
      setError("Cannot contact the Sentinel organization registry.");
    }
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function createTenant(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setError("");
    try {
      const res=await fetch("/api/admin/sentinel/tenants",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({tenantId:tenantId.trim(),name:name.trim(),consentReference:consentReference.trim()})
      });
      const data:ResponseData=await res.json();
      if(!res.ok)throw new Error(data.error||"Could not register organization");
      setTenantId("");setName("");setConsentReference("");setConfirmed(false);
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Registration failed");}
    finally{setBusy(false);}
  }
  async function action(tenant:Tenant,action:"approve"|"disable"){
    if(action==="approve"&&!confirmed){setError("Verify written consent first, then check the attestation box.");return;}
    if(!window.confirm(action==="approve"
      ?"Approve "+tenant.name+" for explicitly authorized Sentinel monitoring?"
      :"Disable "+tenant.name+" and revoke its registered collectors?"))return;
    setBusy(true);setError("");
    try {
      const body=action==="approve"
        ?{action,tenantId:tenant.id,consentReference:tenant.consentReference,consentConfirmed:true}
        :{action,tenantId:tenant.id};
      const res=await fetch("/api/admin/sentinel/tenants",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
      });
      const data:ResponseData=await res.json();
      if(!res.ok)throw new Error(data.error||"Organization action failed");
      setConfirmed(false);await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Action failed");}
    finally{setBusy(false);}
  }
  return <main className="min-h-screen rounded-3xl bg-[#001f3f] px-4 py-6 text-white sm:px-7 sm:py-9">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/app/admin/sentinel" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#ffbf00] underline-offset-4 hover:underline"><ArrowLeft size={18}/> Back to Sentinel</Link>
      <header className="rounded-3xl border border-[#ffbf00]/40 bg-[#092f51] p-6 sm:p-8">
        <p className="text-sm font-black uppercase tracking-widest text-[#ffbf00]">GEM Sentinel · Step 1</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">Authorize organizations</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
          Register the organization first. Keep it disabled until signed consent and monitoring scope are independently verified by the Platform Owner.
        </p>
      </header>
      {error?<div role="alert" className="rounded-xl border border-amber-400 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</div>:null}
      {mode==="shared_mode"?<div role="status" className="rounded-xl border border-slate-400 p-4 text-slate-200">Standalone organization management requires a dedicated Sentinel database. Your existing GEM organization controls remain unchanged in shared mode.</div>:null}
      {mode==="unavailable"?<div role="status" className="rounded-xl border border-amber-400/50 p-4 text-amber-100">No database connection is verified. Registration remains unavailable.</div>:null}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="rounded-3xl border border-white/20 bg-[#092b4a] p-5 sm:p-7 lg:col-span-2">
          <div className="flex items-center gap-3"><Plus size={23} className="text-[#ffbf00]"/><h2 className="text-2xl font-black">Register organization</h2></div>
          <form className="mt-5 space-y-4" onSubmit={e=>void createTenant(e)}>
            <label className="block text-sm font-bold">Organization ID
              <input required value={tenantId} onChange={e=>setTenantId(e.target.value)} className={input} pattern="[A-Za-z0-9_-]{3,128}" minLength={3} maxLength={128} placeholder="Existing authorized customer ID"/>
            </label>
            <label className="block text-sm font-bold">Organization name
              <input required value={name} onChange={e=>setName(e.target.value)} className={input} minLength={3} maxLength={100} placeholder="Legal organization name"/>
            </label>
            <label className="block text-sm font-bold">Signed consent reference
              <input required value={consentReference} onChange={e=>setConsentReference(e.target.value)} className={input} minLength={12} maxLength={160} placeholder="Reference to reviewed agreement"/>
            </label>
            <button disabled={mode!=="dedicated"||busy} type="submit" className={button+" w-full bg-[#ffbf00] text-[#001f3f] disabled:opacity-45"}><Plus size={18}/> Register disabled</button>
          </form>
          <div className="mt-5 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
            <LockKeyhole size={18} className="mt-1 shrink-0 text-[#ffbf00]"/> An organization record alone never activates device monitoring.
          </div>
        </section>
        <section className="rounded-3xl border border-white/20 bg-[#092b4a] p-5 sm:p-7 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div>
            <p className="text-xs font-black uppercase tracking-widest text-[#ffbf00]">Step 2 · Review authorization</p>
            <h2 className="mt-2 text-2xl font-black">Organization registry</h2>
          </div><button onClick={()=>void refresh()} className={button+" border border-white/30 bg-white/5"}><RefreshCw size={17}/> Refresh</button></div>
          <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#ffbf00]/35 bg-[#ffbf00]/10 p-4 text-sm leading-6">
            <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 accent-[#ffbf00]"/>
            <span>I have independently verified the signed consent, permitted assets, and retention scope for the organization I will approve.</span>
          </label>
          <div className="mt-5 space-y-3">
            {mode==="loading"?<p role="status" className="text-slate-200">Checking authorized organizations…</p>:null}
            {mode==="dedicated"&&items.length===0?<p className="rounded-xl border border-dashed border-white/25 p-5 text-slate-300">No organizations have been registered. No security coverage is implied.</p>:null}
            {items.map(t=><article key={t.id} className="rounded-xl border border-white/20 bg-[#051d33] p-4">
              <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-bold">{t.name}</h3><p className="text-xs text-slate-300">{t.id}</p></div>
                <span className={"h-fit rounded-full border px-3 py-1 text-xs font-bold "+(t.enabled?"border-emerald-400/50 text-emerald-200":"border-amber-400/50 text-amber-200")}>{t.enabled?"Approved — no device claim":"Disabled"}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">Consent reference: {t.consentReference}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {!t.enabled?<button disabled={busy||!confirmed} onClick={()=>void action(t,"approve")} className={button+" bg-[#ffbf00] text-[#001f3f] disabled:opacity-40"}><CheckCircle2 size={18}/> Approve consent</button>:null}
                {t.enabled?<button disabled={busy} onClick={()=>void action(t,"disable")} className={button+" border border-rose-400/60 text-rose-200 disabled:opacity-40"}><ShieldOff size={18}/> Disable & revoke</button>:null}
              </div>
            </article>)}
          </div>
          <p className="mt-5 flex gap-2 text-sm text-slate-300"><CircleHelp size={18} className="shrink-0 text-[#ffbf00]"/> After authorization, return to Sentinel Connections to register the sensor using the same organization ID and consent reference.</p>
        </section>
      </div>
      <footer className="rounded-xl border border-white/15 p-4 text-sm leading-6 text-slate-300"><ShieldAlert size={18} className="mr-2 inline text-[#ffbf00]"/> Platform Owner only. This procedure does not bypass customer consent, real device enrollment, or secure API authorization. No paid service is required by the application code.</footer>
    </div>
  </main>;
}
