"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, Database,
  LockKeyhole, RefreshCcw, ShieldAlert, Wrench, type LucideIcon,
} from "lucide-react";
import type {
  SaaSReadinessArea, SaaSReadinessItem, SaaSReadinessReport, SaaSReadinessState,
} from "@/lib/saasRuntimeReadiness";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; report: SaaSReadinessReport };

const areaNames: Record<SaaSReadinessArea, string> = {
  platform: "Platform & database",
  tenants: "Organizations",
  services: "Service delivery",
  social: "Social & integrations",
  community: "Community",
  marketplace: "Marketplace",
  billing: "Billing",
};
const areas: SaaSReadinessArea[] = ["platform", "tenants", "services", "social", "community", "marketplace", "billing"];
const status: Record<SaaSReadinessState, { label: string; classes: string; icon: LucideIcon }> = {
  VERIFIED_READ_ONLY: { label: "Read-only check passed", classes: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200", icon: CheckCircle2 },
  PARTIAL: { label: "More verification needed", classes: "border-amber-400/25 bg-amber-400/10 text-amber-200", icon: AlertTriangle },
  MIGRATION_REQUIRED: { label: "Database work required", classes: "border-amber-400/25 bg-amber-400/10 text-amber-200", icon: Database },
  CONFIGURATION_REQUIRED: { label: "Connection work required", classes: "border-amber-400/25 bg-amber-400/10 text-amber-200", icon: Wrench },
  APPROVAL_REQUIRED: { label: "Approval required", classes: "border-amber-400/25 bg-amber-400/10 text-amber-200", icon: LockKeyhole },
  NOT_ACTIVATED: { label: "Not active", classes: "border-slate-500/25 bg-slate-400/10 text-slate-300", icon: LockKeyhole },
  UNAVAILABLE: { label: "Check unavailable", classes: "border-rose-400/25 bg-rose-400/10 text-rose-200", icon: ShieldAlert },
};

function validReport(value: unknown): value is SaaSReadinessReport {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  if (r.schemaVersion !== 1 || r.source !== "live-read-only-probes" ||
      r.externalActionTaken !== false || r.statusMeaning !== "not-a-launch-certification" ||
      typeof r.generatedAt !== "string" || !Array.isArray(r.items)) return false;
  return r.items.every((value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.label === "string"
      && typeof item.evidence === "string" && typeof item.nextAction === "string"
      && areas.includes(item.area as SaaSReadinessArea)
      && Object.keys(status).includes(String(item.state))
      && typeof item.href === "string" && item.href.startsWith("/") && !item.href.startsWith("//");
  });
}

export function SaaSBackendReadinessBoard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [filter, setFilter] = useState<SaaSReadinessArea | "all">("all");
  const [onlyAttention, setOnlyAttention] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/command-center/saas-readiness", {
        cache: "no-store", credentials: "same-origin", signal,
      });
      if (!response.ok) {
        setState({ kind: "error", message: response.status === 401 || response.status === 403
          ? "An active GEM administrator session is required to inspect backend readiness."
          : "Backend verification is unavailable; no systems are marked ready." });
        return;
      }
      const body: unknown = await response.json();
      if (!validReport(body)) throw new Error("Unexpected readiness contract");
      setState({ kind: "ready", report: body });
    } catch {
      if (!signal?.aborted) setState({ kind: "error", message: "The readiness report could not be verified. No inferred success is shown." });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const items = useMemo(() => state.kind === "ready" ? state.report.items : [], [state]);
  const verified = items.filter((item) => item.state === "VERIFIED_READ_ONLY").length;
  const blocked = items.filter((item) => item.state !== "VERIFIED_READ_ONLY").length;
  const visible = useMemo(() => items.filter((item) =>
    (filter === "all" || item.area === filter) &&
    (!onlyAttention || item.state !== "VERIFIED_READ_ONLY"),
  ), [filter, items, onlyAttention]);

  return (
    <div className="space-y-8" data-testid="saas-backend-readiness">
      <header className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,.13),transparent_42%),linear-gradient(125deg,#0b1e32,#080f20)] px-6 py-10 sm:px-10 lg:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[.21em] text-cyan-300">GEM SaaS · Technical Operations</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">Backend completion center</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">See what has been checked, where the evidence stops, and what needs implementation. All checks are read-only and retain the existing GEM approval boundaries.</p>
          </div>
          <button type="button" onClick={() => void refresh()}
            className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Run checks again
          </button>
        </div>
      </header>

      {state.kind === "loading" && <div role="status" className="rounded-2xl border border-white/10 p-8 text-slate-300">Checking existing backend evidence…</div>}
      {state.kind === "error" && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-7 text-rose-200">{state.message}</div>}
      {state.kind === "ready" && (
        <>
          <section className="grid gap-5 md:grid-cols-3" aria-label="Readiness evidence, not launch status">
            <div className="rounded-[26px] border border-white/10 bg-slate-900/70 p-7">
              <p className="text-sm font-medium text-slate-400">Areas assessed</p>
              <p className="mt-4 text-5xl font-bold text-white">{items.length}</p>
              <p className="mt-3 text-xs leading-5 text-slate-400">Read-only checks and stated product activation gates</p>
            </div>
            <div className="rounded-[26px] border border-emerald-400/20 bg-emerald-400/[.055] p-7">
              <p className="text-sm font-medium text-emerald-200">Read-only evidence passed</p>
              <p className="mt-4 text-5xl font-bold text-white">{verified}</p>
              <p className="mt-3 text-xs leading-5 text-slate-400">Not complete end-to-end certification</p>
            </div>
            <div className="rounded-[26px] border border-amber-400/20 bg-amber-400/[.055] p-7">
              <p className="text-sm font-medium text-amber-200">Still requires work</p>
              <p className="mt-4 text-5xl font-bold text-white">{blocked}</p>
              <p className="mt-3 text-xs leading-5 text-slate-400">Includes unverified and intentionally unactivated functions</p>
            </div>
          </section>
          <section className="space-y-5" aria-labelledby="backend-next-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="backend-next-heading" className="text-2xl font-bold text-white sm:text-3xl">Verification and implementation work</h2>
                <p className="mt-2 text-sm text-slate-400">Choose a department, then open its authoritative workspace to resolve the next requirement.</p>
              </div>
              <div className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400">Checked {Number.isNaN(Date.parse(state.report.generatedAt)) ? "at an unknown time" : new Date(state.report.generatedAt).toLocaleString()}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${filter === "all" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-300"}`}>All areas</button>
              {areas.map((area) => <button key={area} type="button" aria-pressed={filter === area} onClick={() => setFilter(area)}
                className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${filter === area ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-300"}`}>{areaNames[area]}</button>)}
            </div>
            <label className="inline-flex min-h-10 items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={onlyAttention} onChange={(event) => setOnlyAttention(event.target.checked)} className="h-4 w-4 accent-cyan-400" /> Show only items requiring attention</label>
            {visible.length === 0 && <p className="rounded-xl border border-white/10 p-6 text-sm text-slate-300">No items match these filters. Show all evidence to review the complete report.</p>}
            <div className="grid gap-5 xl:grid-cols-2">
              {visible.map((item: SaaSReadinessItem) => {
                const info = status[item.state];
                const Icon = info.icon;
                return (
                  <article key={item.id} className="flex min-h-[315px] flex-col rounded-[28px] border border-white/10 bg-slate-900/65 p-7 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[.13em] text-cyan-300">{areaNames[item.area]}</span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${info.classes}`}><Icon className="h-4 w-4" aria-hidden="true" />{info.label}</span>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-white sm:text-2xl">{item.label}</h3>
                    <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                      <p><strong className="text-slate-100">Evidence:</strong> {item.evidence}</p>
                      <p><strong className="text-slate-100">Next step:</strong> {item.nextAction}</p>
                    </div>
                    <div className="mt-auto border-t border-white/10 pt-6">
                      <Link href={item.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20">
                        Open relevant workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <footer className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-5 text-sm leading-7 text-slate-400">
            <CircleHelp className="mt-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
            An authenticated aggregate or provider health probe does not certify live tenant provisioning, payment processing, staffing, legal compliance or customer acceptance. No migrations, purchases or external writes were made by this report.
          </footer>
        </>
      )}
    </div>
  );
}
