"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Loader2, LockKeyhole, Send, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ThreadMessage = {
  id: string;
  message: string;
  actorType: "client" | "staff" | "system";
  actorRole?: string;
  createdAt: string;
};

type TicketState = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string | null;
};

export function SupportCaseConversation({
  ticketId,
  staffMode = false,
  onChanged,
}: {
  ticketId: string;
  staffMode?: boolean;
  onChanged?: () => void;
}) {
  const [ticket, setTicket] = useState<TicketState | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load the support conversation.");
      setTicket(data.ticket);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the support conversation.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send the support message.");
      setDraft("");
      await load(true);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the support message.");
    } finally {
      setSending(false);
    }
  }

  async function updateCase(input: { claim?: boolean; status?: string }) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update the support case.");
      await load(true);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the support case.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…</div>;
  }

  if (!ticket) {
    return <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">{error || "Support case unavailable."}</div>;
  }

  const closed = ticket.status === "resolved" || ticket.status === "closed";
  const humanJoined = Boolean(ticket.assignedTo) || messages.some((item) => item.actorType === "staff");

  return (
    <div className="space-y-4">
      {!closed ? (
        <div
          aria-live="polite"
          className={`flex items-start gap-3 rounded-xl border p-4 ${humanJoined ? "border-emerald-400/20 bg-emerald-400/10" : "border-amber-400/20 bg-amber-400/10"}`}
        >
          {humanJoined ? <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
          <div>
            <p className={`text-sm font-medium ${humanJoined ? "text-emerald-100" : "text-amber-100"}`}>
              {humanJoined ? "Human support conversation active" : "Waiting for a GEM support agent"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {humanJoined
                ? "An authorized support operator has joined this case. Replies here are visible to both you and the support team."
                : "Your transcript is safely attached to the case. This page refreshes automatically and will show when an authorized agent joins."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">{ticket.id}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{ticket.subject}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{ticket.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Badge className="border-white/10 bg-white/10 text-slate-200">{ticket.priority}</Badge>
          <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">{ticket.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      {staffMode ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={sending || closed} onClick={() => void updateCase({ claim: true, status: "in_progress" })}>
            <UserCheck className="mr-2 h-4 w-4" /> Claim case
          </Button>
          <Button size="sm" variant="outline" disabled={sending || closed} onClick={() => void updateCase({ status: "waiting_on_client" })}>
            <Clock3 className="mr-2 h-4 w-4" /> Waiting on client
          </Button>
          <Button size="sm" variant="outline" disabled={sending || closed} onClick={() => void updateCase({ status: "resolved" })}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve
          </Button>
        </div>
      ) : null}

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No conversation updates yet. Your case remains visible to the assigned support queue.</div>
        ) : messages.map((item) => (
          <div key={item.id} className={item.actorType === "system" ? "flex justify-center" : item.actorType === "staff" ? "flex justify-start" : "flex justify-end"}>
            <div className={item.actorType === "system"
              ? "max-w-[92%] rounded-full bg-white/5 px-4 py-2 text-xs text-slate-400"
              : item.actorType === "staff"
                ? "max-w-[88%] rounded-2xl rounded-bl-md border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm text-slate-100"
                : "max-w-[88%] rounded-2xl rounded-br-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-white"}>
              {item.actorType !== "system" ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.actorType === "staff" ? "GEM support" : "Client"}</p> : null}
              <p className="whitespace-pre-wrap leading-6">{item.message}</p>
              <p className="mt-2 text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {closed ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          <LockKeyhole className="h-4 w-4" /> This case is closed. Open a new case if additional support is needed.
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
            rows={4}
            placeholder={staffMode ? "Write a clear support response…" : "Add information or reply to the support team…"}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
          />
          <Button disabled={sending || !draft.trim()} onClick={() => void sendMessage()} className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {sending ? "Sending…" : staffMode ? "Send support response" : "Send case reply"}
          </Button>
        </div>
      )}

      {error ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">{error}</div> : null}
    </div>
  );
}
