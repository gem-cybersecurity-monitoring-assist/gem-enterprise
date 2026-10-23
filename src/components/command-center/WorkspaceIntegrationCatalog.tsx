"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WorkspaceIntegrationItem } from "@/lib/workspaceIntegrationCatalog";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE_CONNECTORS = 48;
const CONNECTOR_PAGE_SIZE = 48;

function providerLogoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${domain}`)}&sz=128`;
}

function connectorInitials(title: string) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ConnectorLogo({ item, size = "card" }: { item: WorkspaceIntegrationItem; size?: "card" | "preview" }) {
  const [failed, setFailed] = useState(false);
  const dimension = size === "preview" ? 72 : 56;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-white shadow-[0_12px_30px_rgba(0,0,0,.18)]",
        size === "preview" ? "h-[72px] w-[72px] rounded-2xl" : "h-14 w-14 rounded-xl",
      )}
    >
      {failed ? (
        <span
          aria-label={`${item.title} logo fallback`}
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-100 to-slate-200 text-sm font-black tracking-tight text-slate-800"
          role="img"
        >
          {connectorInitials(item.title)}
        </span>
      ) : (
        <Image
          alt={`${item.title} logo`}
          className="h-full w-full object-contain p-2"
          height={dimension}
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={providerLogoUrl(item.logoDomain)}
          unoptimized
          width={dimension}
        />
      )}
    </div>
  );
}

function readinessClass(value: WorkspaceIntegrationItem["readiness"]) {
  return cn(
    "border",
    value === "AVAILABLE" && "border-violet-400/25 bg-violet-400/10 text-violet-200",
    value === "READY" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    value === "PARTIAL" && "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    value === "HUMAN_REQUIRED" && "border-amber-400/25 bg-amber-400/10 text-amber-300",
    value === "BLOCKED" && "border-rose-400/25 bg-rose-400/10 text-rose-300",
  );
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
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CONNECTORS);
  const [selected, setSelected] = useState<WorkspaceIntegrationItem | null>(null);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );
  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return items.filter((item) =>
      (category === "All" || item.category === category) &&
      (!normalized || `${item.title} ${item.description} ${item.category} ${item.status}`.toLowerCase().includes(normalized)),
    );
  }, [category, deferredQuery, items]);
  const visibleItems = filtered.slice(0, visibleCount);
  const scoped = (href: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspace", workspaceId);
    if (projectId) params.set("project", projectId);
    const suffix = params.toString();
    return suffix ? `${href}${href.includes("?") ? "&" : "?"}${suffix}` : href;
  };

  return <>
    <section aria-labelledby="integration-catalog-heading" className="rounded-2xl border border-white/10 bg-card/75 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Workspace OS</p>
          <h2 id="integration-catalog-heading" className="mt-1 text-xl font-bold text-white">Integration catalogue</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Search and preview {items.length.toLocaleString()} provider applications. Catalogue visibility never grants provider authorization.</p>
        </div>
        <label className="relative block w-full xl:max-w-sm">
          <span className="sr-only">Search integrations</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/>
          <input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search integrations" className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"/>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Integration categories">
        {categories.map((item)=><button key={item} type="button" aria-pressed={category===item} onClick={()=>{setCategory(item);setVisibleCount(INITIAL_VISIBLE_CONNECTORS)}} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",category===item?"border-cyan-300/40 bg-cyan-300 text-slate-950":"border-white/10 text-slate-400 hover:text-white")}>{item}</button>)}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500" aria-live="polite">
        <span>{filtered.length.toLocaleString()} connector{filtered.length === 1 ? "" : "s"}</span>
        <span>{Math.min(visibleItems.length, filtered.length).toLocaleString()} shown</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {visibleItems.map((item)=><article key={item.id} className="flex min-h-[280px] flex-col rounded-2xl border border-white/10 bg-black/15 p-4 [contain-intrinsic-size:280px] [content-visibility:auto]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ConnectorLogo item={item}/>
              <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[.12em] text-slate-500">{item.category}</p><h3 className="mt-1 truncate font-bold text-white">{item.title}</h3></div>
            </div>
            <Badge className={cn("shrink-0",readinessClass(item.readiness))}>{item.readiness.replaceAll("_"," ")}</Badge>
          </div>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{item.description}</p>
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.status}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button type="button" onClick={()=>setSelected(item)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Preview</button>
            {item.kind === "GEM_SURFACE" ? <Link href={scoped(item.href)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[.05] px-3 py-2 text-xs font-semibold text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Open <ArrowRight className="h-3.5 w-3.5"/></Link> : null}
          </div>
        </article>)}
      </div>
      {visibleItems.length < filtered.length ? <div className="mt-5 flex justify-center"><button type="button" onClick={()=>setVisibleCount((current)=>current+CONNECTOR_PAGE_SIZE)} className="rounded-xl border border-cyan-300/25 bg-cyan-300/[.06] px-5 py-2.5 text-sm font-semibold text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Show {Math.min(CONNECTOR_PAGE_SIZE, filtered.length-visibleItems.length)} more</button></div> : null}
      {!filtered.length?<p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No integration matches the current search and category.</p>:null}
    </section>

    <Dialog open={Boolean(selected)} onOpenChange={(open)=>{if(!open)setSelected(null)}}>
      {selected?<DialogContent className="border-white/10 bg-slate-950 text-white sm:rounded-2xl">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-4 pr-8"><ConnectorLogo item={selected} size="preview"/><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-cyan-300">{selected.category}</p><DialogTitle className="mt-1 text-xl text-white">{selected.title}</DialogTitle></div></div>
          <DialogDescription className="text-sm leading-7 text-slate-300">{selected.description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Connection status</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-sm text-slate-300">{selected.status}</span><Badge className={readinessClass(selected.readiness)}>{selected.readiness.replaceAll("_"," ")}</Badge></div></div>
        {selected.kind === "GEM_SURFACE" ? <Link href={scoped(selected.href)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">Open governed surface <ArrowRight className="h-4 w-4"/></Link> : <div className="flex items-start gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[.06] p-4 text-sm leading-6 text-slate-300"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-300"/><p>Available for discovery. A workspace administrator must approve provider terms, scopes, credentials, and data access before this connector can be activated.</p></div>}
      </DialogContent>:null}
    </Dialog>
  </>;
}
