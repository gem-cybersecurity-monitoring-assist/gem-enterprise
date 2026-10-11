import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FileCheck2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildWhatsAppUrl,
  whatsappBusiness,
  whatsappServicePrompts,
} from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "WhatsApp Business",
  description:
    "Use GEM Enterprise WhatsApp Business for service routing, support, appointments, case updates, and permitted client follow-up.",
};

const serviceEntries = Object.entries(whatsappServicePrompts);

export default function WhatsAppPage() {
  return (
    <div className="min-h-screen">
      <section className="cyber-grid relative overflow-hidden py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-5 border border-emerald-400/30 bg-emerald-400/10 font-mono text-xs uppercase tracking-widest text-emerald-300">
            Connected Business Channel
          </Badge>
          <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                WhatsApp support across <span className="text-gradient-primary">GEM Enterprise</span>
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Start a service conversation, request routing, manage an appointment, ask about a case,
                or get help locating a document. Sensitive records remain inside the secure GEM platform.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={buildWhatsAppUrl(whatsappServicePrompts.general.message)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  Start WhatsApp chat
                </a>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Contact center <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <aside className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-400/10 p-3">
                  <Smartphone className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                    Production number
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">{whatsappBusiness.displayNumber}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-white/55">
                Connected through Peach in WhatsApp Business App Coexistence mode. The same business app
                can remain available on the authorized phone while supported operations are managed through Peach.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-3xl font-bold">Choose what you need</h2>
            <p className="mt-2 text-muted-foreground">
              Each entry opens WhatsApp with a short routing message so the request starts with useful context.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {serviceEntries.map(([key, service]) => (
              <a
                key={key}
                href={buildWhatsAppUrl(service.message)}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-border/60 bg-card/70 p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-emerald-400/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <MessageCircle className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-emerald-300" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-bold">{service.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-white/[0.02] py-14 md:py-20">
        <div className="container mx-auto grid gap-5 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
            <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold">Sensitive information stays controlled</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Do not send passwords, authentication codes, private keys, or unnecessary sensitive evidence
              through ordinary WhatsApp chat. Use the secure GEM portal when protected upload or verification is required.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
            <CalendarDays className="h-6 w-6 text-cyan-300" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold">Appointments and reminders</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              WhatsApp can support consultation requests, confirmations, reminder messages, and rescheduling handoffs.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
            <FileCheck2 className="h-6 w-6 text-cyan-300" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold">Cases and documents</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use WhatsApp for status notifications and assistance. Case evidence, formal records, and sensitive documents
              remain governed by the applicable GEM workspace or portal.
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6 md:p-8">
            <h2 className="text-xl font-bold text-amber-100">Communication guardrails</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-amber-50/70 md:grid-cols-2">
              <li>• Service and utility messages should relate to a real request, case, appointment, or document.</li>
              <li>• Promotional or broadcast outreach should only be sent where consent and communication preferences allow it.</li>
              <li>• Legal, financial, compliance, identity, and high-risk security matters should retain human escalation.</li>
              <li>• WhatsApp is a communication layer; it does not replace contracts, formal case records, or secure evidence handling.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
