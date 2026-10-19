"use client";

import Link from "next/link";
import { ArrowRight, Grid3X3, Pin, PinOff, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { isCapabilityUsable, type CapabilityState } from "@/lib/capabilityReadiness";
import { ReadinessBadge } from "@/components/capability/ReadinessBadge";
import {
  buildModuleDirectorySearch,
  orderPinnedFirst,
  parseModuleDirectoryFilter,
  pinStorageKey,
  readPinnedIds,
  togglePinnedId,
  type ModuleDirectoryFilter,
} from "@/lib/workspaceModulePreferences";

export interface WorkspaceModuleItem {
  id: string;
  label: string;
  description: string;
  group: string;
  href: string;
  state: CapabilityState;
  reasons: string[];
}

const tabs: Array<{ id: ModuleDirectoryFilter; label: string }> = [
  { id: "all", label: "All modules" },
  { id: "ready", label: "Ready to use" },
  { id: "attention", label: "Needs attention" },
];

function ModuleCard({
  item,
  pinned,
  onTogglePin,
}: {
  item: WorkspaceModuleItem;
  pinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  return (
    <article className="flex min-h-48 flex-col rounded-xl border border-white/10 bg-black/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Grid3X3 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex items-center gap-2">
          <ReadinessBadge state={item.state} />
          <button
            type="button"
            onClick={() => onTogglePin(item.id)}
            aria-pressed={pinned}
            aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label} for quick access`}
            title={pinned ? "Unpin module" : "Pin module for quick access"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
              pinned
                ? "bg-cyan-300/15 text-cyan-200 hover:bg-cyan-300/25"
                : "text-slate-600 hover:bg-white/10 hover:text-slate-300",
            )}
          >
            {pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <h4 className="mt-4 text-sm font-semibold text-white">{item.label}</h4>
      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
      {item.state !== "LIVE" && item.reasons.length > 0 ? (
        <p className="mt-2 text-[11px] leading-4 text-slate-600">
          {item.reasons.join("; ")}
        </p>
      ) : null}

      <div className="mt-auto pt-4">
        <Link
          href={item.href}
          className="inline-flex items-center gap-2 rounded-lg text-xs font-semibold text-cyan-300 transition hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Open module
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function WorkspaceOSModuleDirectory({
  items,
  workspaceId,
}: {
  items: WorkspaceModuleItem[];
  workspaceId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // URL-driven state: ?mtab=ready&mq=finance makes the view shareable and
  // bookmarkable. Unrelated params (e.g. ?workspace=) are preserved.
  const [activeTab, setActiveTab] = useState<ModuleDirectoryFilter>(() =>
    parseModuleDirectoryFilter(searchParams.get("mtab")),
  );
  const [query, setQuery] = useState(() => searchParams.get("mq") ?? "");
  const [pinned, setPinned] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readPinnedIds(window.localStorage, workspaceId),
  );

  function syncUrl(nextTab: ModuleDirectoryFilter, nextQuery: string) {
    router.replace(
      `${pathname}${buildModuleDirectorySearch(searchParams.toString(), nextTab, nextQuery)}`,
      { scroll: false },
    );
  }

  function chooseTab(tab: ModuleDirectoryFilter) {
    setActiveTab(tab);
    syncUrl(tab, query);
  }

  function changeQuery(next: string) {
    setQuery(next);
    syncUrl(activeTab, next);
  }

  function togglePin(id: string) {
    setPinned((current) => {
      const next = togglePinnedId(current, id);
      try {
        window.localStorage.setItem(pinStorageKey(workspaceId), JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode, quota): pinning simply does not persist.
      }
      return next;
    });
  }

  // If the workspace changes beneath the component, reload that workspace's pins.
  useEffect(() => {
    setPinned(typeof window === "undefined" ? [] : readPinnedIds(window.localStorage, workspaceId));
  }, [workspaceId]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalized ||
        `${item.label} ${item.id} ${item.group} ${item.state}`.toLocaleLowerCase().includes(normalized);
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "ready" && isCapabilityUsable(item.state)) ||
        (activeTab === "attention" && !isCapabilityUsable(item.state));
      return matchesQuery && matchesTab;
    });
  }, [activeTab, items, query]);

  const pinnedItems = useMemo(
    () => orderPinnedFirst(visibleItems, pinned).filter((item) => pinned.includes(item.id)),
    [visibleItems, pinned],
  );
  const unpinnedItems = useMemo(
    () => visibleItems.filter((item) => !pinned.includes(item.id)),
    [visibleItems, pinned],
  );

  const groups = useMemo(() => {
    const ordered: string[] = [];
    for (const item of unpinnedItems) {
      if (!ordered.includes(item.group)) ordered.push(item.group);
    }
    return ordered;
  }, [unpinnedItems]);

  function activateTab(index: number) {
    const target = tabs[index];
    if (!target) return;
    chooseTab(target.id);
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

  function renderGroup(group: string, groupItems: WorkspaceModuleItem[]) {
    return (
      <div key={group}>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {group}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="list" aria-label={`${group} modules`}>
          {groupItems.map((item) => (
            <div key={item.id} role="listitem">
              <ModuleCard item={item} pinned={pinned.includes(item.id)} onTogglePin={togglePin} />
            </div>
          ))}
        </div>
      </div>
    );
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
            Every module reports its true readiness from live workspace state. A badge of
            &ldquo;Surface available&rdquo; means the route exists but the capability is not
            asserted live; no module is hidden because it is not yet ready. Pin modules
            for quick access — pins are per workspace and never change entitlements.
          </p>
        </div>

        <label className="relative block w-full xl:w-72">
          <span className="sr-only">Search Workspace OS modules</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Search modules"
            className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-slate-600 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/25"
          />
          {query ? (
            <button
              type="button"
              onClick={() => changeQuery("")}
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
              onClick={() => chooseTab(tab.id)}
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
          {visibleItems.length} workspace modules shown.
        </p>

        {visibleItems.length ? (
          <div className="space-y-6">
            {pinnedItems.length ? (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/80">
                  Pinned
                </h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Pinned modules">
                  {pinnedItems.map((item) => (
                    <div key={item.id} role="listitem">
                      <ModuleCard item={item} pinned onTogglePin={togglePin} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {groups.map((group) => {
              const groupItems = unpinnedItems.filter((item) => item.group === group);
              if (!groupItems.length) return null;
              return renderGroup(group, groupItems);
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
