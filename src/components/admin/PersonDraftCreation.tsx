"use client";

import { useState } from "react";
import { Save, ShieldCheck, X } from "lucide-react";

const DIVISIONS=["Executive","Cybersecurity","Operations","Real Estate","Finance","Support","AI Governance"] as const;

export function PersonDraftCreation({
 onCreated,onCancel,
}:{onCreated:(id:string)=>Promise<void>;onCancel:()=>void}) {
 const [form,setForm]=useState({
   name:"",role:"",division:"Cybersecurity" as typeof DIVISIONS[number],
   type:"Human" as "Human"|"Function",publicBio:"",reason:"",
 });
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function create(){
   setError("");
   setBusy(true);
   try{
     const result=await fetch("/api/admin/personnel-registry",{
       method:"POST",credentials:"same-origin",
       headers:{"Content-Type":"application/json"},body:JSON.stringify(form),
     });
     const payload=await result.json().catch(()=>({error:"Unreadable server response"}));
     if(!result.ok||!payload.record?.id)
       throw new Error(payload.error??"The unpublished record could not be created");
     await onCreated(payload.record.id);
   }catch(err){
     setError(err instanceof Error?err.message:"Could not create registry record");
   }finally{setBusy(false);}
 }
 const canSave=form.name.trim().length>=3&&form.role.trim().length>=3&&form.reason.trim().length>=10;
 return <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1929] p-5 sm:p-7">
   <div className="flex items-center justify-between gap-3">
     <div><h2 className="text-2xl font-bold text-white">New personnel record</h2>
       <p className="mt-2 text-sm leading-7 text-slate-300">Create an unpublished draft in the authoritative Notion directory. The entry remains hidden and unverified until separate review and authorization.</p></div>
     <button type="button" onClick={onCancel} disabled={busy} aria-label="Close new record form" className="rounded-lg border border-white/15 p-2 text-slate-300 disabled:opacity-50"><X className="h-5 w-5"/></button>
   </div>
   <div className="grid gap-4 md:grid-cols-2">
     <label className="block text-sm text-slate-300">Official record name
       <input required value={form.name} maxLength={150} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white" placeholder="Full name or authorized function name"/></label>
     <label className="block text-sm text-slate-300">Public role (draft)
       <input required value={form.role} maxLength={200} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white" placeholder="Accurate, evidence-backed position"/></label>
     <label className="block text-sm text-slate-300">Division
       <select value={form.division} onChange={e=>setForm(f=>({...f,division:e.target.value as typeof DIVISIONS[number]}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white">{DIVISIONS.map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="block text-sm text-slate-300">Record classification
       <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as "Human"|"Function"}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white"><option value="Human">Human</option><option value="Function">Organizational function</option></select></label>
   </div>
   <label className="block text-sm text-slate-300">Public biography draft (optional)
     <textarea rows={5} value={form.publicBio} maxLength={1900} onChange={e=>setForm(f=>({...f,publicBio:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white" placeholder="Publishable facts only; omit private evidence and contact details"/></label>
   <label className="block text-sm text-slate-300">Creation reason
     <textarea rows={2} value={form.reason} maxLength={500} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#081320] p-3 text-white" placeholder="Why should this unpublished record exist? (at least 10 characters)"/></label>
   {error&&<p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-3 text-sm text-rose-200">{error}</p>}
   <p className="flex items-center gap-2 text-xs leading-6 text-amber-200"><ShieldCheck className="h-4 w-4 shrink-0"/> New entries are restricted to internal review until authorized staff verify real evidence, professional status and publication permission.</p>
   <button type="button" disabled={busy||!canSave} onClick={()=>void create()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-[#061423] disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4"/>{busy?"Creating in Notion…":"Create unpublished record"}</button>
 </section>;
}
