"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  HeadphonesIcon,
  LifeBuoy,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportCaseConversation } from "@/components/support/SupportCaseConversation";

type TicketRecord = {
  id: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
};

const supportTopics = [
  { label: "Account Access", description: "Login, profile, authentication, and access issues.", value: "account_access" },
  { label: "KYC / Compliance", description: "Verification, documents, decisions, and disclosures.", value: "kyc_compliance" },
  { label: "Portfolio Operations", description: "Portfolio visibility, reporting, allocations, and statements.", value: "portfolio_operations" },
  { label: "ATR Property Trust", description: "Real estate trust, consultation, and document readiness.", value: "atr_property_trust" },
  { label: "Cyber Briefing", description: "Intelligence briefing, exposure review, and escalation.", value: "cyber_briefing" },
  { label: "General Support", description: "Other operational support and service desk requests.", value: "general_support" },
];

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value === "resolved" || value === "closed") return "border-green-500/25 bg-green-500/15 text-green-400";
  if (value === "in_progress") return "border-cyan-500/25 bg-cyan-500/15 text-cyan-400";
  if (value === "waiting_on_client") return "border-yellow-500/25 bg-yellow-500/15 text-yellow-400";
  return "border-white/10 bg-white/10 text-slate-300";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [topic, setTopic] = useState("general_support");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [canOperate, setCanOperate] = useState(false);

  async function loadTickets() {
    setLoading(true);
    try {
      const response = await fetch("/api/support", { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        setSelectedTicketId((current) => {
          if (current) return current;
          if (typeof window !== "undefined") {
            const requested = new URLSearchParams(window.location.search).get("ticket");
            if (requested && data.tickets.some((ticket: TicketRecord) => ticket.id === requested)) return requested;
          }
          return null;
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
    void fetch("/api/support/operations", { cache: "no-store" })
      .then((response) => setCanOperate(response.ok))
      .catch(() => setCanOperate(false));
  }, []);

  const summary = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((item) => item.status === "open").length,
    inProgress: tickets.filter((item) => item.status === "in_progress").length,
    resolved: tickets.filter((item) => item.status === "resolved" || item.status === "closed").length,
  }), [tickets]);

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description: `[${formatLabel(topic)}] ${description}`,
          priority: topic === "kyc_compliance" || topic === "account_access" ? "high" : "medium",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSubject("");
        setDescription("");
        setTopic("general_support");
        await loadTickets();
        if (data.ticket?.id) setSelectedTicketId(data.ticket.id);
      } else {
        setCreateError(
          typeof data.error === "string"
            ? data.error
            : "The support case could not be opened. Please review the details and try again.",
        );
      }
    } catch {
      setCreateError("The support service is temporarily unavailable. Please try again shortly.");
    } finally {
      setCreating(false);
    }
  }

  const cards = [
    { label: "Total Tickets", value: summary.total, icon: Ticket, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Open", value: summary.open, icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "In Progress", value: summary.inProgress, icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Resolved", value: summary.resolved, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <HeadphonesIcon className="h-3.5 w-3.5" /> Support Command Center
          </div>
          <h1 className="text-2xl font-bold text-white">Enterprise Support</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Open tickets, route issues, request escalation, and connect support into meetings, requests, compliance, and portfolio workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOperate ? (
            <Button asChild variant="outline" className="border-cyan-400/20 text-cyan-200">
              <Link href="/app/support/operations"><Users className="mr-2 h-4 w-4" /> Agent operations</Link>
            </Button>
          ) : null}
          <Badge className="border-green-500/25 bg-green-500/15 text-green-400">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Governed Support
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass-panel bento-card rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <p className={`text-3xl font-bold ${color}`}>{loading ? "—" : value}</p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><LifeBuoy className="h-5 w-5 text-cyan-400" /> Open Support Ticket</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createTicket} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {supportTopics.map((item) => (
                  <button key={item.value} type="button" onClick={() => setTopic(item.value)} className={`rounded-2xl border p-4 text-left transition ${topic === item.value ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
                  </button>
                ))}
              </div>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40" placeholder="Short support issue" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={5} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40" placeholder="Describe the issue, affected service, desired outcome, and urgency." />
              {createError ? (
                <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {createError}
                </div>
              ) : null}
              <Button type="submit" disabled={creating || !subject.trim() || !description.trim()} className="w-full rounded-xl bg-cyan-400 text-black hover:bg-cyan-300">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {creating ? "Opening Ticket" : "Open Ticket"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Bot className="h-5 w-5 text-cyan-400" /> AI Concierge Path</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                "Consent-aware support session starts",
                "AI concierge provides initial routing",
                "Restricted or sensitive cases escalate",
                "Ticket, request, or meeting path is created",
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/10 font-mono text-xs text-cyan-400">{String(index + 1).padStart(2, "0")}</div>
                  <p className="text-sm text-slate-300">{step}</p>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
                <Link href="/app/requests">Route Through Requests <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><MessageSquare className="h-5 w-5 text-cyan-400" /> Ticket History</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…</div>
              ) : tickets.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center"><Ticket className="mx-auto mb-3 h-8 w-8 text-slate-600" /><p className="text-sm text-slate-500">No support tickets yet.</p></div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className={`rounded-2xl border p-4 ${selectedTicketId === ticket.id ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-sm font-semibold text-white">{ticket.subject}</p><p className="mt-1 line-clamp-2 text-xs text-slate-400">{ticket.description || "No description provided."}</p></div>
                        <Badge className={statusClass(ticket.status)}>{formatLabel(ticket.status)}</Badge>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedTicketId(ticket.id)} className="mt-3 w-full text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100">
                        Open conversation <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedTicketId ? (
        <Card className="border-cyan-400/15 bg-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><MessageSquare className="h-5 w-5 text-cyan-300" /> Support conversation</CardTitle></CardHeader>
          <CardContent><SupportCaseConversation ticketId={selectedTicketId} onChanged={() => void loadTickets()} /></CardContent>
        </Card>
      ) : null}
    </div>
  );
}
