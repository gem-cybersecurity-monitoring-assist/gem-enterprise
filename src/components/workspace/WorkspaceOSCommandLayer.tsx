"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Bot,
  Clapperboard,
  Command,
  Newspaper,
  Plug,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import type { WorkspaceOSNavItem } from "@/components/workspace/WorkspaceOSNavigation";

interface WorkspaceOSCommandLayerProps {
  items: WorkspaceOSNavItem[];
  currentId: string;
  workspaceName: string;
  projectName: string;
  workspaceHref: string;
  workspaceId: string;
  projectId: string;
  updateCount?: number;
}

interface CommandDestination {
  id: string;
  label: string;
  description: string;
  href: string;
  category: "Project" | "Workspace" | "Platform";
}

function appendScope(href: string, workspaceId: string, projectId: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}workspace=${encodeURIComponent(workspaceId)}&project=${encodeURIComponent(projectId)}`;
}

export function WorkspaceOSCommandLayer({
  items,
  currentId,
  workspaceName,
  projectName,
  workspaceHref,
  workspaceId,
  projectId,
  updateCount,
}: WorkspaceOSCommandLayerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const destinations = useMemo<CommandDestination[]>(() => {
    const environmentDestinations = items.map((item) => ({
      id: `environment:${item.id}`,
      label: item.label,
      description: item.description,
      href: item.href,
      category: "Project" as const,
    }));

    return [
      ...environmentDestinations,
      {
        id: "workspace:home",
        label: "Workspace home",
        description: `Return to ${workspaceName} and its projects, team, modules, and reporting.`,
        href: workspaceHref,
        category: "Workspace" as const,
      },
      {
        id: "platform:integrations",
        label: "Workspace integrations",
        description: "Inspect governed connector capabilities, readiness, and activation requirements.",
        href: appendScope("/app/integrations", workspaceId, projectId),
        category: "Platform" as const,
      },
      {
        id: "platform:video",
        label: "Content & Video Studio",
        description: "Open the governed video creation, preview, and approved-media workflow.",
        href: appendScope("/app/social-media/video", workspaceId, projectId),
        category: "Platform" as const,
      },
      {
        id: "platform:news",
        label: "News automation",
        description: "Open GEM source ingestion, attributed stories, video discovery, and native news operations.",
        href: appendScope("/app/command-center/integrations/news", workspaceId, projectId),
        category: "Platform" as const,
      },
      {
        id: "platform:support",
        label: "GEM AI support",
        description: "Open governed AI-assisted platform support and human escalation.",
        href: appendScope("/app/support", workspaceId, projectId),
        category: "Platform" as const,
      },
    ];
  }, [items, projectId, workspaceHref, workspaceId, workspaceName]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((destination) =>
      `${destination.label} ${destination.description} ${destination.category}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [destinations, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!editable && event.key === "/") {
        event.preventDefault();
        setOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const current = items.find((item) => item.id === currentId) ?? items[0];

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Workspace OS command layer</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{projectName} · {current?.label ?? "Project home"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-10 flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-left text-sm text-slate-300 transition hover:border-cyan-300/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-w-72"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              <span className="truncate">Search project tools and modules</span>
            </span>
            <span className="hidden items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline-flex">
              <Command className="h-3 w-3" aria-hidden="true" />K
            </span>
          </button>

          {typeof updateCount === "number" ? (
            <a
              href="#project-reporting-feed"
              aria-label={`${updateCount} project updates. Jump to project reporting feed.`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <BellRing className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <span>{updateCount}</span>
              <span className="sr-only">project updates</span>
            </a>
          ) : null}

          <Link
            href={appendScope("/app/support", workspaceId, projectId)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <Bot className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            AI support
          </Link>

          <div className="flex h-10 items-center rounded-xl border border-white/10 px-0.5">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(82vh,760px)] overflow-hidden border-white/10 bg-slate-950 p-0 text-white sm:max-w-2xl sm:rounded-2xl">
          <DialogHeader className="border-b border-white/10 p-5 pb-4 text-left">
            <div className="flex items-start gap-3 pr-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <DialogTitle className="text-lg text-white">Workspace command center</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-400">
                  Navigate only to routes already available through the authenticated GEM platform. This search does not grant new permissions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 pb-2">
            <label className="relative block">
              <span className="sr-only">Search Workspace OS commands</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search environments, integrations, video, news, support…"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear command search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 pb-5">
            <p role="status" aria-live="polite" className="sr-only">{filtered.length} Workspace OS destinations shown.</p>
            {filtered.length ? (
              <div className="space-y-2" role="list" aria-label="Workspace OS destinations">
                {filtered.map((destination) => {
                  const Icon = destination.id === "platform:video"
                    ? Clapperboard
                    : destination.id === "platform:news"
                      ? Newspaper
                      : destination.id === "platform:integrations"
                        ? Plug
                        : destination.id === "platform:support"
                          ? Bot
                          : Search;

                  return (
                    <Link
                      key={destination.id}
                      href={destination.href}
                      role="listitem"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3.5 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                        destination.id === `environment:${currentId}` && "border-cyan-300/25 bg-cyan-300/[0.05]",
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{destination.label}</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{destination.category}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{destination.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
                <p className="text-sm font-semibold text-white">No command matches this search</p>
                <p className="mt-1 text-xs text-slate-500">Try the environment name, integrations, video, news, or support.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
