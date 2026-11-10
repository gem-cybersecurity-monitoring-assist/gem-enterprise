import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, BookOpen, ShieldCheck } from "lucide-react";
import { divisions, enterpriseTeams, getDivision } from "@/lib/enterprise-team-catalog";

export const dynamic="force-dynamic";
export const metadata: Metadata = {title:"Enterprise Division Overview | GEM Enterprise",robots:{index:false,follow:false,nocache:true}};
export default async function DivisionPage({params}:{params:Promise<{division:string}>}){
 const {division:id}=await params;
 const division=getDivision(id);
 if(!division)notFound();
 const teams=enterpriseTeams.filter(t=>t.division===division.id);
 return <main className="min-h-screen bg-[#020817] px-5 py-8 text-slate-100 sm:px-8">
   <div className="mx-auto max-w-[1350px] space-y-8">
     <Link href="/app/admin/team-gallery#enterprise-functions" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-white"><ArrowLeft className="h-4 w-4"/> Back to teams gallery</Link>
     <header className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-[#102a40] to-[#071322] p-7 sm:p-11">
       <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs uppercase tracking-widest text-cyan-200"><Building2 className="h-4 w-4"/> Division / service-group overview</span>
       <h1 className="mt-5 text-3xl font-bold sm:text-5xl">{division.title}</h1>
       <p className="mt-4 text-base leading-8 text-cyan-100">{division.subtitle}</p>
       <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">{division.note} The organizational chart represents functions, not a verified staff count or active service authorization.</p>
       <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-cyan-300">{teams.length} documented or proposed functional profiles</p>
     </header>
     <section aria-labelledby="division-roles-heading">
       <h2 id="division-roles-heading" className="text-2xl font-bold">Roles, teams and responsibilities</h2>
       <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
         {teams.map(team=><article key={team.slug} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0b192b] p-6">
           <div>
             <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">{team.status==="documented"?"Function documented":team.status==="restricted"?"Restricted function":"Proposed capability"}</span>
             <h3 className="mt-4 text-lg font-bold">{team.title}</h3>
             <p className="mt-3 text-sm leading-7 text-slate-300">{team.summary}</p>
             <ul className="mt-4 space-y-2">{team.responsibilities.map(task=><li key={task} className="flex gap-2 text-xs leading-6 text-slate-400"><ShieldCheck className="mt-1 h-3 w-3 shrink-0"/>{task}</li>)}</ul>
           </div>
           <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-4">
             <Link href={`/app/admin/team-gallery/teams/${team.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-white">Full team profile <ArrowRight className="h-4 w-4"/></Link>
             <a href={team.notionDetailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"><BookOpen className="h-3.5 w-3.5"/> Source</a>
           </div>
         </article>)}
       </div>
     </section>
     <section aria-label="Division navigation" className="rounded-2xl border border-white/10 p-5">
       <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Explore other divisions</p>
       <div className="flex flex-wrap gap-2">{divisions.filter(d=>d.id!==division.id).map(d=><Link key={d.id} href={`/app/admin/team-gallery/divisions/${d.id}`} className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-200 hover:border-cyan-300/40">{d.title}</Link>)}</div>
     </section>
   </div>
 </main>;
}
