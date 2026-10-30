"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronUp, Film, MessageCircle, PlayCircle } from "lucide-react";
import library from "../../../content/video-storylines/gem-storylines.v1.json";

type Beat = { time: string; role: string; caption: string; voiceover: string; clip: { id: number; title: string; url: string } };
type Story = { id: string; title: string; vertical: string; durationSec: number; summary: string; post: { caption: string; hashtags: string[] }; tags: string[]; beats: Beat[] };
const stories = library.storylines as Story[];
const week = [
  { day: 1, story: 0, telegram: "Four connected areas can create four different kinds of risk: digital access, financial workflows, property paperwork and legal obligations. GEM brings these conversations into one coordinated starting point. Which area would you like us to explain first?" },
  { day: 2, story: 1, telegram: "An alert is only useful when someone knows what it means and what should happen next. Today’s reminder: define ownership, escalation and the agreed scope before relying on a monitoring process." },
  { day: 3, story: 2, telegram: "A simple financial-workflow question: who has access, what are they allowed to do, and where is that approval recorded? Reviewing access is a practical starting point for stronger financial operations." },
  { day: 4, story: 3, telegram: "Before a property transaction moves forward, take time to verify the people, documents and payment instructions involved. Slow down around changed details and confirm them through a separate trusted channel." },
  { day: 5, story: 4, telegram: "Good compliance work leaves a clear record: what was reviewed, what evidence was available, what remains open and who owns the next step. Clear documentation makes conversations more useful." },
  { day: 6, story: 0, telegram: "GEM’s approach connects cybersecurity, financial workflows, property and compliance through a coordinated entry point. Follow along this week as we explain each lane with practical examples." },
  { day: 7, story: 1, telegram: "Weekly takeaway: tools, alerts and policies work best when ownership and next steps are clear. What topic should GEM break down next: access, incident response, financial workflows, property checks or compliance records?" },
];

export function GemStorylineLibraryPanel() {
  const [expanded, setExpanded] = useState<string>(stories[0]?.id ?? "");
  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Film className="h-5 w-5 text-violet-200" /><h2 className="text-lg font-bold text-white">GEM video storyline library</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Five source storylines, 26 timed beats and Pexels clip references. These are production drafts; each finished video still needs a real voice track or an explicitly disclosed synthetic voice, then review and approval.</p>
        </div>
        <div className="flex gap-2 text-xs"><span className="rounded-lg border border-white/10 px-3 py-2 text-slate-300">5 storylines</span><span className="rounded-lg border border-white/10 px-3 py-2 text-slate-300">26 beats</span></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stories.map((story) => {
          const open = expanded === story.id;
          return <article key={story.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
            <button type="button" onClick={() => setExpanded(open ? "" : story.id)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
              <span><span className="text-[10px] uppercase tracking-widest text-violet-200">{story.vertical}</span><span className="mt-1 block text-sm font-semibold text-white">{story.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{story.summary}</span><span className="mt-2 block text-[11px] text-slate-500">{story.durationSec}s · {story.beats.length} beats · DRAFT</span></span>
              {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
            </button>
            {open ? <div className="space-y-3 border-t border-white/10 p-4">
              {story.beats.map((beat, index) => <div key={`${story.id}-${index}`} className="rounded-lg bg-white/[0.03] p-3"><div className="flex justify-between gap-2 text-[10px] uppercase tracking-wider text-violet-200"><span>{beat.role}</span><span>{beat.time}s</span></div><p className="mt-1 text-sm font-medium text-white">{beat.caption}</p><p className="mt-1 text-xs leading-5 text-slate-400">{beat.voiceover}</p><a className="mt-2 inline-block text-[11px] text-cyan-300 hover:underline" href={beat.clip.url} target="_blank" rel="noreferrer">Pexels #{beat.clip.id}: {beat.clip.title}</a></div>)}
              <p className="text-xs leading-5 text-slate-400">{story.post.caption}</p><p className="mt-2 text-[11px] text-slate-500">{story.post.hashtags.join(" ")}</p>
              <div className="flex flex-wrap gap-1">{story.tags.map((tag) => <span key={tag} className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">#{tag}</span>)}</div>
            </div> : null}
          </article>;
        })}
      </div>
      <div className="border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-200" /><h3 className="font-semibold text-white">Organic launch · Week 1</h3></div><p className="mt-1 text-xs text-slate-400">Week of 26 October 2026 · WAT (UTC+1) · 7 short videos + 7 Telegram posts</p></div><span className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100">0 / 14 posted</span></div>
        <p className="mt-3 text-xs leading-5 text-amber-100/70">Planning drafts only: these 14 slots are not yet materialized as TokMetric content records or approval requests. A post counts as submitted only after it appears in the live Approvals queue.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {week.map((item) => { const story = stories[item.story]; return <article key={item.day} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-cyan-200">DAY {item.day}</span><span className="text-[10px] text-slate-500">DRAFT · NOT POSTED</span></div><div className="mt-2 grid gap-3 sm:grid-cols-2"><div><div className="flex items-center gap-2 text-xs font-semibold text-white"><PlayCircle className="h-4 w-4" />Video · TikTok / Reels</div><p className="mt-1 text-sm text-slate-300">{story.title}</p><p className="mt-1 text-xs text-slate-500">{story.durationSec}s · Pexels footage · manual TikTok posting</p></div><div><div className="flex items-center gap-2 text-xs font-semibold text-white"><MessageCircle className="h-4 w-4" />Telegram</div><p className="mt-1 text-xs leading-5 text-slate-400">{item.telegram}</p></div></div></article>; })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs"><Link href="/app/social-media/approvals" className="font-semibold text-cyan-300 hover:underline">Open approvals →</Link><Link href="/app/command-center/social-media" className="font-semibold text-cyan-300 hover:underline">Open Social Command Center →</Link></div>
      </div>
    </section>
  );
}



