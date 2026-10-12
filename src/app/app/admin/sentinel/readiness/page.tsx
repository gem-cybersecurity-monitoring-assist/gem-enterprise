"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, RefreshCw, ShieldCheck } from "lucide-react";

type Readiness = {
  databaseStatus:string;
  storageMode?:string;
  schemaReady?:boolean;
  tablesFound?:number;
  expectedTables?:number;
  missingTables?:string[];
  insecureTables?:string[];
  liveProtectionVerified?:boolean;
  message?:string;
};
export default function SentinelReadinessPage() {
  const [result,setResult]=useState<Readiness|null>(null);
  const [loading,setLoading]=useState(true);
  const verify=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/admin/sentinel/readiness",{cache:"no-store",credentials:"same-origin"});
      const value:Readiness=await response.json();
      setResult(!response.ok&&response.status===401?
        {databaseStatus:"OWNER_SESSION_REQUIRED",message:"Sign in with an approved GEM Platform Owner account."}
        :value);
    } catch {setResult({databaseStatus:"CONNECTION_UNAVAILABLE",message:"Unable to reach the GEM Sentinel readiness service."});}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void verify();},[verify]);
  const ready=result?.databaseStatus==="SCHEMA_READY_FOR_LAB";
  return <main className="min-h-screen bg-[#001f3f] p-4 text-white sm:p-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/sentinel" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#ffbf00] underline-offset-4 hover:underline"><ArrowLeft size={18}/> Back to Sentinel</Link>
      <header className="rounded-3xl border border-[#ffbf00]/40 bg-[#0b3456] p-6 sm:p-9">
        <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#ffbf00]"><ShieldCheck size={19}/> Controlled security readiness</p>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">Database connection</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">This checks your GEM application’s private Sentinel database connection and table security. It does not claim that any device is currently protected.</p>
      </header>
      <section aria-live="polite" className="rounded-2xl border border-white/20 bg-[#092b49] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Database size={30} className="text-[#ffbf00]"/><h2 className="text-2xl font-bold">Connection verification</h2></div>
          <button type="button" onClick={()=>void verify()} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#ffbf00] px-5 py-3 font-bold text-[#001f3f] disabled:opacity-50"><RefreshCw size={17}/> Recheck</button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {ready?<CheckCircle2 size={26} className="text-emerald-300"/>:<AlertTriangle size={26} className="text-amber-300"/>}
          <p className="break-all text-xl font-black">{loading?"Checking…":result?.databaseStatus??"UNKNOWN"}</p>
        </div>
        {result?.message?<p className="mt-4 leading-7 text-slate-200">{result.message}</p>:null}
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/15 bg-[#001b33] p-4"><dt className="text-sm text-slate-300">Private tables verified</dt><dd className="mt-2 text-2xl font-black">{ready?result?.tablesFound+" / "+result?.expectedTables:"Not verified"}</dd></div>
          <div className="rounded-xl border border-white/15 bg-[#001b33] p-4"><dt className="text-sm text-slate-300">Live device protection</dt><dd className="mt-2 text-xl font-black text-amber-200">Not verified</dd></div>
        </dl>
        {!!result?.missingTables?.length&&<p className="mt-4 text-sm text-amber-200">Missing database tables: {result.missingTables.join(", ")}</p>}
        {!!result?.insecureTables?.length&&<p className="mt-4 text-sm text-rose-200">Database permissions require review for: {result.insecureTables.join(", ")}</p>}
      </section>
      <section className="rounded-2xl border border-white/20 bg-[#092b49] p-6">
        <h2 className="text-2xl font-black">What this means</h2>
        <p className="mt-3 text-slate-200">A green database check means only that the server can read the expected private schema safely. Real security monitoring additionally requires authorized organizations, a working collector key, connected sensors and end-to-end alert tests.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href="/app/admin/sentinel/organizations" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ffbf00] px-5 py-3 font-bold text-[#001f3f]">Authorize organizations</Link>
          <a href="https://supabase.com/dashboard/project/thhbviealrttyqyagqnu" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-5 py-3 font-bold">View private Supabase project</a>
        </div>
      </section>
    </div>
  </main>;
}
