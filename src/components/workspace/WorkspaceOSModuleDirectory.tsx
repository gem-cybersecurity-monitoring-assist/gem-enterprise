"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Grid3X3,
  LockKeyhole,
  Search,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WorkspaceModule {
  id: string;
  label: string;
  state: string;
}

type ModuleFilter = "all" | "ready" | "setup";

const tabs: Array<{ id: ModuleFilter; label: string }> = [
  { id: "all", label: "All modules" },
  { id: "ready", label: "Available" },
  { id: "setup", label: "Setup & activation" },
];

const moduleDestinations: Record<string, { href: string; label: string }> = {
  projects: { href: "#workspace-projects", label: "Open projects" },
  team: { href: "#workspace-team", label: "Open team" },
  weekly_updates: { href: "#workspace-weekly-reporting", label: "Open reporting" },
  requests: { href: "/app/requests", label: "Open requests" },
  documents: { href: "/app/documents", label: "Open documents" },
  integrations: { href: "/app/command-center/integrations", label: "Review integrations" },
};

function stateLabel(state: string) {
  return state.replaceAll("_", " ");
}

function isAvailable(state: string) {
  return state === "AVAILABLE";
}

function stateTone(state: string) {
  if (state === "AVAILABLE") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }
  if (state === "SETUP_IN_PROGRESS") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-200";
  }
  return "border-amber-400/25 bg-amber-400/10 text-amber-300";
}

function StateIcon({ state }: { state: string }) {
  if (state === "AVAILABLE") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />;
  }
  if (state === "SETUP_IN_PROGRESS") {
    return <Clock3 className="h-4 w-4 text-cyan-300" aria-hidden="true" />;
  }
  return <LockKeyhole className="h-4 w-4 text-amber-300" aria-hidden="true" />;
}

export function WorkspaceOSModuleDirectory({ modules }: { modules: WorkspaceModule[] }) {
  const [activeTab, setActiveTab] = useState<ModuleFilter>("all");
  const [query, setQuery] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const visibleModules = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return modules.filter((module) => {
      const matchesQuery = !normalized || `${module.label} ${module.id} ${module.state}`.toLocaleLowerCase().includes(normalized);
      const matchesTab = activeTab === "all"
        || (activeTab === "ready" && isAvailable(module.state))
        || (activeTab === "setup" && !isAvailable(module.state));
      return matchesQuery && matchesTab;
    });
  }, [activeTab, modules, query]);

  function activateTab(index: number) {
    const target = tabs[index];
    if (!target) return;
    setActiveTab(target.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(nextIndex);
  }

  return (
    <section aria-labelledby="workspace-os-modules-heading" className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Workspace OS</p>
          <h2 id="workspace-os-modules-heading" className="mt-1 text-lg font-bold text-white sm:text-xl">
            Modules and operating surfaces
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Every module remains tied to authoritative workspace state. Setup or activation labels do not imply provider authorization or production readiness.
          </p>
        </div>

        <label className="relative block w-full xl:w-72">
          <span className="sr-only">Search Workspace OS modules</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search modules"
            className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-slate-600 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/25"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear module search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </div>

      <div
        role="tablist"
        aria-label="Workspace module filters"
        className="mt-5 flex gap-2 overflow-x-auto border-b border-white/10 pb-3"
      >
        {tabs.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`workspace-module-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`workspace-module-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                selected
                  ? "border-cyan-300/35 bg-cyan-300 text-slate-950"
                  : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-cyan-300/20 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`workspace-module-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`workspace-module-tab-${activeTab}`}
        tabIndex={0}
        className="mt-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <p role="status" aria-live="polite" className="sr-only">
          {visibleModules.length} workspace modules shown.
        </p>

        {visibleModules.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Workspace modules">
            {visibleModules.map((module) => {
              const destination = moduleDestinations[module.id];
              return (
                <article key={module.id} role="listitem" className="flex min-h-44 flex-col rounded-xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                      <Grid3X3 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <Badge variant="outline" className={stateTone(module.state)}>
                      <span className="mr-1.5"><StateIcon state={module.state} /></span>
                      {stateLabel(module.state)}
                    </Badge>
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-white">{module.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {isAvailable(module.state)
                      ? "Available through this authenticated workspace."
                      : module.state === "SETUP_IN_PROGRESS"
                        ? "The workspace records this module as setup in progress."
                        : "The module remains fail-closed until it is activated."}
                  </p>

                  <div className="mt-auto pt-4">
                    {destination ? (
                      <Link
                        href={destination.href}
                        className="inline-flex items-center gap-2 rounded-lg text-xs font-semibold text-cyan-300 transition hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        {destination.label}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-slate-600">No separate surface activated</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
            <p className="text-sm font-semibold text-white">No module matches this view</p>
            <p className="mt-1 text-xs text-slate-500">Clear the search or switch module filters.</p>
          </div>
        )}
      </div>
    </section>
  );
}
