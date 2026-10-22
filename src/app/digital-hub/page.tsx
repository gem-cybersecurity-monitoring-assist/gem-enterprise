import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Globe2,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ReferralActions, WalletConnector } from "./DigitalHubClient";
import { EcosystemDashboard } from "./EcosystemDashboard";
import { publicDigitalHubCatalog } from "@/lib/digital-hub/catalog";

export const metadata: Metadata = {
  title: "Digital Hub | GEM Enterprise",
  description:
    "GEM Enterprise digital hub for verified services, referral routes, wallet connections, and governed provider access.",
};

const journey = [
  ["Discover", "Find a verified service, useful briefing, or referral route."],
  ["Qualify", "See availability, boundaries, eligibility, and required provider connections."],
  ["Agree", "Confirm scope, price, timing, responsibilities, and required approvals."],
  ["Deliver", "Move approved work into the authenticated GEM workspace."],
  ["Review", "Measure completion, provider health, support needs, and next actions."],
];

const backendSignals = [
  ["Server catalog", "Provider and service states are rendered from application configuration."],
  ["Persistent events", "Validated interactions use GEM audit persistence with first-party analytics fallback when the gateway blocks anonymous audit writes."],
  ["Non-custodial", "Wallet approval remains inside the wallet; GEM does not collect keys or seed phrases."],
];

