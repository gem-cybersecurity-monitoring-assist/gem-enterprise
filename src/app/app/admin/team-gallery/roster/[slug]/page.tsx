import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, LockKeyhole, ShieldAlert, Users } from "lucide-react";
import { getEnterpriseTeam, getRosterReference } from "@/lib/enterprise-team-catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
 title:"Roster Review Profile | GEM Enterprise",
 description:"Restricted verification and staff-reference profile.",
 robots:{index:false,follow:false,nocache:true},
};

export default async function RosterReviewProfile({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;
 const entry=getRosterReference(slug);
 if (!entry) notFound();
 const relatedTeam=getEnterpriseTeam(entry.department);
 return <main className="min-h-screen bg-[#020817] px-5 py-9 text-slate-100 sm:px-8">
   <div className="mx-auto max-w-5xl space-y-7">
     <Link href="/app/admin/team-gallery#source-roster-review" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-white"><ArrowLeft className="h-4 w-4"/> Back to roster review</Link>
     <header className="rounded-3xl border border-amber-300/25 bg-gradient-to-br from-[#282323] to-[#0c192c] p-7 sm:p-10">
       <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200"><LockKeyhole className="h-4 w-4"/> Historical source record · internal</div>
       <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">{entry.label}</h1>
       <p className="mt-3 text-base text-amber-100">{entry.title}</p>
       <p className="mt-5 text-sm leading-8 text-slate-300">{entry.notice}</p>
       <p className="mt-4 text-xs leading-6 text-slate-400">Status: {entry.status.replaceAll("-"," ")}. No staff photo or qualification is assigned from the old demo gallery.</p>
       <div className="mt-7 flex flex-wrap gap-3">
         <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-3 text-sm font-semibold text-[#171717] hover:bg-amber-100"><BookOpen className="h-4 w-4"/> Read original Notion profile <ExternalLink className="h-4 w-4"/></a>
         {relatedTeam&&<Link href={`/app/admin/team-gallery/teams/${relatedTeam.slug}`} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10">Open functional team</Link>}
       </div>
     </header>
     <section className="grid gap-5 sm:grid-cols-2">
       <div className="rounded-3xl border border-white/10 bg-[#0b192b] p-7">
         <div className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-cyan-300"/><h2>Recorded role context</h2></div>
         <p className="mt-4 text-sm leading-8 text-slate-300">The source document records this name or desk together with a proposed title. It does not independently establish that the individual currently works for GEM Enterprise, that the pictured subject matches this record, or that a professional credential has been verified.</p>
         {relatedTeam&&<p className="mt-4 text-sm leading-7 text-slate-300"><strong className="text-white">Related function:</strong> {relatedTeam.title}. {relatedTeam.summary}</p>}
       </div>
       <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[.05] p-7">
         <div className="flex items-center gap-2 text-xl font-bold"><ShieldAlert className="h-5 w-5 text-amber-200"/><h2>Verification and next actions</h2></div>
         <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
           {["Confirm the current person or service owner and affiliation","Confirm the title, role boundaries and reporting authority","Verify relevant credentials and licensure if applicable","Approve an authentic official image and usage rights","Review personnel publication approval and visibility"].map(x=><li key={x} className="flex gap-3"><span className="mt-2.5 h-3 w-3 shrink-0 rounded border border-amber-200/50"/>{x}</li>)}
         </ul>
       </div>
     </section>
     <p className="text-xs leading-7 text-slate-400">No public employee profile or status has been created. This internal page cannot bypass the existing public personnel review gates.</p>
   </div>
 </main>;
}
