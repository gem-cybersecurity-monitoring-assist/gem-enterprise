import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, ShieldCheck, UsersRound } from "lucide-react";
import { getPublicFunctionalTeam, publicFunctionalTeams } from "@/lib/public-personnel-teams";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{slug:string}> }): Promise<Metadata> {
  const { slug } = await params;
  const team = getPublicFunctionalTeam(slug);
  if (!team) return { title:"Team not found | GEM Enterprise", robots: {index:false} };
  return {
    title: `${team.title} | GEM Enterprise`,
    description: team.mission,
    alternates: { canonical: `/personnel/teams/${team.slug}` },
  };
}

export default async function PublicTeamProfile({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  const team = getPublicFunctionalTeam(slug);
  if(!team) notFound();
  const related=publicFunctionalTeams.filter(x=>x.division===team.division && x.slug!==slug).slice(0,3);
  return <main className="min-h-screen bg-[#020817] text-white">
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:py-14">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/personnel" className="hover:text-cyan-300">People &amp; teams</Link><span>/</span>
        <span className="text-cyan-200">{team.title}</span>
      </nav>
      <header className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-[#14324b] via-[#0b2238] to-[#071526] p-7 sm:p-11">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-200">
          <ShieldCheck className="h-4 w-4" /> GEM Enterprise · Professional function
        </span>
        <h1 className="mt-6 max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{team.title}</h1>
        <p className="mt-5 max-w-4xl text-lg leading-8 text-cyan-100">{team.overview}</p>
        <p className="mt-5 max-w-4xl text-sm leading-8 text-slate-300">{team.mission}</p>
        <span className="mt-6 inline-flex rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300">
          {team.status === "documented" ? "Organizational function documented" : "Proposed organizational capability"}
        </span>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/get-started" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-[#061323] hover:bg-cyan-300">
            Discuss your requirements <ArrowRight className="h-4 w-4"/>
          </Link>
          <Link href="/personnel#team-functions" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4"/> All departments
          </Link>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <section className="rounded-3xl border border-white/10 bg-[#0b1b2d] p-6 sm:p-9">
          <h2 className="text-2xl font-bold">Responsibilities &amp; professional scope</h2>
          <p className="mt-4 text-sm leading-7 text-slate-400">The following describes this function's intended remit. It does not certify operational staffing, service activation or regulated professional authority.</p>
          <ul className="mt-6 space-y-4">
            {team.responsibilities.map(duty=><li key={duty} className="flex gap-3 rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm leading-7 text-slate-200">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true"/>{duty}
            </li>)}
          </ul>
        </section>
        <aside className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-[#0b1b2d] p-6 sm:p-8">
            <h2 className="text-xl font-bold">Example work outputs</h2>
            <ul className="mt-5 space-y-4">
              {team.deliverables.map(deliverable=><li key={deliverable} className="flex items-start gap-3 text-sm leading-7 text-slate-300">
                <FileCheck2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300"/>{deliverable}
              </li>)}
            </ul>
          </section>
          <section className="rounded-3xl border border-amber-300/15 bg-amber-300/[.035] p-6 sm:p-8">
            <div className="flex items-center gap-2 text-lg font-bold"><UsersRound className="h-5 w-5 text-amber-200"/> People &amp; verification</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">Named personnel, headshots and qualifications are published separately, only after their evidence and publication permissions have been approved.</p>
            <Link href="/personnel#approved-people" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-white">Approved people <ArrowRight className="h-4 w-4"/></Link>
          </section>
        </aside>
      </div>
      {related.length>0 && <section className="rounded-3xl border border-white/10 p-6 sm:p-8">
        <h2 className="text-xl font-bold">Related organizational functions</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {related.map(other=><Link key={other.slug} href={`/personnel/teams/${other.slug}`} className="rounded-xl border border-white/10 bg-[#0b1b2d] p-4 hover:border-cyan-300/30">
            <h3 className="font-semibold">{other.title}</h3>
            <p className="mt-2 text-xs leading-6 text-slate-400">{other.overview}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-cyan-300">Explore <ArrowRight className="h-3.5 w-3.5"/></span>
          </Link>)}
        </div>
      </section>}
    </div>
  </main>;
}
