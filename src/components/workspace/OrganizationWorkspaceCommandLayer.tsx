"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Building2,
  Clapperboard,
  Command,
  FileText,
  FolderKanban,
  Grid3X3,
  Newspaper,
  Plug,
  Search,
  Sparkles,
  Users,
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

interface OrganizationWorkspaceCommandLayerProps {
  workspaceId: string;
  workspaceName: string;
  projects: Array<{
    id: string;
    name: string;
    summary: string;
    status: string;
    progress: number;
  }>;
  modules: Array<{
    id: string;
    label: string;
    state: string;
  }>;
  updateCount: number;
}

type DestinationCategory = "Workspace" | "Project" | "Module" | "Platform";

interface CommandDestination {
  id: string;
  label: string;
  description: string;
  href: string;
  category: DestinationCategory;
  state?: string;
}

const moduleDestinations: Record<string, string> = {
  projects: "#workspace-projects",
  team: "#workspace-team",
  weekly_updates: "#workspace-weekly-reporting",
  requests: "/app/requests",
  documents: "/app/documents",
  reports: "#workspace-weekly-reporting",
  automations: "/app/ai-services",
  integrations: "/app/integrations",
};

function scoped(href: string, workspaceId: string) {
  if (href.startsWith("#")) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}workspace=${encodeURIComponent(workspaceId)}`;
}

function stateLabel(value?: string) {
  return value?.replaceAll("_", " ") ?? "";
}

export function OrganizationWorkspaceCommandLayer({
  workspaceId,
  workspaceName,
  projects,
  modules,
  updateCount,
}: OrganizationWorkspaceCommandLayerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const destinations = useMemo<CommandDestination[]>(() => {
    const projectItems = projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      description: project.summary || `${project.status} · ${project.progress}% recorded progress`,
      href: `/app/workspace/projects/${encodeURIComponent(project.id)}`,
      category: "Project" as const,
      state: project.status,
    }));

    const moduleItems = modules.map((module) => ({
      id: `module:${module.id}`,
      label: module.label,
      description: module.state === "AVAILABLE"
        ? "Available through this authenticated workspace."
        : module.state === "SETUP_IN_PROGRESS"
          ? "Workspace setup is in progress; provider and permission gates remain authoritative."
          : "Not activated. The module remains fail-closed.",
      href: scoped(moduleDestinations[module.id] ?? "#workspace-os-modules-heading", workspaceId),
      category: "Module" as const,
      state: module.state,
    }));

    return [
      {
        id: "workspace:directory",
        label: "Workspace directory",
        description: "Switch among organizations and workspaces already assigned to this account.",
        href: "#workspace-directory-heading",
        category: "Workspace" as const,
      },
      ...projectItems,
      ...moduleItems,
      {
        id: "platform:integrations",
        label: "Workspace integrations",
        description: "Inspect the membership-safe connector directory and provider activation requirements.",
        href: scoped("/app/integrations", workspaceId),
        category: "Platform" as const,
      },
      {
        id: "platform:video",
        label: "Content & Video Studio",
        description: "Open GEM video creation, preview, approved-media, and publishing controls.",
        href: scoped("/app/social-media/video", workspaceId),
        category: "Platform" as const,
      },
      {
        id: "platform:news",
        label: "News automation",
        description: "Open source ingestion, attributed stories, video discovery, and native news operations.",
        href: scoped("/app/command-center/integrations/news", workspaceId),
        category: "Platform" as const,
      },
      {
        id: "platform:support",
        label: "GEM AI support",
        description: "Open governed AI-assisted platform support and human escalation.",
        href: scoped("/app/support", workspaceId),
        category: "Platform" as const,
      },
    ];
  }, [modules, projects, workspaceId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((destination) =>
      `${destination.label} ${destination.description} ${destination.category} ${destination.state ?? ""}`
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

  function destinationIcon(destination: CommandDestination) {
    if (destination.id === "workspace:directory") return Building2;
    if (destination.id === "platform:integrations") return Plug;
    if (destination.id === "platform:video") return Clapperboard;
    if (destination.id === "platform:news") return Newspaper;
    if (destination.id === "platform:support") return Bot;
    if (destination.category === "Project") return FolderKanban;
    if (destination.id === "module:team") return Users;
    if (destination.id === "module:weekly_updates" || destination.id === "module:reports") return Activity;
    if (destination.id === "module:documents") return FileText;
    return Grid3X3;
  }

  return (
    <>
      <section aria-label="Workspace command layer" className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Workspace OS command layer</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{workspaceName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{projects.length} projects · {modules.length} modules · membership scoped</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex min-h-10 flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-left text-sm text-slate-300 transition hover:border-cyan-300/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-w-80"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span className="truncate">Find projects, modules, tools, and services</span>
              </span>
              <span className="hidden items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline-flex">
                <Command className="h-3 w-3" aria-hidden="true" />K
              </span>
            </button>

            <a
              href="#workspace-weekly-reporting"
              aria-label={`${updateCount} recent workspace reports. Jump to weekly reporting.`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <Activity className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              {updateCount}
              <span className="sr-only">recent reports</span>
            </a>

            <Link
              href={scoped("/app/support", workspaceId)}
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
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(84vh,780px)] overflow-hidden border-white/10 bg-slate-950 p-0 text-white sm:max-w-2xl sm:rounded-2xl">
          <DialogHeader className="border-b border-white/10 p-5 pb-4 text-left">
            <div className="flex items-start gap-3 pr-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <DialogTitle className="text-lg text-white">{workspaceName} command center</DialogTitle>
                <DialogDescription className="mt-1 text-sm leading-6 text-slate-400">
                  Search real projects, authoritative module states, and existing governed GEM surfaces. Visibility here never grants a new role, workspace, provider authorization, or entitlement.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 pb-2">
            <label className="relative block">
              <span className="sr-only">Search workspace commands</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects, modules, integrations, video, news, support…"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear workspace command search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 pb-5">
            <p role="status" aria-live="polite" className="sr-only">{filtered.length} workspace destinations shown.</p>
            {filtered.length ? (
              <div className="space-y-2" role="list" aria-label="Workspace command destinations">
                {filtered.map((destination) => {
                  const Icon = destinationIcon(destination);
                  return (
                    <Link
                      key={destination.id}
                      href={destination.href}
                      role="listitem"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3.5 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{destination.label}</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{destination.category}</span>
                          {destination.state ? (
                            <span className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              destination.state === "AVAILABLE"
                                ? "border-emerald-400/20 text-emerald-300"
                                : destination.state === "SETUP_IN_PROGRESS"
                                  ? "border-cyan-400/20 text-cyan-300"
                                  : "border-amber-400/20 text-amber-300",
                            )}>
                              {stateLabel(destination.state)}
                            </span>
                          ) : null}
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
                <p className="mt-1 text-xs text-slate-500">Try a project name, module, integrations, video, news, or support.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
