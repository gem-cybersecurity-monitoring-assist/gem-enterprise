"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Compass, Search, Shield, UsersRound } from "lucide-react";
import type { EnterpriseDivision } from "@/lib/enterprise-team-catalog";
import type { PublicFunctionalTeam } from "@/lib/public-personnel-teams";

type Summary = { id: EnterpriseDivision; title: string; subtitle: string };
const icons: Record<EnterpriseDivision, typeof Shield> = {
  executive: Compass, security: Shield, realty: Building2, shared: UsersRound,
};
const shortLabel: Record<EnterpriseDivision, string> = {
  executive: "Executive", security: "Cybersecurity", realty: "ATR Realty", shared: "Shared services",
};

export function PersonnelFunctionsExplorer({
  teams, divisions,
}: {teams: readonly PublicFunctionalTeam[]; divisions: readonly Summary[]}) {
  const [division, setDivision] = useState<EnterpriseDivision | "all">("all");
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return teams.filter(team => (division === "all" || division === team.division) &&
      (!searchTerm || [team.title, team.overview, team.mission, ...team.responsibilities]
        .some(part => part.toLowerCase().includes(searchTerm))));
  }, [division, search, teams]);

  return (
    <section id="team-functions" aria-labelledby="team-functions-heading"
      className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Enterprise organization</p>
          <h2 id="team-functions-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Our teams &amp; professional functions</h2>
          <p className="mt-4 text-sm leading-8 text-slate-300">
            Explore how GEM Enterprise structures cybersecurity, realty, executive oversight and
            supporting operations. These are functional profiles, not a roster of verified employees
            or a promise of operational availability.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] px-5 py-4">
          <strong className="block text-3xl tabular-nums">{teams.length}</strong>
          <span className="text-xs text-slate-400">Public role descriptions</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {divisions.map(d => {
          const Icon = icons[d.id];
          return (
            <button key={d.id} type="button"
              className={`rounded-2xl border p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${division === d.id ? "border-cyan-300/70 bg-cyan-300/10" : "border-white/10 bg-[#0b1b2c] hover:border-cyan-300/30"}`}
              aria-pressed={division === d.id}
              onClick={() => {setDivision(d.id);setSearch("");}}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-5 block text-lg font-semibold leading-snug">{d.title}</span>
              <span className="mt-2 block text-sm leading-6 text-slate-400">{d.subtitle}</span>
              <span className="mt-4 block text-xs font-bold text-cyan-300">
                {teams.filter(t=>t.division===d.id).length} functional profiles
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-white/10 pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter team functions">
          <button type="button" aria-pressed={division==="all"} onClick={()=>setDivision("all")}
            className={`rounded-full border px-3.5 py-2 text-xs font-semibold ${division==="all" ? "border-cyan-300 bg-cyan-300 text-[#081525]" : "border-white/20 text-slate-300"}`}>
            All teams
          </button>
          {divisions.map(d => <button key={d.id} type="button" aria-pressed={division===d.id}
            onClick={()=>setDivision(d.id)}
            className={`rounded-full border px-3.5 py-2 text-xs font-semibold ${division===d.id ? "border-cyan-300 bg-cyan-300 text-[#081525]" : "border-white/20 text-slate-300"}`}>
            {shortLabel[d.id]}
          </button>)}
        </div>
        <label className="relative w-full lg:max-w-md">
          <span className="sr-only">Search professional functions</span>
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true"/>
          <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search team roles and duties"
            className="w-full rounded-xl border border-white/20 bg-[#0b1b2c] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
      </div>
      <p aria-live="polite" className="text-sm text-slate-400">Showing {visible.length} of {teams.length} functional profiles</p>
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(team => {
            const Icon = icons[team.division];
            return (
              <article key={team.slug} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0a1929] p-5 transition-colors hover:border-cyan-300/30 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                      <Icon className="h-4 w-4" aria-hidden="true"/> {shortLabel[team.division]}
                    </span>
                    <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-400">
                      {team.status === "documented" ? "Documented function" : "Proposed function"}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold leading-snug">{team.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{team.mission}</p>
                  <ul className="mt-5 space-y-2">
                    {team.responsibilities.slice(0, 2).map(text => (
                      <li key={text} className="flex gap-2 text-xs leading-6 text-slate-400">
                        <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={`/personnel/teams/${team.slug}`}
                  className="mt-6 inline-flex items-center gap-2 border-t border-white/10 pt-4 text-sm font-bold text-cyan-300 hover:text-white">
                  View team profile <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/20 px-6 py-14 text-center text-sm text-slate-400">
          No teams match that search. Choose All teams or try another term.
        </div>
      )}
    </section>
  );
}