export default function DigitalHubPage() {
  const hub = publicDigitalHubCatalog();

  return (
    <main className="min-h-screen overflow-hidden bg-[#06131f] text-white">
      <section className="relative isolate min-h-[82vh] overflow-hidden border-b border-white/10 px-5 py-20 sm:py-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_18%,rgba(255,191,0,.20),transparent_28%),radial-gradient(circle_at_82%_25%,rgba(34,211,238,.16),transparent_30%),linear-gradient(135deg,#06131f_0%,#09263a_48%,#06131f_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
        <div className="absolute -right-32 top-24 -z-10 h-[34rem] w-[34rem] rounded-full border border-cyan-300/10" />
        <div className="absolute -right-16 top-40 -z-10 h-[26rem] w-[26rem] rounded-full border border-amber-300/10" />
        <div className="absolute right-16 top-56 -z-10 h-[14rem] w-[14rem] rounded-full border border-white/10" />

        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.18fr_.82fr] lg:items-end">
          <div>
            <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
              GEM Digital Hub · production
            </p>
            <h1 className="max-w-5xl text-6xl font-black leading-[.88] tracking-[-.065em] text-white sm:text-8xl lg:text-[7.5rem]">
              Build skill.
              <span className="block bg-gradient-to-r from-amber-300 via-yellow-100 to-cyan-200 bg-clip-text text-transparent">
                Make moves.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              One governed route into GEM services, crypto market intelligence, provider
              connections, referrals, and client operations—with status controlled by the backend.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#services" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-300 px-6 font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-200">
                Explore the hub <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/api/digital-hub/health" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 font-bold text-white backdrop-blur transition hover:bg-white/10">
                Backend health <Activity className="h-4 w-4 text-cyan-300" />
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-cyan-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[.07] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">Control plane</p>
                  <p className="mt-1 text-xl font-black">Digital Hub runtime</p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
                  <ServerCog className="h-6 w-6 text-emerald-300" />
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ["Public catalog", "LIVE", "text-emerald-300"],
                  ["Event persistence", "ENABLED", "text-emerald-300"],
                  ["Wallet custody", "DISABLED", "text-slate-400"],
                  ["Private-key collection", "DISABLED", "text-slate-400"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                    <span className="text-sm text-slate-300">{label}</span>
                    <span className={`font-mono text-[10px] font-bold tracking-wider ${tone}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-amber-300" />
                Provider-controlled capabilities remain fail-closed.
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#06131f]/90 px-5 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-x-7 gap-y-2 py-3 font-mono text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">
          <a href="#referral" className="transition hover:text-amber-300">Referral</a>
          <a href="#connections" className="transition hover:text-amber-300">Connections</a>
          <a href="#wallets" className="transition hover:text-amber-300">Wallets</a>
          <a href="#profiles" className="transition hover:text-amber-300">Profiles</a>
          <a href="#market-references" className="transition hover:text-amber-300">Markets</a>
          <a href="#services" className="transition hover:text-amber-300">Services</a>
          <a href="/community-hub" className="transition hover:text-amber-300">Community</a>
          <a href="#journey" className="transition hover:text-amber-300">Client journey</a>
          <a href="/api/digital-hub" className="ml-auto inline-flex items-center gap-1 text-cyan-200 transition hover:text-white">
            Live API <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </nav>

      <section id="referral" className="relative overflow-hidden bg-amber-300 px-5 py-14 text-slate-950">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-20 [background-image:radial-gradient(#06131f_1.3px,transparent_1.3px)] [background-size:18px_18px]" />
        <div className="relative mx-auto grid max-w-7xl gap-9 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-slate-700">Verified referral route</p>
            <h2 className="mt-3 max-w-xl text-4xl font-black leading-none tracking-[-.04em] sm:text-6xl">
              Start from a route we can verify.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-700">{hub.referral.disclosure}</p>
          </div>
          <ReferralActions code={hub.referral.code} href="/api/digital-hub/referral/btcc" />
        </div>
      </section>

      <section id="connections" className="relative px-5 py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_40%,rgba(34,211,238,.08),transparent_28%)]" />
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid gap-5 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Connection layer</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">One hub. Verified routes.</h2>
            </div>
            <p className="max-w-2xl text-slate-400">
              External destinations are marked live only when the server catalog contains a verified route.
              Authentication, eligibility, and provider verification remain with each destination.
            </p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2">
            {hub.connections.map((connection) => (
              <article key={connection.label} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[.045] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[.07]">
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-300/5 blur-2xl transition group-hover:bg-cyan-300/10" />
                <div className="relative flex items-start justify-between gap-6">
                  <div>
                    <div className="mb-8 inline-flex rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                      <Globe2 className="h-5 w-5 text-cyan-300" />
                    </div>
                    <h3 className="text-2xl font-black">{connection.label}</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                      {connection.disclosure ?? "Verified public route."}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {connection.status}
                  </span>
                </div>
                <a href={connection.href} target="_blank" rel="noopener noreferrer" className="relative mt-7 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-cyan-200">
                  Open provider <ExternalLink className="h-4 w-4" />
                </a>
              </article>
            ))}
          </div>

          <EcosystemDashboard />
          <div id="wallet-connect" className="mt-8 scroll-mt-24">
            <WalletConnector />
          </div>
        </div>
      </section>

      <section id="services" className="relative border-y border-white/10 bg-[#091a29] px-5 py-20 sm:py-28">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,rgba(255,255,255,.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.03)_50%,rgba(255,255,255,.03)_75%,transparent_75%,transparent)] [background-size:48px_48px]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-12 grid gap-5 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-amber-300">Service stack</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">Capability with explicit gates.</h2>
            </div>
            <p className="max-w-2xl text-slate-400">
              Market capability is represented by its actual controlled state. A public card never implies
              that provider authorization, live execution, or a regulated capability is active.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hub.services.map((service, index) => (
              <a
                key={service.id}
                href={`/api/digital-hub/services/${service.id}`}
                className={`group flex min-h-64 flex-col rounded-3xl border border-white/10 bg-slate-950/40 p-6 transition hover:-translate-y-1 hover:border-amber-300/25 hover:bg-slate-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${index === 0 ? "xl:col-span-2" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-300">{String(index + 1).padStart(2, "0")}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-300">
                    <CircleDot className={`h-3 w-3 ${service.state === "available" ? "text-emerald-300" : "text-amber-300"}`} />
                    {service.state}
                  </span>
                </div>
                <h3 className="mt-14 text-2xl font-black tracking-tight">{service.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{service.description}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-bold text-amber-200 transition group-hover:gap-3 group-hover:text-amber-100">
                  {service.actionLabel} <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="journey" className="relative px-5 py-20 sm:py-28">
        <div className="absolute left-1/2 top-0 -z-10 h-full w-px bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Operating model</p>
            <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-6xl">
              From visitor to accountable client operation.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {journey.map(([title, description], index) => (
              <article key={title} className="relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] p-6">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border border-white/10" />
                <span className="font-mono text-xs font-bold text-amber-300">0{index + 1}</span>
                <h3 className="mt-20 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-[#030a10] px-5 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,191,0,.09),transparent_35%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-amber-300">Backend stack</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Designed to prove, not imply.</h2>
            </div>
            <a href="/api/digital-hub/health" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white">
              Inspect runtime health <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {backendSignals.map(([title, description], index) => {
              const Icon = index === 0 ? ServerCog : index === 1 ? Activity : LockKeyhole;
              return (
                <article key={title} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
                  <Icon className="h-6 w-6 text-amber-300" />
                  <h3 className="mt-8 text-xl font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 rounded-3xl border border-emerald-300/15 bg-emerald-300/[.06] p-5 text-sm text-slate-300">
            {["No seed phrase collection", "No public-hub custody", "No static live-trading claims", "Referral relationship disclosed"].map((item) => (
              <p key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />{item}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 rounded-[2rem] border border-amber-300/20 bg-gradient-to-r from-amber-300/10 to-cyan-300/5 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[.16em] text-amber-300">
              <Sparkles className="h-4 w-4" /> Ready for scoped work
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Move from the public hub into GEM.</h2>
          </div>
          <a href="/get-started" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 font-bold text-slate-950 transition hover:-translate-y-0.5">
            Enter GEM <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>GEM Enterprise Digital Hub · educational and technology information, not financial advice.</p>
          <p className="font-mono text-[10px] uppercase tracking-wider">Backend-controlled · non-custodial</p>
        </div>
      </footer>
    </main>
  );
}
