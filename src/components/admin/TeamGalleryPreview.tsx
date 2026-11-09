"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  ExternalLink,
  ImageOff,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  atrGalleryMedia,
  NOTION_ATR_MEDIA_PAGE_URL,
  NOTION_ATR_SOURCE_URL,
  NOTION_STAFF_SOURCE_URL,
  NOTION_TEAM_GALLERY_URL,
  teamGalleryEntries,
  type TeamGalleryCategory,
  type TeamGalleryEntry,
} from "@/lib/team-gallery-source";

const filters: readonly { value: "all" | TeamGalleryCategory; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "governance", label: "Legal & governance" },
  { value: "technology", label: "Technology & security" },
  { value: "operations", label: "People & communications" },
  { value: "finance", label: "Financial technology" },
  { value: "unassigned", label: "Needs attribution" },
];

export function GallerySourceImage({ url, alt, label }: { url: string | null; alt: string; label: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-[#101e2c]">
      {broken || !url ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
          <ImageOff className="h-8 w-8" aria-hidden="true" />
          <span className="text-sm">{url ? "The original media is temporarily unavailable." : "This source record is a video, not a portrait."}</span>
          <span className="text-xs">Use the linked Notion profile or original source to inspect the media.</span>
        </div>
      ) : (
        <Image
          src={url}
          alt={alt}
          width={960}
          height={720}
          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          unoptimized
          onError={() => setBroken(true)}
        />
      )}
      <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-[#061525]/85 px-3 py-1 text-[11px] font-medium text-slate-100 backdrop-blur-md">
        {label}
      </span>
    </div>
  );
}

function TeamCard({ entry, index }: { entry: TeamGalleryEntry; index: number }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0c1a2b] shadow-[0_14px_48px_rgba(0,0,0,.2)]">
      <GallerySourceImage
        url={entry.imageUrl}
        alt={`Original Notion source media ${index + 1}, listed as ${entry.title}; identity not independently verified`}
        label={entry.mediaKind === "video" ? "Notion video source" : "Original Notion photograph"}
      />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-cyan-300/80">
              {entry.department}
            </p>
            <h3 className="mt-2 text-xl font-semibold leading-snug text-white">{entry.title}</h3>
          </div>
          <span className="shrink-0 rounded-xl border border-white/10 px-2.5 py-1 text-xs text-slate-400">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <p className="text-sm leading-7 text-slate-300">{entry.summary}</p>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Role responsibilities
          </p>
          <ul className="space-y-2">
            {entry.responsibilities.map((responsibility) => (
              <li key={responsibility} className="flex gap-2 text-xs leading-6 text-slate-300">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                {responsibility}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <Link
            href={`/app/admin/team-gallery/${entry.slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-3.5 py-2.5 text-xs font-semibold text-[#071421] hover:bg-cyan-300"
          >
            Enterprise profile <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <a href={entry.notionProfileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Notion source <ExternalLink className="h-3.5 w-3.5" /></a>
          <span className="inline-flex items-center rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[11px] text-amber-100/90">
            Identity / assignment unconfirmed
          </span>
        </div>
      </div>
    </article>
  );
}

export function TeamGalleryPreview() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | TeamGalleryCategory>("all");
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return teamGalleryEntries.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      return !search || [entry.title, entry.department, entry.summary, ...entry.responsibilities]
        .some((value) => value.toLowerCase().includes(search));
    });
  }, [category, query]);

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-8 text-slate-100 sm:px-6 xl:px-9">
      <div className="mx-auto max-w-[1600px] space-y-10">
        <header className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-[#10273b] via-[#071729] to-[#03101d] px-6 py-9 sm:px-10 sm:py-12">
          <div aria-hidden="true" className="absolute -right-24 -top-40 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-cyan-200">
              <ShieldCheck className="h-4 w-4" /> Internal • Review-only
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">Teams & Staff Gallery</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              A connected editorial preview of GEM Enterprise team roles and Alliance Trust Realty
              corporate media, using the original staff media and individual profile pages from
              your Notion collections.
            </p>
            <p className="mt-4 text-sm leading-6 text-amber-100/90">
              This is a linked source snapshot, not an automatic live sync or an approved public
              employee directory. Source photos do not establish identity, qualifications,
              appointment or employment. The existing /personnel publication controls remain unchanged.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-[#071421] hover:bg-cyan-300" href={NOTION_TEAM_GALLERY_URL} target="_blank" rel="noopener noreferrer">
                <BookOpen className="h-4 w-4" /> Open the Notion gallery
              </a>
              <a className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10" href="/personnel" target="_blank" rel="noopener noreferrer">
                <Users className="h-4 w-4" /> Approved public directory
              </a>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Original staff photos", value: teamGalleryEntries.filter((entry) => entry.mediaKind === "photograph").length, icon: Users },
            { label: "Linked role profiles", value: teamGalleryEntries.length, icon: BookOpen },
            { label: "ATR source visuals", value: atrGalleryMedia.length, icon: Building2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.035] px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
                </div>
                <Icon className="h-7 w-7 text-cyan-300" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>

        <section aria-labelledby="directory-title" className="space-y-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h2 id="directory-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Enterprise professional roles
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                Every card opens a native enterprise role page and its source Notion story. Filters use the source-verified photo-to-role mapping,
                not the deprecated demo portraits.
              </p>
            </div>
            <label className="relative block w-full max-w-md">
              <span className="sr-only">Search role cards</span>
              <Search className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-slate-500" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search roles, teams and responsibilities"
                className="w-full rounded-xl border border-white/15 bg-[#0c1b2c] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter team roles">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCategory(filter.value)}
                aria-pressed={category === filter.value}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${category === filter.value ? "border-cyan-400 bg-cyan-400 text-[#071421]" : "border-white/15 bg-white/[.035] text-slate-300 hover:border-white/30 hover:text-white"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400" aria-live="polite">
            Showing {filtered.length} of {teamGalleryEntries.length} original role/media records (9 photographs, 1 video).
          </p>
          {filtered.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((entry) => (
                <TeamCard key={entry.slug} entry={entry} index={teamGalleryEntries.indexOf(entry)} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-slate-400">
              No role records match the selected filters.
            </div>
          )}
        </section>

        <section aria-labelledby="atr-title" className="space-y-5 border-t border-white/10 pt-10">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 id="atr-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Alliance Trust Realty — Corporate imagery
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                Presentation and architectural concepts from the second original Notion site, kept
                separate from employee portrait records.
              </p>
            </div>
            <a href={NOTION_ATR_MEDIA_PAGE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
              ATR media details <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {atrGalleryMedia.map((media) => (
              <article key={media.title} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]">
                <GallerySourceImage url={media.url} alt={media.title} label="ATR source image" />
                <div className="p-5">
                  <h3 className="font-semibold text-white">{media.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{media.caption}</p>
                </div>
              </article>
            ))}
          </div>
          <a href={NOTION_ATR_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-white">
            Open the original ATR Notion source <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </section>

        <footer className="rounded-2xl border border-amber-300/20 bg-amber-300/[.045] p-5 text-sm leading-7 text-amber-100/90">
          <strong>Publication safeguard:</strong> This administrative preview does not populate the
          public personnel registry. Approved public profiles must still pass the existing Notion
          <code className="mx-1 rounded bg-black/20 px-1.5">Publish Approved</code> and
          <code className="mx-1 rounded bg-black/20 px-1.5">Website Visibility = Public</code>
          controls and any applicable identity, licensing and likeness review.
          <a href={NOTION_STAFF_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="ml-1 underline underline-offset-4 hover:text-white">
            Original staff source
          </a>.
        </footer>
      </div>
    </main>
  );
}
