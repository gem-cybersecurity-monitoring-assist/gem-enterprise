"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Headphones,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatPhase = "closed" | "disclosure" | "active" | "escalated";

interface KnowledgeLink {
  title: string;
  href: string;
  description: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  links?: KnowledgeLink[];
  suggestedReplies?: string[];
  responseSource?: "gateway" | "fallback" | "policy";
  providerStatus?: "available" | "disabled" | "budget_limited" | "rate_limited" | "unavailable";
}

interface HandoffState {
  queue: string;
  channel: "atlassian" | "gem_ticket";
  ticketId?: string;
  externalIssueKey?: string;
}

const DEFAULT_AI_DISCLOSURE_TEXT =
  "You are interacting with an AI-assisted support system. This assistant can answer general questions and help you submit requests. It cannot provide legal, financial, investment, identity, or cybersecurity advice. A qualified human advisor must review regulated matters.";

const QUICK_ACTIONS = [
  "Open my organization workspace",
  "Help with account access",
  "Show me GEM News",
  "Speak with human support",
] as const;

function DisclosureScreen({
  onAccept,
  onDecline,
  busy,
}: {
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const disclosureText =
    process.env.NEXT_PUBLIC_AI_DISCLOSURE_TEXT || DEFAULT_AI_DISCLOSURE_TEXT;

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
        <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">AI interaction disclosure</h3>
        <p className="text-sm leading-6 text-slate-300">{disclosureText}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
        Do not enter passwords, one-time codes, payment-card data, private keys, or identity-document numbers.
      </div>
      <div className="grid gap-2 pt-1">
        <Button
          disabled={busy}
          onClick={onAccept}
          className="min-h-11 bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Starting secure session…" : "Accept & continue"}
        </Button>
        <Button
          variant="ghost"
          onClick={onDecline}
          disabled={busy}
          className="min-h-11 text-slate-400 hover:text-white"
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

function EscalationScreen({
  handoff,
  onClose,
}: {
  handoff: HandoffState;
  onClose: () => void;
}) {
  const reference = handoff.externalIssueKey || handoff.ticketId;

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
        <CheckCircle2 className="h-6 w-6 text-emerald-300" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Human-support request recorded</h3>
        <p className="text-sm leading-6 text-slate-300">
          Your request is assigned to <span className="font-medium text-white">{handoff.queue}</span>. It is now a tracked case, not another automated reply.
        </p>
        <p className="text-xs leading-5 text-slate-400">
          Your conversation and the attempted resolution are attached. The case will show when an authorized human agent claims it; until then, its status remains waiting for support.
        </p>
      </div>
      {reference ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Case reference</p>
          <p className="mt-1 break-all font-mono text-xs text-cyan-200">{reference}</p>
        </div>
      ) : null}
      <div className="grid gap-2">
        <Button asChild className="min-h-11 bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300">
          <Link href={handoff.ticketId ? `/app/support?ticket=${encodeURIComponent(handoff.ticketId)}` : "/app/support"}>
            Reply and track updates <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 border-white/10 text-slate-200">
          <Link href="/app/requests">
            Review service requests <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="ghost" className="min-h-11 text-slate-400" onClick={onClose}>
          Close chat
        </Button>
      </div>
    </div>
  );
}

interface AIChatWidgetProps {
  profileId?: string;
  profileName?: string;
}

