"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronDown, Clock3, RefreshCcw } from "lucide-react";

type TimelineEvent = { kind: "created" | "assigned" | "status_changed"; occurredAt: string; status?: string };
type TimelinePayload = {
  ok: true;
  requestId: string;
  currentStatus: string;
  events: TimelineEvent[];
  historyLimitedTo: number;
};
type State = { kind: "loading" } | { kind: "error"; error: string } | { kind: "ready"; data: TimelinePayload };

function isPayload(value: unknown, requestId: string): value is TimelinePayload {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.ok === true && data.requestId === requestId
    && typeof data.currentStatus === "string" && data.historyLimitedTo === 100
    && Array.isArray(data.events) && data.events.every((event: unknown) => {
      if (!event || typeof event !== "object") return false;
      const item = event as Record<string, unknown>;
      return ["created", "assigned", "status_changed"].includes(String(item.kind))
        && typeof item.occurredAt === "string";
    });
}

function label(event: TimelineEvent) {
  if (event.kind === "created") return "Request submitted";
  if (event.kind === "assigned") return "Assigned for review";
  if (event.status === "pending_info") return "More information needed";
  if (event.status === "in_progress") return "Work in progress";
  if (event.status === "completed") return "Request completed";
  if (event.status === "cancelled") return "Request cancelled";
  return "Status updated";
}

export function RequestTimeline({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const load = async () => {
      setState({ kind: "loading" });
      try {
        const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}/timeline`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 || response.status === 404
          ? "The request history is not available to this account."
          : "The request history could not be loaded.");
        const body: unknown = await response.json();
        if (!isPayload(body, requestId)) throw new Error("Request history could not be verified.");
        if (!controller.signal.aborted) setState({ kind: "ready", data: body });
      } catch (error) {
        if (!controller.signal.aborted) setState({ kind: "error", error: error instanceof Error ? error.message : "History unavailable." });
      }
    };
    void load();
    return () => controller.abort();
  }, [open, requestId, revision]);

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">
        <Activity className="h-4 w-4" aria-hidden="true" />
        {open ? "Hide request history" : "View request history"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-4">
          {state.kind === "loading" && <p role="status" className="text-xs text-slate-300">Loading your request history…</p>}
          {state.kind === "error" && (
            <div role="alert" className="space-y-2 text-xs text-amber-200">
              <p>{state.error}</p>
              <button type="button" className="inline-flex min-h-9 items-center gap-2 text-cyan-300" onClick={() => setRevision((value) => value + 1)}>
                <RefreshCcw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}
          {state.kind === "ready" && (
            <>
              {state.data.events.length === 0 ? (
                <p className="text-xs text-slate-400">No recorded history events are available for this request.</p>
              ) : (
                <ol className="space-y-4" aria-label="Service request activity">
                  {state.data.events.map((event, index) => (
                    <li key={`${event.kind}-${event.occurredAt}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-200">{label(event)}</p>
                        <p className="mt-1 text-xs text-slate-400">{Number.isNaN(Date.parse(event.occurredAt)) ? "Time not available" : new Date(event.occurredAt).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {state.data.events.length >= state.data.historyLimitedTo && (
                <p className="mt-4 text-xs text-amber-200">Showing the earliest 100 recorded events. Additional records may exist.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
