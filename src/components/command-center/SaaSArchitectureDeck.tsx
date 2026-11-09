import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Blocks, Building2, Compass, FileCheck2, Globe2,
  Layers3, Network, ShieldCheck, UsersRound, Workflow,
  type LucideIcon,
} from "lucide-react";
import { saasAreaArchitecture, saasAreaOrder } from "@/lib/saasAreaArchitecture";
import type { SaaSArea } from "@/lib/saasCapabilityCatalog";

const icons: Record<SaaSArea, LucideIcon> = {
  owner: ShieldCheck, operations: Workflow, client: UsersRound, community: Network, market: Globe2,
};
const labels: Record<SaaSArea, string> = {
  owner: "Leadership & control",
  operations: "Delivery & performance",
  client: "Customers & accounts",
  community: "People & collaboration",
  market: "Growth & commerce",
};
const numbers = ["01", "02", "03", "04", "05"] as const;

export function SaaSArchitectureDeck() {
  return (
    <section id="saas-architecture" aria-labelledby="saas-architecture-title" className="space-y-7 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.23em] text-cyan-300"><Blocks className="h-4 w-4" /> ENTERPRISE ARCHITECTURE</div>
          <h2 id="saas-architecture-title" className="mt-3 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl 2xl:text-5xl">Your platform, arranged into real operating divisions.</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">Move between five dedicated, full-size workspaces rather than squeezing every department into a single small dashboard.</p>
        </div>
        <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold tracking-wide text-cyan-200">05 CONNECTED DIVISIONS</span>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.45fr_1fr_1fr]">
        <Link href="/app/command-center/saas/areas/owner" className="group relative isolate flex min-h-[370px] flex-col justify-between overflow-hidden rounded-[30px] border border-cyan-400/25 bg-[linear-gradient(145deg,#0c3741_0%,#0a2334_46%,#091627_100%)] p-7 shadow-2xl shadow-cyan-950/20 transition hover:border-cyan-300/60 sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-12 h-72 w-72 rounded-full border-[26px] border-cyan-300/10 shadow-[0_0_0_44px_rgba(34,211,238,.025),0_0_0_92px_rgba(34,211,238,.025)]" />
          <div className="relative flex items-start justify-between">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-300/10"><ShieldCheck className="h-8 w-8 text-cyan-200" /></div>
            <span className="font-mono text-sm text-cyan-300">01 / 05</span>
          </div>
          <div className="relative max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[.24em] text-cyan-300">FLAGSHIP WORKSPACE</p>
            <h3 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">Enterprise governance</h3>
            <p className="mt-4 text-base leading-7 text-slate-300">Direct the company from one intelligent oversight environment—leadership, approvals, audit and controlled access.</p>
            <span className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition group-hover:bg-cyan-300/20">Enter executive workspace <ArrowUpRight className="h-5 w-5" /></span>
          </div>
        </Link>
        {saasAreaOrder.slice(1, 3).map((area, index) => {
          const Icon = icons[area];
          const item = saasAreaArchitecture[area];
          return (
            <Link href={`/app/command-center/saas/areas/${area}`} key={area}
              className="group relative flex min-h-[370px] flex-col justify-between overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(29,49,73,.88),rgba(8,20,38,.98))] p-7 transition hover:border-cyan-400/35 sm:p-9">
              <div className="flex items-start justify-between">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5"><Icon className="h-8 w-8 text-cyan-200" aria-hidden="true" /></span>
                <span className="font-mono text-sm text-slate-400">0{index + 2} / 05</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">{labels[area]}</p>
                <h3 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-slate-400">{item.subtitle}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-200">Explore division <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {saasAreaOrder.slice(3).map((area, index) => {
          const Icon = icons[area];
          const item = saasAreaArchitecture[area];
          return (
            <Link href={`/app/command-center/saas/areas/${area}`} key={area}
              className="group flex min-h-[265px] flex-col gap-6 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(110deg,rgba(35,39,67,.75),rgba(8,17,31,.98))] p-7 transition hover:border-cyan-400/30 sm:flex-row sm:items-center sm:p-9">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.055]"><Icon className="h-9 w-9 text-cyan-200" aria-hidden="true" /></span>
              <div className="flex-1">
                <span className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">{numbers[index + 3]} / 05 · {labels[area]}</span>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{item.title}</h3>
                <p className="mt-3 max-w-lg text-base leading-7 text-slate-400">{item.subtitle}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">Open full workspace <ArrowUpRight className="h-4 w-4" /></span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.045] px-6 py-5 text-sm leading-6 text-slate-300">
        <span className="inline-flex items-center gap-2 font-semibold text-cyan-200"><Layers3 className="h-4 w-4" /> One platform architecture</span>
        <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" /> Your existing organizations and account system</span>
        <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-slate-400" /> All original approval boundaries retained</span>
        <span className="inline-flex items-center gap-2"><Compass className="h-4 w-4 text-slate-400" /> Each division has its own expanded page</span>
      </div>
    </section>
  );
}
