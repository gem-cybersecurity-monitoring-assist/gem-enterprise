"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Building2, LockKeyhole, Search, ShieldCheck, Users } from "lucide-react";
import { divisions, enterpriseTeams, historicalRoster, type EnterpriseDivision, type EnterpriseTeam } from "@/lib/enterprise-team-catalog";

const statusLabel = {
 documented: "Function documented",
 planned: "Proposed capability",
 restricted: "Restricted function",
} as const;
const statusStyle = {
 documented: "border-cyan-400/25 bg-cyan-400/[.07] text-cyan-200",
 planned: "border-amber-300/20 bg-amber-300/[.07] text-amber-200",
 restricted: "border-fuchsia-300/20 bg-fuchsia-300/[.07] text-fuchsia-200",
} as const;

function FunctionCard({ team }: { team: EnterpriseTeam }) {
  return (
    <article className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-[#0a1929] p-5 shadow-[0_10px_36px_rgba(0,0,0,.12)] sm:p-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${statusStyle[team.status]}`}>
            {statusLabel[team.status]}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{team.division}</span>
        </div>
        <h3 className="mt-5 text-xl font-bold leading-snug text-white">{team.title}</h3>
        <p className="mt-2 text-sm font-medium text-cyan-200">{team.strap}</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">{team.summary}</p>
        <h4 className="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">What this team covers</h4>
        <ul className="mt-3 space-y-2">
          {team.responsibilities.map((item) => <li key={item} className="flex gap-2 text-xs leading-6 text-slate-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />{item}</li>)}
        </ul>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
        <Link className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-[#071421] hover:bg-cyan-300" href={`/app/admin/team-gallery/teams/${team.slug}`}>
          Open team profile <ArrowRight className="h-4 w-4" />
        </Link>
        <a className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/10" target="_blank" rel="noopener noreferrer" href={team.notionDetailUrl}>
          Notion department page <BookOpen className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

export function EnterpriseTeamDirectory() {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<EnterpriseDivision | "all">("all");
  const [showRoster, setShowRoster] = useState(false);
  const filtered = useMemo(() => {
    const search = query.toLowerCase().trim();
    return enterpriseTeams.filter((team) =>
      (division === "all" || team.division === division) &&
      (!search || [team.title, team.strap, team.summary, ...team.responsibilities].some(text => text.toLowerCase().includes(search)))
    );
  }, [query, division]);
  return (
    <section id="enterprise-functions" aria-labelledby="enterprise-functions-heading" className="space-y-7 border-t border-white/10 pt-10">
      <header className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#11283d] via-[#0b1d30] to-[#091628] p-6 sm:p-9">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-200">
          <ShieldCheck className="h-4 w-4" /> Enterprise organizational model
        </div>
        <h2 id="enterprise-functions-heading" className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Teams, departments &amp; functional profiles</h2>
        <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-300">
          A fuller enterprise model reconciled from the original Notion organizational chart, staff directory and the GEM platform's service areas.
          These are functional role pages—not proof of employment, staffing levels, professional licenses, or activated services.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-slate-400">Functional team profiles</p><p className="mt-1 text-3xl font-bold">{enterpriseTeams.length}</p></div>
          <div className="rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-slate-400">Division / service groups</p><p className="mt-1 text-3xl font-bold">{divisions.length}</p></div>
          <div className="rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-slate-400">Historical roster entries to reconcile</p><p className="mt-1 text-3xl font-bold">{historicalRoster.length}</p></div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        {divisions.map((item) => (
          <Link href={`/app/admin/team-gallery/divisions/${item.id}`} key={item.id} className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:border-cyan-300/35 hover:bg-white/[.07]">
            <div className="mb-4 flex items-start justify-between"><Building2 className="h-5 w-5 text-cyan-300" /><ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-white" /></div>
            <h3 className="text-base font-bold leading-6 text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.subtitle}</p>
            <span className="mt-3 block text-xs text-cyan-300">{enterpriseTeams.filter(t=>t.division===item.id).length} functions · Open overview</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div role="group" aria-label="Filter enterprise functional teams" className="flex flex-wrap gap-2">
          {[{id:"all",title:"All functions"},...divisions.map(d=>({id:d.id,title:d.title}))].map(({id,title})=> (
            <button type="button" aria-pressed={division===id} key={id} onClick={()=>setDivision(id as EnterpriseDivision | "all")}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${division===id?"border-cyan-400 bg-cyan-400 text-[#071421]":"border-white/20 text-slate-300 hover:bg-white/10"}`}>
              {title}
            </button>
          ))}
        </div>
        <label className="relative w-full max-w-md">
          <span className="sr-only">Search enterprise teams</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a team, workflow or responsibility"
            className="w-full rounded-xl border border-white/20 bg-[#0b1c2d] px-4 py-3 pl-10 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
      </div>

      <p className="text-xs text-slate-400" aria-live="polite">Showing {filtered.length} of {enterpriseTeams.length} functional team profiles.</p>
      {filtered.length>0 ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{filtered.map(team=><FunctionCard key={team.slug} team={team} />)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/20 px-4 py-16 text-center text-sm text-slate-400">No teams match the search or division.</div>
      )}

      <div className="overflow-hidden rounded-3xl border border-amber-300/20 bg-[#181d28]" id="source-roster-review">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-200"><LockKeyhole className="h-4 w-4" /> Historical roster · verification register</div>
            <h3 className="mt-3 text-xl font-bold text-white">Previously recorded team names and service desks</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Ten entries appear in earlier Notion staff and organization records. Some are individual names with unverified
              employment or qualifications; others are desks or a proposed AI function. None is automatically a verified current staff member.
            </p>
          </div>
          <button aria-expanded={showRoster} aria-controls="historic-roster-items" type="button"
            onClick={()=>setShowRoster(!showRoster)} className="shrink-0 rounded-xl border border-amber-300/35 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-300/10">
            {showRoster ? "Hide review records" : "Review 10 records"}
          </button>
        </div>
        {showRoster && <div id="historic-roster-items" className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-3">
          {historicalRoster.map(person=>(
            <Link key={person.slug} href={`/app/admin/team-gallery/roster/${person.slug}`} className="rounded-xl border border-white/10 bg-white/[.035] p-4 transition hover:border-amber-200/40">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-200">{person.status.replaceAll("-", " ")}</span>
              <h4 className="mt-2 font-semibold text-white">{person.label}</h4>
              <p className="mt-1 text-xs leading-6 text-slate-400">{person.title}</p>
              <span className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-300">Open source-based review profile <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          ))}
        </div>}
      </div>
      <p className="text-xs leading-6 text-slate-500">
        Profile photographs must be mapped to identifiable people and reviewed before public display. The separate public
        personnel directory continues to enforce its own explicit publication gate.
      </p>
    </section>
  );
}
