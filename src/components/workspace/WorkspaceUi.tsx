"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, LayoutGrid, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared workspace client primitives: breadcrumb/back navigation, honest
 * empty states with real next actions, and error/retry states. Every call to
 * action must resolve to a real route or a real form focus — never a dead end.
 */

export function WorkspaceBreadcrumb({
  current,
  workspaceHref = "/app/workspace",
}: {
  current: string;
  workspaceHref?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <li>
          <Link
            href={workspaceHref}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-medium text-slate-400 transition hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            Workspace
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li aria-current="page" className="font-semibold text-slate-200">
          {current}
        </li>
      </ol>
    </nav>
  );
}

export function WorkspaceEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  /** A real next action: link to a route or a button that focuses a form. */
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center sm:p-8">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function WorkspaceErrorState({
  title = "Something went wrong",
  description = "This section could not be loaded. Your data is safe — try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center sm:p-8" role="alert">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">{description}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        ) : null}
        <Link
          href="/app/support"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
