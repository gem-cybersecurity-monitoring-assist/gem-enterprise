import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  HeadphonesIcon,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceBreadcrumb } from "@/components/workspace/WorkspaceUi";
import { buildWhatsAppUrl, whatsappBusiness, whatsappServicePrompts } from "@/lib/whatsapp";

const mobileOperationsUrl = "https://gem-whatsapp-operations-mobile-wjpmf7.v2.appdeploy.ai/";
const peachUrl = "https://app.trypeach.ai";

const paths = [
  {
    title: "Support cases",
    description: "Open and manage the governed GEM support record before or alongside WhatsApp follow-up.",
    href: "/app/support",
    icon: HeadphonesIcon,
  },
  {
    title: "Appointments",
    description: "Create and manage consultation requests, then use WhatsApp for reminders or rescheduling handoff.",
    href: "/app/meetings",
    icon: CalendarDays,
  },
  {
    title: "Documents",
    description: "Keep sensitive documents in the governed document surface while WhatsApp carries status notifications.",
    href: "/app/documents",
    icon: FileCheck2,
  },
  {
    title: "Community",
    description: "Route community questions and event participation into the dedicated GEM community experience.",
    href: "/app/community",
    icon: UsersRound,
  },
];

export default function WhatsAppOperationsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <WorkspaceBreadcrumb current="WhatsApp Operations" />
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-emerald-300">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Connected Communications
          </div>
          <h1 className="text-2xl font-bold text-white">WhatsApp Operations</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Coordinate WhatsApp-supported service requests, cases, appointments, documents, and community handoffs without moving sensitive system-of-record data into ordinary chat.
          </p>
        </div>
        <Badge className="border-green-500/25 bg-green-500/15 text-green-400">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> {whatsappBusiness.displayNumber}
        </Badge>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <Smartphone className="h-6 w-6 text-emerald-300" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/70">Production channel</p>
              <p className="mt-1 text-lg font-bold text-white">{whatsappBusiness.displayNumber}</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            The number is paired through Peach using WhatsApp Business App Coexistence. Use Peach or the authorized WhatsApp Business app for the live inbox; use GEM surfaces for durable case, appointment, document, and compliance records.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={buildWhatsAppUrl(whatsappServicePrompts.general.message)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
            >
              Open WhatsApp <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={mobileOperationsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10"
            >
              Mobile operator console <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={peachUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              Peach CoPilot <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <h2 className="font-bold text-amber-100">Channel boundary</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-50/70">
            <li>• Do not send passwords, private keys, authentication codes, or unnecessary sensitive evidence through ordinary chat.</li>
            <li>• Store formal case records, KYC/compliance material, and sensitive documents in governed GEM workflows.</li>
            <li>• Promotional or broadcast communication remains consent- and preference-gated.</li>
            <li>• Keep human escalation for legal, financial, identity, compliance, and high-risk security decisions.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-white">Connected GEM workflows</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {paths.map(({ title, description, href, icon: Icon }) => (
            <Link key={title} href={href} className="glass-panel rounded-2xl p-5 transition hover:border-emerald-400/30">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Icon className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-5">
        <p className="text-sm font-semibold text-cyan-200">Public customer entry</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          The public WhatsApp routing page provides service-specific click-to-chat options while this workspace remains the authenticated operations surface.
        </p>
        <Button asChild variant="outline" className="mt-4 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
          <Link href="/whatsapp">Open public WhatsApp routing</Link>
        </Button>
      </section>
    </div>
  );
}
