"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Plug,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface WorkspaceDirectoryItem {
  id: string;
  name: string;
  organization: { name: string };
  role: { name: string; description?: string | null };
  counts: {
    members: number;
    connectors: number;
    approvalRecords: number;
  };
}

interface WorkspaceDirectoryProps {
  workspaces: WorkspaceDirectoryItem[];
  selectedId?: string | null;
}

export function WorkspaceDirectory({ workspaces, selectedId = null }: WorkspaceDirectoryProps) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalized
        ? workspaces.filter((workspace) =>
            `${workspace.organization.name} ${workspace.name} ${workspace.role.name}`
              .toLowerCase()
              .includes(normalized),
          )
        : workspaces,
    [normalized, workspaces],
  );

  return (
    <section aria-labelledby="workspace-directory-heading" className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Workspace OS</p>
          <h2 id="workspace-directory-heading" className="mt-1 text-lg font-bold text-white sm:text-xl">
            Workspace directory
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Choose one of the workspaces assigned to this account. Search changes only this directory view and never grants workspace access.
          </p>
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Search assigned workspaces</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organization or workspace"
            className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((workspace) => {
          const active = Boolean(selectedId && workspace.id === selectedId);
          return (
            <Link
              key={workspace.id}
              href={`/app/workspace?workspace=${encodeURIComponent(workspace.id)}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group rounded-2xl border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                active
                  ? "border-cyan-300/35 bg-cyan-300/[0.08] shadow-[0_12px_34px_rgba(34,211,238,.08)]"
                  : "border-white/10 bg-black/15 hover:border-cyan-300/25 hover:bg-white/[0.025]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10">
                  <Building2 aria-hidden="true" className="h-5 w-5 text-cyan-300" />
                </span>
                {active ? (
                  <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Current
                  </Badge>
                ) : (
                  <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 text-slate-600 transition group-hover:text-cyan-300" />
                )}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {workspace.organization.name}
              </p>
              <h3 className="mt-1 line-clamp-2 font-bold text-white">{workspace.name}</h3>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
                <span>{workspace.role.name}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
                <div><Users aria-hidden="true" className="mx-auto h-3.5 w-3.5 text-slate-500" /><strong className="mt-1 block text-sm text-white">{workspace.counts.members}</strong><span className="text-[10px] text-slate-600">Members</span></div>
                <div><Plug aria-hidden="true" className="mx-auto h-3.5 w-3.5 text-slate-500" /><strong className="mt-1 block text-sm text-white">{workspace.counts.connectors}</strong><span className="text-[10px] text-slate-600">Connectors</span></div>
                <div><ClipboardList aria-hidden="true" className="mx-auto h-3.5 w-3.5 text-slate-500" /><strong className="mt-1 block text-sm text-white">{workspace.counts.approvalRecords}</strong><span className="text-[10px] text-slate-600">Approvals</span></div>
              </div>
            </Link>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center">
          <p className="font-medium text-white">No assigned workspace matches “{query}”.</p>
          <button type="button" onClick={() => setQuery("")} className="mt-2 rounded text-sm font-semibold text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
