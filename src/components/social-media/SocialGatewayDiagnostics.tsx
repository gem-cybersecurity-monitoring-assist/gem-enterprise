"use client";

import { useEffect, useRef, useState } from "react";
import type { GatewayDiagnostic } from "@/lib/social-media/publishing/gateway-diagnostics";

export function SocialGatewayDiagnostics() {
  const [checking, setChecking] = useState(false);
  const [diagnostic, setDiagnostic] = useState<GatewayDiagnostic>();
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function checkGateway() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setChecking(true);
    setDiagnostic(undefined);
    setError(undefined);
    try {
      const response = await fetch("/api/social-media/gateway-health", { method: "POST", cache: "no-store", signal: request.signal });
      if (response.status === 401 || response.status === 403) throw new Error("An active platform owner session is required for this check.");
      const payload = await response.json();
      if (!payload || !["HEALTHY", "SETUP_REQUIRED", "AUTHENTICATION_FAILED", "INCOMPLETE_RPC_INVENTORY", "UNAVAILABLE"].includes(payload.state)) {
        throw new Error("Gateway diagnostics could not be read. Try again.");
      }
      if (!request.signal.aborted) setDiagnostic(payload);
    } catch (caught) {
      if (!request.signal.aborted) setError(caught instanceof Error ? caught.message : "Gateway diagnostics could not complete.");
    } finally {
      if (!request.signal.aborted) setChecking(false);
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-card/75 p-5" aria-label="Owner gateway diagnostics">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Check publishing gateway connection</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Owner-only health check using the server credential. Works while publishing is disabled. It does not create jobs, publish content or change activation controls.</p>
        </div>
        <button type="button" disabled={checking} onClick={checkGateway} className="min-h-11 shrink-0 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50">
          {checking ? "Checking gateway…" : "Check gateway connection"}
        </button>
      </div>
      <div aria-live="polite" className="mt-4 space-y-2 text-sm">
        {!diagnostic && !checking && !error && <p className="text-slate-400">Not checked in this view.</p>}
        {checking && <p className="text-cyan-200">Checking authentication and database function inventory…</p>}
        {error && <p className="text-amber-200">{error}</p>}
        {diagnostic && <div className="space-y-2 rounded-xl border border-white/10 p-4">
          <p className={diagnostic.state === "HEALTHY" ? "font-semibold text-emerald-200" : "font-semibold text-amber-200"}>{diagnostic.state.replaceAll("_", " ")}</p>
          <p className="text-slate-300">{diagnostic.message}</p>
          <p className="text-xs text-slate-400">Database functions: {diagnostic.rpcCount ?? "not verified"} / {diagnostic.expectedRpcCount} required</p>
          <p className="text-xs text-slate-400">Adapter flag: {diagnostic.adapterEnabled ? "on" : "off"} · Live publishing flag: {diagnostic.livePublishingEnabled ? "on" : "off"}</p>
          <p className="text-xs text-slate-400">Checked: <time dateTime={diagnostic.checkedAt}>{new Date(diagnostic.checkedAt).toLocaleString()}</time></p>
          <p className="text-xs text-slate-400">This result does not grant permission to publish.</p>
        </div>}
      </div>
    </section>
  );
}
