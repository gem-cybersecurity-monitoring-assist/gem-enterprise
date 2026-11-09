"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";

type Status = "open" | "in_progress" | "pending_info" | "completed" | "cancelled";
type RequestItem = {
  id: string;
  subject: string;
  type: string;
  status: Status;
  priority: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string };
  workspace: { name: string; organization: { name: string } } | null;
};
type ListResponse = { ok: true; items: RequestItem[]; total: number; page: number; pageSize: number };
type State = { kind: "loading" } | { kind: "error"; error: string } | { kind: "ready"; data: ListResponse };

const transitions: Record<Status, readonly Status[]> = {
  open: ["in_progress", "pending_info", "cancelled"],
  in_progress: ["pending_info", "completed", "cancelled"],
  pending_info: ["in_progress", "completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: [],
};
const statuses: readonly Status[] = ["open", "in_progress", "pending_info", "completed", "cancelled"];

function isRecord(value: unknown): value is RequestItem {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.subject === "string" && typeof r.type === "string"
    && statuses.includes(r.status as Status) && typeof r.priority === "string"
    && (r.assignedTo === null || typeof r.assignedTo === "string")
    && typeof r.createdAt === "string"
    && !!r.user && typeof (r.user as Record<string, unknown>).email === "string";
}
function isResponse(value: unknown): value is ListResponse {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return r.ok === true && Array.isArray(r.items) && r.items.every(isRecord)
    && typeof r.total === "number" && Number.isFinite(r.total)
    && typeof r.page === "number" && typeof r.pageSize === "number";
}

export function SaaSServiceQueue() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<"all" | Status>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<Status | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "12" });
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      const response = await fetch(`/api/admin/requests?${params.toString()}`, {
        credentials: "same-origin", cache: "no-store", signal,
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? "Administrator authorization is required." : "The service request queue is unavailable.");
      const body: unknown = await response.json();
      if (!isResponse(body)) throw new Error("Service request data could not be verified.");
      setState({ kind: "ready", data: body });
    } catch (error) {
      if (!signal?.aborted) setState({ kind: "error", error: error instanceof Error ? error.message : "Unable to read service requests." });
    }
  }, [page, selectedStatus]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selected = state.kind === "ready" ? state.data.items.find((item) => item.id === selectedId) : undefined;

  async function save() {
    if (!selected || !nextStatus || saving || !transitions[selected.status].includes(nextStatus)) return;
    setWriteError(null);
    setSaved(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/requests/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", toStatus: nextStatus, note: note.trim() || undefined }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "The server rejected this transition.";
        throw new Error(message);
      }
      setSaved("The server recorded the case transition and its audit event.");
      setSelectedId(null);
      setNextStatus("");
      setNote("");
      await load();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "Unable to save the change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="service-queue-heading" className="space-y-7" data-testid="saas-service-queue">
      <header className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[linear-gradient(125deg,#0b2537,#071226)] px-6 py-10 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">GEM SaaS · Live service delivery</p>
        <h1 id="service-queue-heading" className="mt-4 text-4xl font-bold text-white sm:text-5xl">Customer service operations</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">Work with real cases in the existing GEM database. Review their priority, organizational scope, current status and authorized transitions.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/app/admin/requests" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/30 px-4 py-2 text-sm font-bold text-cyan-200">Advanced request administration <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/app/command-center/saas/readiness" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300">Backend readiness</Link>
        </div>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="space-y-2 text-sm text-slate-300"><span className="block font-medium">Case status</span>
          <select value={selectedStatus} onChange={(event) => { setPage(1); setSelectedStatus(event.target.value as typeof selectedStatus); setSelectedId(null); }}
            className="min-h-12 min-w-52 rounded-xl border border-white/20 bg-slate-950 px-4 text-slate-100">
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Refresh list</button>
      </div>
      {state.kind === "loading" && <p role="status" className="rounded-2xl border border-white/10 p-7 text-slate-300">Reading authorized service cases…</p>}
      {state.kind === "error" && <p role="alert" className="rounded-2xl border border-rose-400/25 p-7 text-rose-200">{state.error}</p>}
      {saved && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{saved}</p>}
      {state.kind === "ready" && (
        <>
          <p className="text-sm text-slate-400">{state.data.total} real case records matching the selected filter. Displaying page {page}.</p>
          {state.data.items.length === 0 ? (
            <p className="rounded-2xl border border-white/10 p-8 text-slate-300">No cases found for this filter. This is a live empty queue, not a seeded example.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {state.data.items.map((item) => (
                <article key={item.id} className="flex min-h-[260px] flex-col rounded-[26px] border border-white/10 bg-slate-900/70 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-cyan-300">{item.type.replaceAll("_", " ")}</span>
                    <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">{item.status.replaceAll("_", " ")}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-white">{item.subject}</h2>
                  <p className="mt-3 text-sm text-slate-400">Priority: {item.priority} · {item.workspace?.organization.name ?? "Personal request"}</p>
                  <p className="mt-2 break-all text-xs text-slate-400">Requested by: {item.user.email}</p>
                  <p className="mt-2 text-xs text-slate-500">Created: {Number.isNaN(Date.parse(item.createdAt)) ? "Unknown" : new Date(item.createdAt).toLocaleString()}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-6">
                    {transitions[item.status].length > 0
                      ? <button type="button" onClick={() => { setSelectedId(item.id); setNextStatus(""); setNote(""); setWriteError(null); }} className="min-h-11 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20">Manage status</button>
                      : <span className="inline-flex items-center text-sm text-slate-500">No further transition permitted</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={page <= 1} onClick={() => { setPage((current) => Math.max(1, current - 1)); setSelectedId(null); }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-35"><ChevronLeft className="h-4 w-4" /> Previous</button>
            <span className="text-sm text-slate-400">Page {page} of {Math.max(1, Math.ceil(state.data.total / state.data.pageSize))}</span>
            <button type="button" disabled={page >= Math.ceil(state.data.total / state.data.pageSize)} onClick={() => { setPage((current) => current + 1); setSelectedId(null); }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-35">Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </>
      )}
      {selected && (
        <section aria-label="Review case status update" className="rounded-[28px] border border-amber-400/25 bg-slate-950 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-amber-200"><ClipboardList className="h-5 w-5" /><h2 className="text-xl font-semibold">Confirm a case transition</h2></div>
          <p className="text-sm text-slate-300">Case: <strong>{selected.subject}</strong> · Current status: {selected.status.replaceAll("_", " ")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300"><span className="block font-medium">New status</span>
              <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as Status | "")} className="min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-4 text-slate-100">
                <option value="">Select an allowed transition</option>
                {transitions[selected.status].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300"><span className="block font-medium">Audit note (optional)</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-slate-100" placeholder="Reason for this status change" />
            </label>
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-400">This action writes a real audited lifecycle change. The backend independently checks your role, same-origin protection, allowed status transition and write rate limit. No change occurs until you select Save.</p>
          {writeError && <p role="alert" className="mt-3 text-sm text-rose-200">{writeError}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={!nextStatus || saving} onClick={() => void save()} className="min-h-12 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{saving ? "Saving…" : "Save audited transition"}</button>
            <button type="button" onClick={() => { setSelectedId(null); setWriteError(null); }} className="min-h-12 rounded-xl border border-white/20 px-5 py-3 text-sm text-slate-200">Cancel</button>
          </div>
        </section>
      )}
    </section>
  );
}
