import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, FileCheck2, ImageOff, LockKeyhole, Network, ShieldCheck, Users } from "lucide-react";
import { divisions, enterpriseTeams, getEnterpriseTeam, historicalRoster } from "@/lib/enterprise-team-catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
 title: "Enterprise Team Profile | GEM Enterprise",
 robots: { index: false, follow: false, nocache: true },
 description: "Internal source-linked team profile and workflow definition.",
};

export default async function EnterpriseTeamProfile({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const team = getEnterpriseTeam(slug);
 if (!team) notFound();
 const division = divisions.find(d => d.id === team.division);
 const peers = team.collaborators.map(id=>getEnterpriseTeam(id)).filter((v): v is NonNullable<typeof v> => Boolean(v));
 const references = historicalRoster.filter(record => record.department === team.slug);
 const statusLabel = team.status === "documented" ? "Recorded function — staffing unconfirmed" : team.status === "restricted" ? "Restricted operational function" : "Proposed team / service capability";
 return (
   <main className="min-h-screen bg-[#020817] px-4 py-8 text-slate-100 sm:px-7">
     <div className="mx-auto max-w-[1360px] space-y-8">
       <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
         <Link href="/app/admin/team-gallery" className="hover:text-cyan-200">Teams Gallery</Link><span>/</span>
         <Link href={`/app/admin/team-gallery/divisions/${team.division}`} className="hover:text-cyan-200">{division?.title ?? "Enterprise teams"}</Link><span>/</span>
         <span className="text-white">{team.title}</span>
       </nav>
       <header className="rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-[#153248] via-[#0d2136] to-[#061321] p-7 sm:p-11">
         <div className="flex flex-wrap items-center gap-2">
           <span className="rounded-full border border-cyan-400/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-200">Internal · Organizational profile</span>
           <span className="rounded-full border border-amber-300/20 px-3 py-1.5 text-xs text-amber-100">{statusLabel}</span>
         </div>
         <h1 className="mt-6 max-w-5xl text-3xl font-bold leading-tight sm:text-5xl">{team.title}</h1>
         <p className="mt-4 max-w-4xl text-lg leading-8 text-cyan-100">{team.strap}</p>
         <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-300">{team.summary}</p>
         <div className="mt-7 flex flex-wrap gap-3">
           <a href={team.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-[#071421] hover:bg-cyan-300"><BookOpen className="h-4 w-4" /> Review source document</a>
           <a href={team.notionDetailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10">Notion department profile</a>
           <Link href="/app/admin/team-gallery" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> All teams</Link>
         </div>
       </header>

       <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(290px,1fr)]">
         <section className="rounded-3xl border border-white/10 bg-[#0a182a] p-6 sm:p-9">
           <div className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5 text-cyan-300" /><h2>Mission and responsibilities</h2></div>
           <p className="mt-4 text-sm leading-8 text-slate-300">This profile defines an intended enterprise function. It does not certify that the team is staffed, the described service is live, or any regulated practice is authorized.</p>
           <ol className="mt-6 space-y-4">
             {team.responsibilities.map((item,i)=> (
               <li key={item} className="flex gap-4 rounded-xl border border-white/10 bg-white/[.025] p-4">
                 <span className="font-mono text-xs font-semibold text-cyan-300">{String(i+1).padStart(2,"0")}</span>
                 <p className="text-sm leading-7 text-slate-200">{item}</p>
               </li>
             ))}
           </ol>
           <h3 className="mt-8 text-sm font-bold uppercase tracking-widest text-cyan-300">Operating deliverables</h3>
           <ul className="mt-4 space-y-3">
             {team.deliverables.map(item=><li key={item} className="flex gap-3 text-sm text-slate-300"><FileCheck2 className="mt-1 h-4 w-4 shrink-0 text-slate-500" />{item}</li>)}
           </ul>
         </section>
         <aside className="space-y-5">
           <div className="rounded-3xl border border-white/10 bg-[#0a182a] p-7">
             <div className="flex items-center gap-2 text-lg font-bold"><ImageOff className="h-5 w-5 text-cyan-300" /><h2>Team media and identity</h2></div>
             <p className="mt-4 text-sm leading-7 text-slate-300">No official departmental group photograph has been matched and approved for this team. The original role-labelled photos remain in the separate staff-media gallery and are not automatically assigned here.</p>
             <div className="mt-4 rounded-xl border border-dashed border-white/20 bg-white/[.035] px-4 py-10 text-center">
               <ImageOff className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true"/>
               <p className="mt-3 text-xs text-slate-400">Official team image pending source matching and permissions</p>
             </div>
             <Link href="/app/admin/team-gallery" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-white">Review original photographs <ArrowRight className="h-4 w-4" /></Link>
           </div>
           <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[.04] p-7">
             <div className="flex items-center gap-2 text-lg font-bold"><LockKeyhole className="h-5 w-5 text-amber-200" /><h2>Publication checks</h2></div>
             <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
               {["Confirm role ownership and current staffing","Verify any required professional licensing","Match and approve staff likenesses and image rights","Confirm service is actually offered before public claims","Approve public visibility in the existing personnel workflow"].map(x=><li key={x} className="flex gap-3"><span className="mt-2.5 h-3 w-3 shrink-0 rounded border border-amber-200/40"/>{x}</li>)}
             </ul>
           </div>
         </aside>
       </div>
       <section className="rounded-3xl border border-white/10 bg-[#0a182a] p-6 sm:p-9">
         <div className="flex items-center gap-2 text-xl font-bold"><Network className="h-5 w-5 text-cyan-300" /><h2>Cross-team collaboration</h2></div>
         <p className="mt-3 text-sm leading-7 text-slate-400">The following are proposed handoffs, not confirmed reporting lines or staffing assignments.</p>
         <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
           {peers.map(peer=><Link key={peer.slug} href={`/app/admin/team-gallery/teams/${peer.slug}`} className="group rounded-xl border border-white/10 bg-white/[.035] p-4 transition hover:border-cyan-400/40">
             <span className="text-xs font-semibold uppercase text-cyan-300">{peer.division}</span>
             <h3 className="mt-2 font-semibold text-white">{peer.title}</h3>
             <p className="mt-2 text-xs leading-6 text-slate-400">{peer.strap}</p>
             <span className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300">View team <ArrowRight className="h-3.5 w-3.5" /></span>
           </Link>)}
         </div>
       </section>
       {references.length>0 && <section className="rounded-3xl border border-amber-300/15 bg-[#1b1f2b] p-6 sm:p-8">
         <div className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-amber-200" /><h2>Related Notion roster references</h2></div>
         <p className="mt-3 text-sm leading-7 text-slate-300">These names or organizational desks appear in older Notion records. This is a review queue, not an authenticated current-staff list.</p>
         <div className="mt-5 grid gap-3 md:grid-cols-2">
           {references.map(ref=><Link key={ref.slug} href={`/app/admin/team-gallery/roster/${ref.slug}`} className="rounded-xl border border-white/10 p-4 hover:border-amber-200/40">
             <span className="text-xs uppercase tracking-wider text-amber-200">{ref.status.replaceAll("-"," ")}</span>
             <h3 className="mt-2 font-semibold">{ref.label}</h3><p className="mt-1 text-sm text-slate-400">{ref.title}</p>
           </Link>)}
         </div>
       </section>}
       <footer className="border-t border-white/10 pt-6 text-sm text-slate-400">
         <Link href="/app/admin/team-gallery" className="inline-flex items-center gap-2 text-cyan-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to enterprise gallery</Link>
       </footer>
     </div>
   </main>
 );
}
