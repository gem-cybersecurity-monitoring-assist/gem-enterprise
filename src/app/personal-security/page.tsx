import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Fingerprint, House, MailWarning, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Personal & Family Security | GEM",
  description: "Practical starting points for personal cybersecurity, identity-risk awareness, safer home technology, and scam prevention.",
  alternates: { canonical: "/personal-security" },
  openGraph: {
    title: "Personal & Family Security | GEM",
    description: "Build a clearer personal security plan for your accounts, identity, family devices, and online activity.",
    url: "/personal-security",
    type: "website",
  },
};

const pathways = [
  { icon: Fingerprint, number: "01", title: "Identity & account safety", description: "Review account recovery options, multi-factor authentication, password-manager practices, and public exposure risks.", outcomes: ["Account-hardening priorities", "Recovery readiness", "Exposure awareness"] },
  { icon: House, number: "02", title: "Family & home technology", description: "Identify practical improvements for home Wi-Fi, personal devices, shared family accounts, and connected-home privacy.", outcomes: ["Home-network checklist", "Device update priorities", "Family safety habits"] },
  { icon: MailWarning, number: "03", title: "Scams & financial fraud awareness", description: "Strengthen how you recognize suspicious messages, verify payment requests, and respond when an account or device may be at risk.", outcomes: ["Scam-recognition practices", "Payment-change verification", "Incident next steps"] },
] as const;

const boundaries = [
  "A request is not a contract, paid subscription, or activation of monitoring.",
  "Do not submit passwords, recovery codes, private keys, identity documents, or bank details through a general inquiry.",
  "Any assessment, monitoring, or response work requires confirmed scope, authorization, provider availability, and agreed terms.",
];

export default function PersonalSecurityPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0d121b] text-[#f8f9fa]">
      <section className="relative isolate border-b border-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_20%,rgba(0,217,230,0.14),transparent_42%),radial-gradient(ellipse_at_10%_80%,rgba(81,38,102,0.22),transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 md:pb-28 md:pt-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold tracking-wide text-cyan-100"><ShieldCheck className="h-4 w-4" aria-hidden="true" />GEM · PERSONAL SECURITY</span>
          <div className="mt-8 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-[clamp(2.7rem,5.5vw,5.2rem)] font-extrabold leading-[1.06] tracking-[-0.05em]">Protect what matters.<span className="block bg-gradient-to-r from-cyan-200 via-cyan-400 to-teal-200 bg-clip-text text-transparent">Start with clarity.</span></h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">Practical guidance for individuals and families who want safer accounts, stronger identity habits, more secure home technology, and a clearer response when something looks wrong.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/contact" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">Request a personal consultation<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/services" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">Explore GEM capabilities</Link>
              </div>
              <p className="mt-5 max-w-2xl text-xs leading-6 text-slate-400">A general inquiry is only a request for review. It does not activate a paid service or guarantee monitoring or incident response.</p>
            </div>
            <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">A simple starting point</p>
              <ol className="mt-6 space-y-5">
                {[["Understand","Describe the concern without sharing secrets or sensitive records."],["Prioritize","Identify the practical safeguards and scope that fit your situation."],["Confirm","Agree the service, terms, access, and provider dependencies before work begins."]].map(([title, description], index) => <li key={title} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-xs font-bold text-cyan-100">0{index + 1}</span><div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div></li>)}
              </ol>
            </aside>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Choose your priority</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">Practical protection, one step at a time.</h2><p className="mt-4 leading-7 text-slate-400">Start with the concern you want to address. The next step is to clarify the need and available support—not to buy a package blindly.</p></div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {pathways.map((pathway) => { const Icon = pathway.icon; return <article key={pathway.number} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-cyan-300/30 md:p-7"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="font-mono text-xs text-slate-500">{pathway.number}</span></div><h3 className="mt-6 text-xl font-bold text-white">{pathway.title}</h3><p className="mt-3 min-h-24 text-sm leading-6 text-slate-400">{pathway.description}</p><ul className="mt-5 space-y-3 border-t border-white/10 pt-5">{pathway.outcomes.map((outcome) => <li key={outcome} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />{outcome}</li>)}</ul></article>; })}
        </div>
      </section>
      <section className="border-y border-white/10 bg-white/[0.02]"><div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[0.8fr_1.2fr] md:py-20"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Safety first</p><h2 className="mt-4 text-3xl font-bold text-white">Keep sensitive information out of general inquiries.</h2></div><ul className="space-y-4">{boundaries.map((boundary) => <li key={boundary} className="flex gap-3 text-sm leading-7 text-slate-300"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />{boundary}</li>)}</ul></div></section>
      <section className="mx-auto max-w-5xl px-6 py-20 text-center md:py-24"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Your next step</p><h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">Begin with a conversation, not a commitment.</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">Tell GEM what you want to improve. The team can review the request, clarify fit and scope, and explain proposed next steps before an engagement is confirmed.</p><Link href="/contact" className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">Contact GEM<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></section>
    </main>
  );
}
