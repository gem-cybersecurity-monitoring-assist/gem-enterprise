import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  HeadphonesIcon,
  Lock,
  MessageSquare,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceBreadcrumb } from "@/components/workspace/WorkspaceUi";

const communicationPaths = [
  {
    title: "Support Ticket",
    description: "Open a governed support ticket for account, KYC, portfolio, or operational service issues.",
    href: "/app/support",
    icon: HeadphonesIcon,
  },
  {
    title: "Service Request",
    description: "Route a structured request to portfolio, compliance, cyber, document, or trust operations.",
    href: "/app/requests",
    icon: ClipboardList,
  },
  {
    title: "Consultation Request",
    description: "Request a portfolio review, compliance review, cyber briefing, or trust consultation.",
    href: "/app/meetings",
    icon: CalendarClock,
  },
  {
    title: "WhatsApp Operations",
    description: "Use the connected WhatsApp Business channel for permitted support, reminders, case updates, and service handoffs.",
    href: "/app/whatsapp",
    icon: Smartphone,
  },
];

const assurances = [
  "Every message stays inside a governed workflow — nothing is lost or informal.",
  "Support tickets, service requests, and consultations keep a full audit trail.",
  "Sensitive matters can be escalated to your GEM team at any step.",
];

export default function MessagesPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <WorkspaceBreadcrumb current="Messages" />
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Secure Communications
          </div>
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Reach your GEM team through governed support, request, and consultation workflows. Direct in-portal messaging is planned and will appear here when it is ready.
          </p>
        </div>
        <Badge className="border-green-500/25 bg-green-500/15 text-green-400">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Controlled Routing
        </Badge>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
              <Lock className="h-6 w-6 text-cyan-400" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold text-white">Use governed communication paths.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Sensitive client communication is routed through the operational channels that already exist in the platform, so nothing you send is informal or unrecorded.
            </p>
          </div>

          <div className="grid gap-3">
            {assurances.map((assurance) => (
              <div key={assurance} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-background/60 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <p className="text-sm text-slate-300">{assurance}</p>
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

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-5">
        <p className="text-sm font-semibold text-cyan-300">What comes next</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Direct encrypted messaging inside the portal is planned. Until then, these workflows are the secure way to reach your team — and they keep everything recorded.
        </p>
        <Button asChild variant="outline" className="mt-4 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
          <Link href="/app/support">Start With Support</Link>
        </Button>
      </div>
    </div>
  );
}
