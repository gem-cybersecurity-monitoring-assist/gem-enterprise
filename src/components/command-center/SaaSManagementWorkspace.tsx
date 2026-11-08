"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SaaSArea, SaaSCapability, SaaSReadiness } from "@/lib/saasCapabilityCatalog";

type ResponsePayload = {
  schemaVersion: number;
  type: "prelaunch-capability-register";
  runtimeHealthVerified: false;
  capabilities: SaaSCapability[];
};
type LoadingState = "loading" | "ready" | "failed";
const areas: { id: "all" | SaaSArea; title: string }[] = [
  { id: "all", title: "All modules" },
  { id: "owner", title: "Owner & governance" },
  { id: "operations", title: "Operations" },
  { id: "client", title: "Clients" },
  { id: "community", title: "Community" },
  { id: "market", title: "Market & revenue" },
];
const readiness: Record<SaaSReadiness, { label: string; className: string }> = {
  "existing-surface": { label: "Existing route · verify before use", className: "border-cyan-500/40 text-cyan-200" },
  "preview-only": { label: "Interface preview", className: "border-violet-500/40 text-violet-200" },
  "request-only": { label: "Request only", className: "border-amber-500/40 text-amber-200" },
  planned: { label: "Not activated", className: "border-slate-500/40 text-slate-300" },
};

function isCapability(value: unknown): value is SaaSCapability {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "string"
    && typeof c.title === "string"
    && typeof c.description === "string"
    && typeof c.activationGate === "string"
    && ["owner", "operations", "client", "community", "market"].includes(String(c.area))
    && ["existing-surface", "preview-only", "request-only", "planned"].includes(String(c.readiness))
    && (c.href === undefined || (typeof c.href === "string" && c.href.startsWith("/") && !c.href.startsWith("//")));
}
function isResponse(value: unknown): value is ResponsePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.schemaVersion === 1 && v.type === "prelaunch-capability-register"
    && v.runtimeHealthVerified === false && Array.isArray(v.capabilities) && v.capabilities.every(isCapability);
}

export function SaaSManagementWorkspace() {
  const [capabilities, setCapabilities] = useState<SaaSCapability[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<"all" | SaaSArea>("all");
  const [query, setQuery] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<"all" | SaaSReadiness>("all");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadingState("loading");
    setError(null);
    try {
      const response = await fetch("/api/command-center/saas-capabilities", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        setLoadingState("failed");
        setError(response.status === 401 || response.status === 403
          ? "Your account is not authorized to view the SaaS management catalog."
          : "The SaaS management catalog is temporarily unavailable.");
        return;
      }
      const parsed: unknown = await response.json();
      if (!isResponse(parsed)) throw new Error("Invalid catalog response");
      setCapabilities(parsed.capabilities);
      setLoadingState("ready");
    } catch (cause) {
      if (signal?.aborted) return;
      setLoadingState("failed");
      setError("The management catalog could not be verified. No illustrative records are substituted.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return capabilities.filter((item) =>
      (activeArea === "all" || item.area === activeArea)
      && (readinessFilter === "all" || item.readiness === readinessFilter)
      && (!term || [item.title, item.description, item.activationGate, item.id].some((v) => v.toLowerCase().includes(term))),
    );
  }, [capabilities, activeArea, readinessFilter, query]);

  const existingCount = capabilities.filter((item) => item.readiness === "existing-surface").length;
  const requestedCount = capabilities.filter((item) => item.readiness === "request-only").length;
  const gatedCount = capabilities.filter((item) => item.readiness === "preview-only" || item.readiness === "planned").length;

  return (
    <section className="space-y-6" aria-labelledby="saas-management-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="saas-management-title" className="text-xl font-semibold">Management workspaces</h2>
          <p className="mt-1 text-sm text-slate-400">Search and open verified existing routes from one owner interface. All data remains in the original GEM systems.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-cyan-200 hover:bg-slate-800">Reload modules</button>
      </div>
      {loadingState === "loading" && <p role="status" className="rounded-lg border border-slate-700 p-4 text-sm text-slate-300">Loading your authorized management directory…</p>}
      {loadingState === "failed" && <p role="alert" className="rounded-lg border border-amber-500/40 p-4 text-sm text-amber-200">{error}</p>}
      {loadingState === "ready" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3" aria-label="Catalog inventory, not operational uptime">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><p className="text-xs text-slate-400">Existing code routes</p><p className="mt-2 text-2xl font-semibold">{existingCount}</p><p className="mt-1 text-xs text-slate-400">Not a live-service attestation</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><p className="text-xs text-slate-400">Request-only routes</p><p className="mt-2 text-2xl font-semibold">{requestedCount}</p><p className="mt-1 text-xs text-slate-400">No orders or payments</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><p className="text-xs text-slate-400">Preview or planned modules</p><p className="mt-2 text-2xl font-semibold">{gatedCount}</p><p className="mt-1 text-xs text-slate-400">Requires activation review</p></div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by operating area">
              {areas.map((area) => (
                <button type="button" key={area.id} aria-pressed={activeArea === area.id}
                  onClick={() => setActiveArea(area.id)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${activeArea === area.id ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                  {area.title}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_230px]">
              <input aria-label="Search platform modules" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Search services, teams, connectors, approvals…" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none" />
              <select aria-label="Filter module availability" value={readinessFilter}
                onChange={(event) => setReadinessFilter(event.target.value as typeof readinessFilter)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                <option value="all">Every readiness state</option>
                <option value="existing-surface">Existing routes</option>
                <option value="request-only">Request-only</option>
                <option value="preview-only">Preview-only</option>
                <option value="planned">Not activated</option>
              </select>
            </div>
            <p role="status" className="text-xs text-slate-400">Showing {filtered.length} of {capabilities.length} registered modules.</p>
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-slate-700 p-6 text-sm text-slate-300">No modules match this filter. Reset the search or choose another operating area.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-5">
                  <p className={`self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold ${readiness[item.readiness].className}`}>{readiness[item.readiness].label}</p>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm leading-6 text-slate-300">{item.description}</p>
                  <p className="text-xs leading-5 text-slate-400"><span className="font-semibold text-slate-200">Required:</span> {item.activationGate}</p>
                  <div className="mt-auto pt-2">
                    {item.href
                      ? <Link href={item.href} className="inline-flex rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25">Open existing workspace</Link>
                      : <span className="text-xs font-semibold text-slate-400">No live destination</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
