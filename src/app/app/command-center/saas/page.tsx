import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, CircleHelp, Command, ExternalLink, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";
import { SaaSOperationalSnapshot } from "@/components/command-center/SaaSOperationalSnapshot";
import { SaaSManagementWorkspace } from "@/components/command-center/SaaSManagementWorkspace";
import { SaaSAssignedWorkspaces } from "@/components/command-center/SaaSAssignedWorkspaces";
import { SaaSArchitectureDeck } from "@/components/command-center/SaaSArchitectureDeck";

export const metadata: Metadata = {
  title: "SaaS Management Center | GEM Enterprise",
  description: "An easier, unified workspace for managing GEM Enterprise operations and customer services.",
  robots: { index: false, follow: false, nocache: true },
};

export default function SaaSControlPlanePage() {
  return (
    <main id="saas-home" className="relative mx-auto w-full max-w-[1820px] space-y-12 px-4 pb-24 pt-7 text-slate-100 sm:px-7 lg:space-y-16 2xl:px-10">
      <div className="pointer-events-none absolute left-1/3 top-0 -z-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[95px]" />
      <nav aria-label="SaaS breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
        <Link href="/app/admin" className="hover:text-cyan-200">Admin</Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-200">SaaS workspace</span>
      </nav>

      <header className="relative overflow-hidden rounded-[36px] border border-cyan-400/20 bg-[radial-gradient(ellipse_at_top_right,rgba(8,145,178,0.23),transparent_57%),linear-gradient(145deg,rgba(15,23,42,1),rgba(2,6,23,0.98))] px-6 py-10 shadow-2xl shadow-black/20 sm:px-10 sm:py-14 lg:min-h-[490px] lg:px-14 lg:py-16 2xl:px-20">
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-35" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(34,211,238,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.07) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "linear-gradient(to left, black, transparent)" }} />
        <div className="relative z-10 max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> GEM Enterprise Workspace
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl 2xl:text-[74px]">Your business. One workspace.</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Manage your clients, teams, projects and services without jumping between dashboards.
            Everything stays connected to your existing GEM Enterprise systems.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="#saas-quick-actions" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Start managing <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="#saas-tools" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.055] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Browse all tools <Command className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" /> Protected administrator access</span>
            <span className="inline-flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Existing services and data</span>
          </div>
        </div>
      </header>

      <section aria-labelledby="saas-backend-health-title" className="grid items-center gap-6 rounded-[30px] border border-amber-400/20 bg-[linear-gradient(120deg,rgba(120,53,15,.12),rgba(8,21,38,.95))] px-6 py-8 sm:px-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">BACKEND IMPLEMENTATION</p>
          <h2 id="saas-backend-health-title" className="mt-3 text-2xl font-bold text-white sm:text-3xl">See what is actually connected and what still needs work.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Review current database checks, social connector persistence and the separate community, marketplace and billing activation gates. No synthetic success counts are displayed.</p>
        </div>
        <Link href="/app/command-center/saas/readiness" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-6 py-3 text-sm font-bold text-amber-100 hover:bg-amber-300/20">Open backend completion center <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>

      <SaaSArchitectureDeck />

      <SaaSManagementWorkspace />

      <section aria-label="Additional management views" className="grid gap-5 md:grid-cols-2">
        <Link href="/app/command-center" className="group flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.035] px-7 py-8 transition hover:border-cyan-400/25 hover:bg-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-cyan-400/10 p-3 text-cyan-200"><LayoutDashboard className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="font-semibold">Enterprise command center</p><p className="mt-1 text-xs text-slate-400">Advanced enterprise-wide operations</p></div>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-200" aria-hidden="true" />
        </Link>
        <Link href="/app/command-center/saas/market-preview" className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 transition hover:border-cyan-400/25 hover:bg-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-violet-400/10 p-3 text-violet-200"><ExternalLink className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="font-semibold">Customer experience preview</p><p className="mt-1 text-xs text-slate-400">Review the prelaunch SaaS market journey</p></div>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-200" aria-hidden="true" />
        </Link>
      </section>

      <details className="group rounded-2xl border border-white/10 bg-slate-900/50" id="saas-advanced">
        <summary className="flex min-h-[76px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.025] sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3">
            <span className="rounded-xl bg-white/[0.05] p-3 text-slate-300"><LayoutDashboard className="h-5 w-5" aria-hidden="true" /></span>
            <span><span className="block text-base font-semibold text-white">System activity & organization workspaces</span><span className="mt-1 block text-xs text-slate-400">View verified figures, workspace restrictions and backend readiness</span></span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-5 border-t border-white/10 p-4 sm:p-6">
          <SaaSOperationalSnapshot />
          <SaaSAssignedWorkspaces />
        </div>
      </details>

      <details className="group rounded-2xl border border-white/10 bg-slate-900/40">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><CircleHelp className="h-4 w-4 text-cyan-300" aria-hidden="true" /> About security and upcoming features</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="border-t border-white/10 px-5 py-4 text-sm leading-7 text-slate-400">
          Your GEM SaaS workspace opens existing tools under their original access permissions.
          It does not independently authorize payment collection, live marketplace orders, membership,
          publishing, identity decisions, or organization provisioning. Some tools are still previews;
          each label describes its actual availability rather than claiming a live connection.
        </p>
      </details>
    </main>
  );
}
