"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommandCenterSnapshot } from "@/lib/commandCenterSnapshot";
import { commandCenterSnapshotLabels } from "@/lib/commandCenterSnapshot";

type AdminStats = Readonly<{
  totalUsers: number;
  pendingKyc: number;
  openApprovals: number;
  openTickets: number;
}>;

type SnapshotStatus =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; snapshot: CommandCenterSnapshot }
  | { kind: "admin-stats"; stats: AdminStats };

const adminStatsLabels: Array<{ key: keyof AdminStats; label: string; detail: string }> = [
  { key: "totalUsers", label: "User accounts", detail: "Account total from the authorized admin backend" },
  { key: "pendingKyc", label: "Identity review", detail: "KYC cases awaiting or undergoing review" },
  { key: "openApprovals", label: "Approval queue", detail: "Pending manual decision count from admin statistics" },
  { key: "openTickets", label: "Open support", detail: "Open and in-progress support tickets" },
];

function isSnapshot(value: unknown): value is CommandCenterSnapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.source !== "database" || !record.metrics || typeof record.metrics !== "object") return false;
  const metrics = record.metrics as Record<string, unknown>;
  return commandCenterSnapshotLabels.every(({ key }) => typeof metrics[key] === "number" && Number.isFinite(metrics[key]));
}

function isAdminStats(value: unknown): value is AdminStats {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return adminStatsLabels.every(({ key }) =>
    typeof record[key] === "number" && Number.isSafeInteger(record[key]) && (record[key] as number) >= 0
  );
}

/**
 * Tries the full command-center snapshot, then the existing admin statistics
 * gateway when full Prisma aggregates are unavailable. Never fills missing
 * fields with zeroes, merges incompatible sources or changes backend data.
 */
export function SaaSOperationalSnapshot() {
  const [state, setState] = useState<SnapshotStatus>({ kind: "loading" });

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/command-center/snapshot", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      // Authorization failures are terminal: never try alternate pathways
      // to circumvent existing staff controls.
      if (response.status === 401 || response.status === 403) {
        setState({ kind: "unavailable", reason: "Administrator access is required for operational statistics." });
        return;
      }

      if (response.ok) {
        const data: unknown = await response.json();
        if (isSnapshot(data)) {
          setState({ kind: "ready", snapshot: data });
          return;
        }
      }

      // Production may select the Supabase authentication gateway instead of
      // direct Prisma. The admin stats endpoint supports both modes.
      const fallback = await fetch("/api/admin/stats", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (!fallback.ok) {
        setState({ kind: "unavailable", reason: "Neither the full snapshot nor authorized administrator statistics are available. No sample figures are substituted." });
        return;
      }
      const stats: unknown = await fallback.json();
      if (!isAdminStats(stats)) {
        setState({ kind: "unavailable", reason: "The administrator statistics response could not be verified." });
        return;
      }
      setState({ kind: "admin-stats", stats });
    } catch {
      if (!signal?.aborted) {
        setState({ kind: "unavailable", reason: "Operational statistics could not be fetched or verified." });
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return (
    <section aria-labelledby="saas-operational-snapshot" className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="saas-operational-snapshot" className="text-xl font-semibold">Existing platform activity</h2>
          <p className="mt-1 text-sm text-slate-400">Real read-only data from an authorized GEM backend; never a new database or sample metrics.</p>
        </div>
        <button type="button" className="min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm text-cyan-300 hover:bg-white/10" onClick={() => void refresh()}>
          Refresh figures
        </button>
      </div>

      {state.kind === "loading" && <p role="status" className="mt-4 text-sm text-slate-300">Checking authorized operational data…</p>}
      {state.kind === "unavailable" && <p role="status" className="mt-4 rounded-lg border border-amber-500/30 p-4 text-sm text-amber-200">{state.reason}</p>}

      {state.kind === "admin-stats" && (
        <>
          <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4 text-sm leading-6 text-cyan-100">
            Partial statistics from the existing administrator API. This is not the complete operating-layer snapshot; organization, subscription, integration and incident counts remain unverified here.
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {adminStatsLabels.map(({ key, label, detail }) => (
              <div key={key} className="rounded-xl border border-slate-700 bg-slate-950/40 p-5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-3 text-3xl font-bold tabular-nums text-white">{state.stats[key].toLocaleString()}</dd>
                <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
              </div>
            ))}
          </dl>
        </>
      )}

      {state.kind === "ready" && (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {commandCenterSnapshotLabels.map(({ key, label, detail }) => (
              <div key={key} className="rounded-xl border border-slate-700 bg-slate-950/40 p-5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-3 text-3xl font-bold tabular-nums text-white">{state.snapshot.metrics![key].toLocaleString()}</dd>
                <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
              </div>
            ))}
          </dl>
          <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-5">
            <h3 className="text-sm font-semibold">SaaS operating-layer readiness</h3>
            {state.snapshot.operatingLayer.source === "database" && (
              <p className="mt-2 text-sm text-slate-300">Operating-layer aggregate tables were found. This does not certify billing, security coverage, AI tools or external integrations.</p>
            )}
            {state.snapshot.operatingLayer.source === "migration_required" && (
              <p className="mt-2 text-sm text-amber-200">Schema promotion is required for {state.snapshot.operatingLayer.missingTables?.length ?? "unknown"} operating tables. No production migration has been initiated here.</p>
            )}
            {state.snapshot.operatingLayer.source === "unavailable" && (
              <p className="mt-2 text-sm text-amber-200">Operating-layer readiness could not be verified.</p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-400">Database snapshot generated: {Number.isNaN(Date.parse(state.snapshot.generatedAt)) ? "Timestamp unavailable" : new Date(state.snapshot.generatedAt).toLocaleString()}. Provider connectivity must be checked separately.</p>
        </>
      )}
    </section>
  );
}
