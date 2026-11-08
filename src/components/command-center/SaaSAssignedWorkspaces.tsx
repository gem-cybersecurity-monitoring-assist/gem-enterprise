"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  organization: { id: string; name: string };
  role: { name: string };
  counts: { members: number; connectors: number; approvalRecords: number };
  controls: {
    globalEmergencyLock: boolean;
    connectorDisabled: boolean;
    publishingDisabled: boolean;
    advertisingDisabled: boolean;
    shopWriteDisabled: boolean;
  };
};
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: Workspace[] };

function validWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Record<string, unknown>;
  const o = w.organization as Record<string, unknown> | undefined;
  const role = w.role as Record<string, unknown> | undefined;
  const counts = w.counts as Record<string, unknown> | undefined;
  const controls = w.controls as Record<string, unknown> | undefined;
  return typeof w.id === "string" && typeof w.name === "string"
    && !!o && typeof o.name === "string" && !!role && typeof role.name === "string"
    && !!counts && typeof counts.members === "number" && typeof counts.connectors === "number"
    && typeof counts.approvalRecords === "number"
    && !!controls && typeof controls.globalEmergencyLock === "boolean"
    && typeof controls.connectorDisabled === "boolean";
}

export function SaaSAssignedWorkspaces() {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      try {
        const response = await fetch("/api/workspaces", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Workspace access unavailable.");
        const body: unknown = await response.json();
        const record = body as { workspaces?: unknown } | null;
        if (!record || !Array.isArray(record.workspaces) || !record.workspaces.every(validWorkspace)) {
          throw new Error("Workspace information could not be validated.");
        }
        setState({ status: "ready", workspaces: record.workspaces });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: "Assigned workspaces could not be verified. Use the authorized Workspace Access screen to manage organization membership." });
        }
      }
    };
    void read();
    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="assigned-workspaces-title" className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="assigned-workspaces-title" className="text-xl font-semibold">My assigned organization workspaces</h2>
          <p className="mt-1 text-sm text-slate-400">Membership-scoped data from GEM Workspace OS. Platform-wide ownership uses a separate privileged access screen.</p>
        </div>
        <Link href="/app/admin/workspace-access" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-slate-800">
          Workspace access administration
        </Link>
      </div>
      {state.status === "loading" && <p role="status" className="mt-4 text-sm text-slate-300">Loading authorized organization workspaces…</p>}
      {state.status === "error" && <p role="alert" className="mt-4 text-sm text-amber-200">{state.message}</p>}
      {state.status === "ready" && (
        state.workspaces.length === 0 ? (
          <p className="mt-4 rounded-lg border border-slate-700 p-4 text-sm text-slate-300">No active membership-scoped workspaces are assigned to this session. This does not mean the enterprise has no organizations.</p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {state.workspaces.map((workspace) => {
              const restrictions = [
                workspace.controls.globalEmergencyLock && "Emergency lock",
                workspace.controls.connectorDisabled && "Connectors disabled",
                workspace.controls.publishingDisabled && "Publishing disabled",
                workspace.controls.advertisingDisabled && "Advertising disabled",
                workspace.controls.shopWriteDisabled && "Shop writes disabled",
              ].filter(Boolean);
              return (
                <article key={workspace.id} className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{workspace.organization.name}</p>
                  <h3 className="mt-1 text-lg font-semibold">{workspace.name}</h3>
                  <p className="text-xs text-slate-400">Assigned role: {workspace.role.name}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Members", workspace.counts.members],
                      ["Connectors", workspace.counts.connectors],
                      ["Approvals", workspace.counts.approvalRecords],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-800 p-2">
                        <dt className="text-[11px] text-slate-400">{label}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {restrictions.length > 0 && <p className="mt-3 text-xs leading-5 text-amber-200">{restrictions.join(" · ")}</p>}
                  <Link href={`/app/workspace?workspace=${encodeURIComponent(workspace.id)}`} className="mt-4 inline-flex rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25">
                    Open assigned workspace
                  </Link>
                </article>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}