export function AIChatWidget({
  profileId = "PRF-005",
  profileName = "Platform Support",
}: AIChatWidgetProps) {
  const [phase, setPhase] = useState<ChatPhase>("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiRunId, setAiRunId] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const acceptDisclosure = async () => {
    setLoading(true);
    setError(null);

    try {
      const text =
        process.env.NEXT_PUBLIC_AI_DISCLOSURE_TEXT || DEFAULT_AI_DISCLOSURE_TEXT;
      const encoded = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
      const disclosureTextHash = Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      const [aiResponse, supportResponse] = await Promise.all([
        fetch("/api/assistant/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, consentGiven: true, disclosureTextHash }),
        }),
        fetch("/api/support/session/start", { method: "POST" }),
      ]);

      const aiData = await aiResponse.json();
      const supportData = await supportResponse.json();
      if (!aiResponse.ok || !aiData.ok) {
        throw new Error(aiData.error || "Unable to record AI consent.");
      }
      if (!supportResponse.ok || !supportData.sessionId) {
        throw new Error(supportData.error || "Unable to start support session.");
      }

      let greeting = "Secure AI support session started. How can I help today?";
      if (supportData.requiresConsent) {
        const consentResponse = await fetch("/api/support/session/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: supportData.sessionId, accepted: true }),
        });
        const consentData = await consentResponse.json();
        if (!consentResponse.ok || !consentData.success) {
          throw new Error(consentData.error || "Unable to record support consent.");
        }
        greeting = consentData.greeting || greeting;
      }

      setAiRunId(aiData.sessionId);
      setSessionId(supportData.sessionId);
      const resumedMessages = Array.isArray(supportData.messages)
        ? supportData.messages
            .filter((message: ChatMessage) => message && typeof message.id === "string" && typeof message.text === "string")
            .map((message: ChatMessage) => ({
              id: message.id,
              role: message.role,
              text: message.text,
            }))
        : [];
      setMessages([
        { id: "system-start", role: "system", text: supportData.isExisting ? "Your secure support session has been resumed." : greeting },
        ...resumedMessages,
      ]);
      setPhase("active");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start the secure support session.");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageOverride?: string) => {
    const text = (messageOverride ?? draft).trim();
    if (!text || loading || !sessionId) return;

    setMessages((current) => [
      ...current,
      { id: `user-${crypto.randomUUID()}`, role: "user", text },
    ]);
    setDraft("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/support/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, aiRunId, message: text }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The support service could not process that message.");
      }

      setMessages((current) => [
        ...current,
        {
          id: data.messageId || `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          text: data.reply,
          links: Array.isArray(data.knowledgeLinks) ? data.knowledgeLinks : [],
          suggestedReplies: Array.isArray(data.suggestedReplies) ? data.suggestedReplies.slice(0, 3) : [],
          responseSource: data.responseSource,
          providerStatus: data.providerStatus,
        },
      ]);

      if (data.shouldEscalate && data.handoff?.success) {
        setHandoff({
          queue: data.handoff.queue || "General Member Support",
          channel: data.handoff.channel || "gem_ticket",
          ticketId: data.handoff.ticketId,
          externalIssueKey: data.handoff.externalIssueKey,
        });
        setPhase("escalated");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The support service is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const closeChat = () => {
    setPhase("closed");
    setError(null);
  };

  if (phase === "closed") {
    return (
      <button
        type="button"
        onClick={() => setPhase("disclosure")}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400 text-slate-950 shadow-[0_16px_50px_rgba(34,211,238,0.28)] transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Open AI support chat"
      >
        <MessageSquare className="h-6 w-6" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section
      aria-label="GEM AI support"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(76dvh,620px)] flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem]"
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
            <Bot className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{profileName}</p>
            <p className="text-[11px] text-slate-400">AI assistant · governed session</p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeChat}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label="Close support chat"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-950">
        {phase === "disclosure" ? (
          <DisclosureScreen busy={loading} onAccept={acceptDisclosure} onDecline={closeChat} />
        ) : null}

        {phase === "escalated" && handoff ? (
          <EscalationScreen handoff={handoff} onClose={closeChat} />
        ) : null}

        {phase === "active" ? (
          <div className="space-y-4 p-4" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "flex justify-end"
                    : message.role === "system"
                      ? "flex justify-center"
                      : "flex justify-start"
                }
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[86%] rounded-2xl rounded-br-md border border-cyan-300/20 bg-cyan-400/15 px-3.5 py-2.5 text-sm leading-5 text-white"
                      : message.role === "system"
                        ? "max-w-[92%] rounded-full bg-white/[0.05] px-4 py-2 text-center text-xs italic leading-5 text-slate-400"
                        : "max-w-[90%] rounded-2xl rounded-bl-md border border-white/5 bg-slate-800 px-3.5 py-2.5 text-sm leading-5 text-slate-100"
                  }
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.links && message.links.length > 0 ? (
                    <div className="mt-3 grid gap-2 border-t border-white/10 pt-3">
                      {message.links.map((link) => (
                        <Link
                          key={`${message.id}-${link.href}`}
                          href={link.href}
                          className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-cyan-200 hover:border-cyan-300/30 hover:bg-cyan-400/10"
                        >
                          {link.title}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.suggestedReplies && message.suggestedReplies.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3" aria-label="Suggested follow-up questions">
                      {message.suggestedReplies.map((reply) => (
                        <button
                          type="button"
                          key={`${message.id}-${reply}`}
                          onClick={() => void sendMessage(reply)}
                          disabled={loading}
                          className="min-h-9 rounded-full border border-cyan-300/20 bg-cyan-400/[0.06] px-3 py-1.5 text-left text-xs leading-4 text-cyan-100 hover:border-cyan-300/40 hover:bg-cyan-400/10 disabled:opacity-50"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.responseSource ? (
                    <p className="mt-2 border-t border-white/10 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                      {message.responseSource === "gateway"
                        ? "AI Gateway · verified GEM context"
                        : message.responseSource === "policy"
                          ? "GEM policy routing"
                          : message.providerStatus === "budget_limited" || message.providerStatus === "rate_limited"
                            ? "Verified GEM guidance · AI capacity limited"
                            : "Verified GEM guidance · continuity mode"}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    type="button"
                    key={action}
                    onClick={() => void sendMessage(action)}
                    className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs leading-4 text-slate-300 hover:border-cyan-300/30 hover:text-white"
                  >
                    {action}
                  </button>
                ))}
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" aria-hidden="true" />
                GEM Concierge is checking the verified support path…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 border-t border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs leading-5 text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {phase === "active" ? (
        <footer className="space-y-2 border-t border-white/10 bg-slate-900/95 p-3">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask about your GEM workspace…"
              aria-label="Support message"
              maxLength={2000}
              className="min-h-11 flex-1 border-white/10 bg-white/5 text-base text-white placeholder:text-slate-500 sm:text-sm"
            />
            <Button
              size="icon"
              onClick={() => void sendMessage()}
              disabled={!draft.trim() || loading}
              className="h-11 w-11 shrink-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              aria-label="Send support message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void sendMessage("I want to speak with a live human support agent.")}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-cyan-200 disabled:opacity-50"
          >
            <Headphones className="h-4 w-4" aria-hidden="true" />
            Request human support
          </button>
        </footer>
      ) : null}
    </section>
  );
}
