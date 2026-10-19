import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  HeadphonesIcon,
  Lock,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const communicationPaths = [
  {
    title: "Support Ticket",
    description: "Open a governed support ticket for account, KYC, portfolio, or operational service issues.",
    href: "/app/support",
    icon: HeadphonesIcon,
  },
  {
    title: "Service Request",
    description: "Route a structured request to portfolio, compliance, cyber, document, or ATR operations.",
    href: "/app/requests",
    icon: ClipboardList,
  },
  {
    title: "Consultation Request",
    description: "Request a portfolio review, compliance review, cyber briefing, or trust consultation.",
    href: "/app/meetings",
    icon: CalendarClock,
  },
];

const controls = [
  "No advisor thread data is fabricated in the client UI.",
  "Operational communication is routed through existing backend workflows.",
  "Support and request flows preserve auditability and escalation paths.",
  "Future real-time messaging should connect to SupportSession records or a dedicated message model.",
];

export default function MessagesPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <MessageSquare className="h-3.5 w-3.5" /> Secure Communications
          </div>
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Route sensitive client communication through governed support, request, and consultation workflows until real-time messaging is connected.
          </p>
        </div>
        <Badge className="border-green-500/25 bg-green-500/15 text-green-400">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Controlled Routing
        </Badge>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
              <Lock className="h-6 w-6 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Use governed communication paths.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              GEM Enterprise should avoid showing fabricated advisor conversations. This surface now routes clients into the operational communication channels that already exist in the platform.
            </p>
          </div>

          <div className="grid gap-3">
            {controls.map((control) => (
              <div key={control} className="rounded-2xl border border-white/10 bg-background/60 p-4 text-sm text-slate-300">
                {control}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {communicationPaths.map(({ title, description, href, icon: Icon }) => (
          <Link key={title} href={href} className="glass-panel bento-card rounded-2xl p-6 transition hover:border-cyan-500/30">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
              <Icon className="h-6 w-6 text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-cyan-400">
              Open workflow <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </section>

      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
        <p className="text-sm font-semibold text-yellow-400">Implementation note</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Real-time encrypted messaging should be implemented only after a persisted message/thread model or SupportSession-backed message API is confirmed. Until then, this page intentionally routes to existing safe workflows.
        </p>
        <Button asChild variant="outline" className="mt-4 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
          <Link href="/app/support">Start With Support</Link>
        </Button>
      </div>
    </div>
  );
}
