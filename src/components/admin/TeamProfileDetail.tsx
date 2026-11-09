import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ExternalLink, FileCheck2, Image, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { GallerySourceImage } from "@/components/admin/TeamGalleryPreview";
import { NOTION_TEAM_GALLERY_URL, teamGalleryEntries, type TeamGalleryEntry } from "@/lib/team-gallery-source";
import type { TeamProfileEditorial } from "@/lib/team-gallery-profiles";

interface Props {
  entry: TeamGalleryEntry;
  editorial: TeamProfileEditorial;
}
export function TeamProfileDetail({ entry, editorial }: Props) {
  const pos = teamGalleryEntries.findIndex((item) => item.slug === entry.slug);
  const before = pos > 0 ? teamGalleryEntries[pos - 1] : null;
  const after = pos >= 0 && pos < teamGalleryEntries.length - 1 ? teamGalleryEntries[pos + 1] : null;
  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 xl:px-9">
      <div className="mx-auto max-w-[1450px] space-y-8">
        <nav aria-label="Profile breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Link href="/app/admin" className="hover:text-cyan-200">Administration</Link>
          <span aria-hidden="true">/</span>
          <Link href="/app/admin/team-gallery" className="hover:text-cyan-200">Teams Gallery</Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-200">{entry.title}</span>
        </nav>

        <header className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-[#112a3e] to-[#071425] p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 font-semibold text-cyan-200">
              <LockKeyhole className="h-3.5 w-3.5" /> Internal profile review
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1.5 text-slate-300">{entry.department}</span>
            <span className="rounded-full border border-amber-300/20 px-3 py-1.5 text-amber-200">Identity not verified</span>
          </div>
          <h1 className="mt-6 max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{entry.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">{editorial.purpose}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={entry.notionProfileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-[#081524] hover:bg-cyan-300">
              <BookOpen className="h-4 w-4" /> Original Notion profile <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link href="/app/admin/team-gallery" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> All team profiles
            </Link>
          </div>
        </header>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <section aria-labelledby="photo-heading" className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b1829]">
            <h2 id="photo-heading" className="px-5 pb-3 pt-6 text-lg font-semibold sm:px-7">Original photograph</h2>
            <GallerySourceImage url={entry.imageUrl} alt={`Source image associated with ${entry.title}; pictured individual not identified or verified`} label="Notion source photograph" />
            <div className="space-y-3 p-5 sm:p-7">
              <p className="text-sm leading-7 text-slate-300">
                This is the source photo linked to the role label in your original Notion collection.
                The role and photograph are editorial inputs; they are not evidence of a verified person-to-position match.
              </p>
              <p className="rounded-xl border border-amber-200/15 bg-amber-300/[.05] px-4 py-3 text-xs leading-6 text-amber-100">
                Photograph reuse, subject consent and professional identity require approval before publication outside this protected workspace.
              </p>
            </div>
          </section>

          <section aria-labelledby="work-heading" className="rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-8">
            <div className="flex items-center gap-3"><Users className="h-5 w-5 text-cyan-300" /><h2 id="work-heading" className="text-xl font-bold">Role & work definition</h2></div>
            <p className="mt-5 text-sm leading-8 text-slate-300">{editorial.narrative}</p>
            <h3 className="mt-7 text-sm font-semibold uppercase tracking-widest text-cyan-200">Responsibilities</h3>
            <ul className="mt-3 space-y-3">
              {entry.responsibilities.map((task) => (
                <li key={task} className="flex items-start gap-3 text-sm leading-7 text-slate-300">
                  <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />{task}
                </li>
              ))}
            </ul>
            <h3 className="mt-7 text-sm font-semibold uppercase tracking-widest text-cyan-200">Typical professional deliverables</h3>
            <ul className="mt-3 space-y-3">
              {editorial.outputs.map((output) => (
                <li key={output} className="flex items-center gap-3 text-sm text-slate-300"><FileCheck2 className="h-4 w-4 shrink-0 text-slate-500" />{output}</li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="workflow-heading" className="rounded-3xl border border-white/10 bg-[#0b1829] p-6 sm:p-8">
          <h2 id="workflow-heading" className="text-xl font-bold">How this function supports enterprise delivery</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">A proposed functional workflow for the team, not a record of completed client work.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {editorial.workflow.map((step, index) => (
              <li key={step} className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
                <span className="font-mono text-xs font-semibold text-cyan-300">STEP {String(index + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-100">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="creative-heading" className="space-y-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 id="creative-heading" className="flex items-center gap-2 text-2xl font-bold"><Image className="h-6 w-6 text-cyan-300" /> Ten visual-story concepts</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">Proposed professional photographs built around the original source. These are briefs for generation and approval, <strong>not completed image variations</strong>.</p>
            </div>
            <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1.5 text-xs font-medium text-amber-200">10 concepts · 0 generated</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {editorial.shotBriefs.map((shot) => (
              <article key={shot.order} className="rounded-2xl border border-white/10 bg-[#0c1a2b] p-5">
                <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Concept {String(shot.order).padStart(2, "0")}</span>
                <h3 className="mt-3 text-sm font-semibold leading-6 text-slate-100">{shot.title}</h3>
                <p className="mt-3 text-xs leading-6 text-slate-400">{shot.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-8" aria-labelledby="approval-heading">
          <h2 id="approval-heading" className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5 text-amber-200" /> Review before publication</h2>
          <ul className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            {["Confirm the person's name and department","Confirm the source image matches this role","Record permission to display and alter the photograph","Verify relevant professional titles or licenses","Review all image variations and captions","Approve website visibility through the existing Notion publication process"].map((task) => (
              <li key={task} className="flex items-start gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded border border-amber-300/40" aria-hidden="true" />{task}</li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-6 text-slate-400">
            This editorial record is isolated from the approved public `/personnel` registry and does not independently authorize publication.
            <a href={NOTION_TEAM_GALLERY_URL} className="ml-1 text-cyan-300 underline underline-offset-4" target="_blank" rel="noopener noreferrer">Review original Notion gallery</a>.
          </p>
        </section>

        <nav className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-sm" aria-label="Other team profiles">
          {before ? <Link href={`/app/admin/team-gallery/${before.slug}`} className="flex items-center gap-2 text-cyan-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> {before.title}</Link> : <span />}
          {after ? <Link href={`/app/admin/team-gallery/${after.slug}`} className="flex items-center gap-2 text-cyan-300 hover:text-white">{after.title} <ArrowRight className="h-4 w-4" /></Link> : <span />}
        </nav>
      </div>
    </main>
  );
}
