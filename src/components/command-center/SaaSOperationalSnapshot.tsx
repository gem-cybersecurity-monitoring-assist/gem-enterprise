"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommandCenterSnapshot } from "@/lib/commandCenterSnapshot";
import { commandCenterSnapshotLabels } from "@/lib/commandCenterSnapshot";

type SnapshotStatus =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; snapshot: CommandCenterSnapshot };

function isSnapshot(value: unknown): value is CommandCenterSnapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.source !== "database" || !record.metrics || typeof record.metrics !== "object") return false;
  const metrics = record.metrics as Record<string, unknown>;
  return commandCenterSnapshotLabels.every(({ key }) => typeof metrics[key] === "number" && Number.isFinite(metrics[key]));
}

/** Read-only display; never writes to the database or changes operational gates. */
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
      if (!response.ok) {
        setState({ kind: "unavailable", reason: "The operational snapshot is unavailable or access is not authorized." });
        return;
      }
      const data: unknown = await response.json();
      if (!isSnapshot(data)) {
        setState({ kind: "unavailable", reason: "No verified database snapshot is available. No sample figures are substituted." });
        return;
      }
      setState({ kind: "ready", snapshot: data });
    } catch (error) {
      if (signal?.aborted) return;
      setState({ kind: "unavailable", reason: "The operational snapshot could not be fetched." });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return (
    <section aria-labelledby="saas-operational-snapshot" className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="saas-operational-snapshot" className="text-xl font-semibold">Existing platform activity</h2>
          <p className="text-sm text-slate-400">Read-only aggregates from the existing command-center backend, not a new database.</p>
        </div>
        <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-cyan-300 hover:bg-white/10" onClick={() => void refresh()}>
          Refresh snapshot
        </button>
      </div>
      {state.kind === "loading" && <p role="status" className="mt-4 text-sm text-slate-300">Checking authorized snapshot…</p>}
      {state.kind === "unavailable" && <p role="status" className="mt-4 rounded-lg border border-amber-500/30 p-4 text-sm text-amber-200">{state.reason}</p>}
      {state.kind === "ready" && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commandCenterSnapshotLabels.map(({ key, label, detail }) => (
              <div key={key} className="rounded-lg border border-slate-700 p-3">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">{state.snapshot.metrics![key].toLocaleString()}</dd>
                <p className="mt-1 text-xs text-slate-400">{detail}</p>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 p-4">
            <h3 className="text-sm font-semibold">SaaS operating-layer readiness</h3>
            {state.snapshot.operatingLayer.source === "database" && (
              <p className="mt-2 text-sm text-slate-300">Operating-layer aggregate tables were found. This does not certify the activation of billing, security coverage, AI tools or external integrations.</p>
            )}
            {state.snapshot.operatingLayer.source === "migration_required" && (
              <p className="mt-2 text-sm text-amber-200">
                Schema promotion is required for {state.snapshot.operatingLayer.missingTables?.length ?? "unknown"} operating tables.
                No production database migration has been initiated from this dashboard.
              </p>
            )}
            {state.snapshot.operatingLayer.source === "unavailable" && (
              <p className="mt-2 text-sm text-amber-200">Operating-layer readiness could not be verified.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">Database snapshot generated: {Number.isNaN(Date.parse(state.snapshot.generatedAt)) ? "Timestamp unavailable" : new Date(state.snapshot.generatedAt).toLocaleString()}. This view does not attest to external provider connectivity.</p>
        </>
      )}
    </section>
  );
}
