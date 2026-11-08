import type { Metadata } from "next";
import Link from "next/link";
import { listSaaSCapabilities, type SaaSArea, type SaaSReadiness } from "@/lib/saasCapabilityCatalog";

export const metadata: Metadata = {
  title: "SaaS Control Plane | GEM Enterprise",
  description: "Pre-launch register of GEM Enterprise platform capabilities and their activation requirements.",
  robots: { index: false, follow: false },
};

const areas: readonly { id: SaaSArea; label: string; description: string }[] = [
  { id: "owner", label: "Owner governance", description: "Company-wide control, approvals and decisions." },
  { id: "operations", label: "Internal operations", description: "Tenant administration, services and governed automation." },
  { id: "client", label: "Client experience", description: "Authenticated client tools and private service workflows." },
  { id: "community", label: "Community", description: "Member network preparation and moderation." },
  { id: "market", label: "Marketplace and commercial", description: "Request-only services and future SaaS commerce." },
];

const statusLabels: Record<SaaSReadiness, string> = {
  "existing-surface": "Existing surface — operation unverified",
  "preview-only": "Preview only",
  "request-only": "Request only",
  planned: "Planned — not enabled",
};

export default function SaaSControlPlanePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-slate-100 sm:px-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">GEM Enterprise · Private product control plane</p>
        <h1 className="text-3xl font-bold tracking-tight">Unified SaaS capability register</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
          Pre-market architecture and feature inventory. Route existence never confirms live operations, connected providers,
          client entitlements or production authorization. No purchases, publications, enrollment or service activation occur here.
        </p>
        <Link className="inline-flex text-sm font-semibold text-cyan-300 underline underline-offset-4" href="/app/command-center">
          Return to existing command center
        </Link>
      </header>
      {areas.map((area) => (
        <section key={area.id} aria-labelledby={area.id} className="space-y-4">
          <div>
            <h2 id={area.id} className="text-xl font-semibold">{area.label}</h2>
            <p className="text-sm text-slate-400">{area.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listSaaSCapabilities(area.id).map((item) => (
              <article key={item.id} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-300">{statusLabels[item.readiness]}</p>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-slate-300">{item.description}</p>
                <p className="text-xs text-slate-400"><span className="font-semibold text-slate-200">Activation gate:</span> {item.activationGate}</p>
                {item.href ? (
                  <Link href={item.href} className="inline-block text-sm text-cyan-300 underline underline-offset-4">Open existing surface</Link>
                ) : (
                  <span className="text-xs text-slate-400">No activated destination</span>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
