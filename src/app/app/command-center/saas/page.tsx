import type { Metadata } from "next";
import Link from "next/link";
import { SaaSOperationalSnapshot } from "@/components/command-center/SaaSOperationalSnapshot";
import { SaaSManagementWorkspace } from "@/components/command-center/SaaSManagementWorkspace";
import { SaaSAssignedWorkspaces } from "@/components/command-center/SaaSAssignedWorkspaces";

export const metadata: Metadata = {
  title: "GEM SaaS Management | GEM Enterprise",
  description: "Private enterprise SaaS control plane for GEM Enterprise management.",
  robots: { index: false, follow: false, nocache: true },
};

export default function SaaSControlPlanePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-9 px-4 py-8 text-slate-100 sm:px-6">
      <header className="space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-950 px-5 py-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">GEM Enterprise · Owner operations</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">SaaS Management Center</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-300">
          One protected command center for your existing enterprise website: organizations, users,
          customers, services, approvals, content, integrations, community preparation and commercial readiness.
          This is an authenticated premarket management surface, not a second platform or payment system.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/app/command-center" className="inline-flex rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-slate-800">
            Return to existing command center
          </Link>
          <Link href="/app/command-center/saas/market-preview" className="inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20">
            View market-facing SaaS preview
          </Link>
        </div>
      </header>
      <SaaSOperationalSnapshot />
      <SaaSAssignedWorkspaces />
      <SaaSManagementWorkspace />
      <section className="rounded-xl border border-amber-500/30 bg-slate-950 p-5" aria-labelledby="activation-policy">
        <h2 id="activation-policy" className="text-lg font-semibold text-amber-100">Controlled activation policy</h2>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          The website can open existing workspaces, but this control plane cannot grant roles, publish content,
          collect payments, activate marketplace orders, approve identity checks or provision new tenants.
          Those actions remain behind their existing authoritative backend and human approval controls.
          Route availability does not certify integration health or contractual service availability.
        </p>
      </section>
    </main>
  );
}
