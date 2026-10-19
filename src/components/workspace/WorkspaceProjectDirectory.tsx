"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderKanban, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkspaceDirectoryProject {
  id: string;
  name: string;
  summary: string;
  status: string;
  progress: number;
}

export function WorkspaceProjectDirectory({ projects }: { projects: WorkspaceDirectoryProject[] }) {
  const [query, setQuery] = useState("");
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.summary} ${project.status}`.toLocaleLowerCase().includes(normalized),
    );
  }, [projects, query]);

  return (
    <Card id="workspace-projects" className="scroll-mt-20 border-white/10 bg-card">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <FolderKanban className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              Projects
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">Open a dedicated, permission-scoped operating workspace.</p>
          </div>
          {projects.length > 1 ? (
            <label className="relative block sm:w-64">
              <span className="sr-only">Search workspace projects</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/60 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-slate-600 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/25"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  aria-label="Clear project search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </label>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredProjects.length ? (
          filteredProjects.map((project) => (
            <Link
              href={`/app/workspace/projects/${encodeURIComponent(project.id)}`}
              key={project.id}
              className="group block rounded-xl border border-white/10 p-4 transition hover:border-cyan-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              aria-label={`Open ${project.name} project workspace`}
            >
              <div className="flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{project.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{project.summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{project.status}</Badge>
                  <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
                </div>
              </div>
              <div
                className="mt-4 h-2 rounded bg-white/10"
                role="progressbar"
                aria-label={`${project.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={project.progress}
              >
                <div className="h-2 rounded bg-cyan-300" style={{ width: `${project.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{project.progress}% complete · Open project workspace</p>
            </Link>
          ))
        ) : projects.length ? (
          <p role="status" className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">
            No workspace project matches “{query}”.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">
            No project has been added yet. The workspace remains active while setup continues.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
