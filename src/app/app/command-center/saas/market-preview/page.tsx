import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GEM Enterprise SaaS Market Preview",
  description: "Private prelaunch review of the proposed GEM Enterprise SaaS customer journey.",
  robots: { index: false, follow: false, nocache: true },
};

const pathways = [
  {
    title: "For organizations",
    eyebrow: "Enterprise services",
    description: "Explore scoped cybersecurity support, request a review, and coordinate approved work through a private organization workspace.",
    href: "/business-review",
    link: "See existing business review intake",
  },
  {
    title: "For individuals",
    eyebrow: "Personal services",
    description: "Discover personal cybersecurity education, request relevant assistance, and use a private client portal when access is approved.",
    href: "/personal-security",
    link: "See existing personal security services",
  },
  {
    title: "For partners",
    eyebrow: "Partner applications",
    description: "Future verified provider, consultant and reseller access is planned. There is no open partner enrollment or live commission programme in this preview.",
    href: "/get-started",
    link: "Review the existing enquiry route",
  },
] as const;

const stages = [
  ["01", "Discover", "Understand services and the boundaries of what can currently be requested."],
  ["02", "Request", "Submit a scoped enquiry through an existing approved intake route."],
  ["03", "Review", "A qualified person assesses eligibility, consent and authorization."],
  ["04", "Work", "Authorized clients use their own private workspace, requests and support."],
  ["05", "Expand", "Additional services, partners and commerce are introduced only after activation gates pass."],
] as const;

const future = [
  ["Community network", "Private member groups, moderated discussions, events and resources are under design; current community pages contain fictional previews."],
  ["Service marketplace", "Service discovery and requests exist; online orders and provider transactions are not active."],
  ["Subscription workspace", "Plan management, usage metering, billing, invoices and upgrades require approved persistence and payment activation."],
  ["Developer ecosystem", "Scoped APIs, webhooks and white-label capabilities require tested credentials, contracts and operational authorization."],
] as const;

export default function MarketPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-5">
          <Link href="/app/command-center/saas" className="text-sm font-bold tracking-wide text-cyan-300">
            GEM ENTERPRISE / SAAS
          </Link>
          <span className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-200">
            PRIVATE PRELAUNCH CONCEPT · NOT OPEN FOR SALES
          </span>
        </div>
        <section className="grid items-center gap-8 py-8 lg:grid-cols-2 lg:py-14">
          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">One platform · Multiple governed services</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Your enterprise services, workspaces and support in one place.</h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300">
              GEM Enterprise brings service discovery, approved onboarding, case management and client coordination into a single controlled environment.
              Future community, marketplace and subscription capabilities will join this platform only when their operating requirements are met.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/services" className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">View current service catalog</Link>
              <Link href="/app/command-center/saas" className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold">View internal readiness</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Client operating journey</h2>
            <ol className="mt-6 space-y-5">
              {stages.map(([number, label, description]) => (
                <li key={number} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 font-mono text-sm text-cyan-300">{number}</span>
                  <div><h3 className="font-semibold">{label}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="space-y-5">
          <h2 className="text-2xl font-bold">Designed around each customer</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {pathways.map((pathway) => (
              <article key={pathway.title} className="rounded-xl border border-slate-700 bg-slate-900/70 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{pathway.eyebrow}</p>
                <h3 className="mt-3 text-xl font-semibold">{pathway.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{pathway.description}</p>
                <Link className="mt-5 inline-block text-sm font-semibold text-cyan-300 underline underline-offset-4" href={pathway.href}>{pathway.link}</Link>
              </article>
            ))}
          </div>
        </section>
        <section className="space-y-5">
          <h2 className="text-2xl font-bold">Next-stage platform modules</h2>
          <p className="max-w-3xl text-sm text-slate-300">These are scoped features for future authorization, not presently active services or commercial offers.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {future.map(([title, description]) => (
              <article key={title} className="rounded-xl border border-slate-700 p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-amber-300">Not activated</p>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>
        <footer className="border-t border-slate-700 py-6 text-xs leading-6 text-slate-400">
          This private preview contains no sales activation, customer representations, service-level guarantees, payment collection or public community membership. Every operational claim requires separate evidence review.
        </footer>
      </div>
    </main>
  );
}
