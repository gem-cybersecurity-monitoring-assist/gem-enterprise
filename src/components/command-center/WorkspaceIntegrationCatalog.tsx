"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface WorkspaceIntegrationItem {
  href: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readiness: "READY" | "PARTIAL" | "HUMAN_REQUIRED" | "BLOCKED";
  capabilities?: readonly string[];
  activationRequirements?: readonly string[];
}

export function WorkspaceIntegrationCatalog({
  items,
  workspaceId,
  projectId,
}: {
  items: WorkspaceIntegrationItem[];
  workspaceId?: string | null;
  projectId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<WorkspaceIntegrationItem | null>(null);
  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category)))];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) =>
      (category === "All" || item.category === category) &&
      (!normalized || `${item.title} ${item.description} ${item.status}`.toLowerCase().includes(normalized)),
    );
  }, [category, items, query]);
  const scoped = (href: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspace", workspaceId);
    if (projectId) params.set("project", projectId);
    const suffix = params.toString();
    return suffix ? `${href}${href.includes("?") ? "&" : "?"}${suffix}` : href;
  };
  const readinessClass = (value: WorkspaceIntegrationItem["readiness"]) => cn(
    "border",
    value === "READY" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    value === "PARTIAL" && "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    value === "HUMAN_REQUIRED" && "border-amber-400/25 bg-amber-400/10 text-amber-300",
    value === "BLOCKED" && "border-rose-400/25 bg-rose-400/10 text-rose-300",
  );

  return <>
    <section aria-labelledby="integration-catalog-heading" className="rounded-2xl border border-white/10 bg-card/75 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Workspace OS</p>
          <h2 id="integration-catalog-heading" className="mt-1 text-xl font-bold text-white">Integration catalogue</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Search and inspect real GEM connector surfaces. Catalogue visibility never grants provider authorization.</p>
        </div>
        <label className="relative block w-full xl:max-w-sm">
          <span className="sr-only">Search integrations</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/>
          <input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search integrations" className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"/>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Integration categories">
        {categories.map((item)=><button key={item} type="button" aria-pressed={category===item} onClick={()=>setCategory(item)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",category===item?"border-cyan-300/40 bg-cyan-300 text-slate-950":"border-white/10 text-slate-400 hover:text-white")}>{item}</button>)}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {filtered.map((item)=><article key={item.href} className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{item.category}</p><h3 className="mt-1 font-bold text-white">{item.title}</h3></div><Badge className={readinessClass(item.readiness)}>{item.readiness.replaceAll("_"," ")}</Badge></div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
          <p className="mt-3 text-xs text-slate-500">{item.status}</p>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>setSelected(item)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Inspect</button><Link href={scoped(item.href)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[.05] px-3 py-2 text-xs font-semibold text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Open <ArrowRight className="h-3.5 w-3.5"/></Link></div>
        </article>)}
      </div>
      {!filtered.length&&<p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No integration matches the current search and category.</p>}
    </section>

    <Dialog open={Boolean(selected)} onOpenChange={(open)=>{if(!open)setSelected(null)}}>
      {selected&&<DialogContent className="border-white/10 bg-slate-950 text-white sm:rounded-2xl">
        <DialogHeader>
          <p className="pr-8 text-xs font-semibold uppercase tracking-[.14em] text-cyan-300">{selected.category}</p>
          <DialogTitle className="text-xl text-white">{selected.title}</DialogTitle>
          <DialogDescription className="text-sm leading-7 text-slate-300">{selected.description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Current readiness</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-sm text-slate-300">{selected.status}</span><Badge className={readinessClass(selected.readiness)}>{selected.readiness.replaceAll("_"," ")}</Badge></div></div>
        {selected.capabilities?.length ? <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Capabilities</p><div className="mt-2 flex flex-wrap gap-2">{selected.capabilities.map((capability)=><Badge key={capability} variant="outline" className="border-cyan-400/15 text-cyan-100">{capability}</Badge>)}</div></div> : null}
        {selected.activationRequirements?.length ? <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Activation requirements</p><ul className="mt-2 space-y-2">{selected.activationRequirements.map((requirement)=><li key={requirement} className="rounded-lg border border-amber-400/15 bg-amber-400/[.035] px-3 py-2 text-xs leading-5 text-slate-300">{requirement}</li>)}</ul></div> : null}
        <Link href={scoped(selected.href)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">Open governed surface <ArrowRight className="h-4 w-4"/></Link>
      </DialogContent>}
    </Dialog>
  </>;
}
