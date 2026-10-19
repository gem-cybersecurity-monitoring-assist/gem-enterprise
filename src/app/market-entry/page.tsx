import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Globe2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { foundingBusinessReviewOffer } from "@/lib/market/launchOffer";
import { buildBusinessReviewCampaignUrl } from "@/lib/market/gtmActivation";

export const metadata: Metadata = {
  title: "Business Security & Resilience | Start with GEM",
  description:
    "A clear, evidence-led starting point for business security, risk review, fraud awareness, and operational resilience. Explore GEM services and request a scoped consultation.",
  alternates: { canonical: "/market-entry" },
  openGraph: {
    title: "Start with GEM | Business Security & Resilience",
    description:
      "Understand your security priorities, explore a bounded founding Business Review, and connect with the GEM Enterprise team.",
    url: "/market-entry",
    type: "website",
  },
};

const reviewUrl = buildBusinessReviewCampaignUrl({
  source: "market-entry",
  medium: "hero",
  leadSource: "campaign",
});
const reviewFooterUrl = buildBusinessReviewCampaignUrl({
  source: "market-entry",
  medium: "footer-cta",
  leadSource: "campaign",
});
const checklistUrl = "/resources/business-readiness-checklist";
const wixInquiryUrl = "https://firmgem.wixforms.com/f/7515843603776668706";

const priorities = [
  {
    num: "01",
    icon: ShieldCheck,
    title: "Cybersecurity readiness",
    description:
      "Understand identity, public exposure, incident preparation, and the controls that reduce avoidable business risk.",
    detail: "Identity • Exposure • Response",
    href: "/services",
    accent: "cyan",
  },
  {
    num: "02",
    icon: Building2,
    title: "Financial & operational risk",
    description:
      "Review account access, payment-change controls, vendor dependencies, and continuity decisions without unsupported guarantees.",
    detail: "Fraud awareness • Continuity",
    href: "/products/financial",
    accent: "violet",
  },
  {
    num: "03",
    icon: FileCheck2,
    title: "Compliance & asset protection",
    description:
      "Identify documentation and readiness gaps, then route specialist needs through verified scope and appropriate approvals.",
    detail: "Documentation • Governance",
    href: "/products/real-estate",
    accent: "amber",
  },
] as const;

const process = [
  {
    step: "01",
    title: "Discover",
    text: "Start with the public readiness checklist or a general inquiry. Sensitive evidence is not required at this stage.",
  },
  {
    step: "02",
    title: "Review",
    text: "GEM checks fit, scope, authorization and the next appropriate action before confirming a paid engagement.",
  },
  {
    step: "03",
    title: "Engage",
    text: "Approved work moves into the existing GEM Enterprise intake, proposal, workspace and support flow.",
  },
] as const;

const faqs = [
  {
    question: "Do I have to pay before submitting a request?",
    answer:
      "No. The readiness checklist and initial request do not activate a paid service. If a scoped review is appropriate, the price and terms are confirmed before the engagement starts.",
  },
  {
    question: "Is the founding review a penetration test or certification?",
    answer:
      "No. The founding Business Security & Operations Review is a bounded assessment and action-planning engagement, not destructive testing, certification, or guaranteed monitoring.",
  },
  {
    question: "What happens to my inquiry?",
    answer:
      "Requests made on GEM Enterprise enter its governed intake and qualification workflow. The separate Wix inquiry form is an additional contact channel and does not automatically create a GEM client workspace.",
  },
] as const;

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
      {children}
    </p>
  );
}

export default function MarketEntryPage() {
  return (
    <div className="overflow-hidden bg-[#0d121b] text-[#f8f9fa]">
      {/* Hero: a single prominent story and clear, governed next action. */}
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_25%,rgba(0,217,230,0.13),transparent_40%),radial-gradient(ellipse_at_10%_80%,rgba(81,38,102,0.20),transparent_48%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:80px_80px]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20 lg:pb-32 lg:pt-32">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold tracking-wide text-cyan-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              GEM ENTERPRISE · MARKET ENTRY
            </span>
            <h1 className="mt-8 max-w-4xl text-[clamp(2.8rem,5.3vw,5.3rem)] font-extrabold leading-[1.07] tracking-[-0.055em] text-white">
              Your business deserves
              <span className="block bg-gradient-to-r from-cyan-200 via-cyan-400 to-teal-200 bg-clip-text text-transparent">
                clarity before crisis.
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
              Practical cybersecurity, fraud-awareness and resilience guidance
              for businesses that need to know what matters, what to fix, and
              where to begin.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={reviewUrl}
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_48px_rgba(0,217,230,0.14)] transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 motion-reduce:transition-none"
              >
                Request a business review
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={checklistUrl}
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 motion-reduce:transition-none"
              >
                Free readiness checklist
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-6 max-w-lg text-xs leading-6 text-slate-400">
              No payment or service activation from a request. Assessments,
              monitoring and response depend on authorization, scope and
              confirmed provider availability.
            </p>
          </div>
          <div aria-label="Illustrative business security review dashboard" className="relative">
            <div aria-hidden="true" className="absolute -inset-5 rounded-[2.25rem] border border-cyan-300/10" />
            <div className="relative overflow-hidden rounded-[1.8rem] border border-white/15 bg-[#172231] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-wide text-white">GEM / READINESS</p>
                    <p className="text-xs text-slate-400">A clearer first assessment</p>
                  </div>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.65rem] font-bold tracking-wider text-cyan-200">
                  SAMPLE VIEW
                </span>
              </div>
              <div className="space-y-5 px-6 py-7">
                <p className="text-sm font-semibold text-slate-200">Areas to examine</p>
                {[
                  { label: "Account ownership & access", value: "Identify" },
                  { label: "Backups & recovery", value: "Validate" },
                  { label: "Payment diversion risks", value: "Review" },
                  { label: "Incident readiness", value: "Plan" },
                ].map((item, i) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-cyan-200">
                        0{i + 1}
                      </span>
                      <span className="text-sm text-slate-200">{item.label}</span>
                    </div>
                    <span className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t border-cyan-300/10 bg-cyan-300/[0.055] px-6 py-5 text-sm text-cyan-100">
                <ClipboardCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                Prioritize actions. Confirm scope. Move forward.
              </div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-7 -left-7 h-20 w-20 rounded-3xl border border-cyan-300/10 bg-cyan-300/[0.07]" />
          </div>
        </div>
      </section>

      <section aria-label="Our approach" className="border-b border-white/10 bg-[#111a26]">
        <div className="mx-auto grid max-w-7xl divide-y divide-white/10 px-6 py-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["Evidence-led", "Claims grounded in verified findings"],
            ["Human-governed", "Approval before sensitive action"],
            ["Scope-first", "Clear services and responsibilities"],
          ].map(([title, description]) => (
            <div key={title} className="flex items-start gap-3 py-4 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-400">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="solutions" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
        <SectionEyebrow>Where we help</SectionEyebrow>
        <div className="mt-5 flex max-w-5xl flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Focused services. No crowded catalog.
          </h2>
          <p className="max-w-md text-sm leading-7 text-slate-400">
            Three straightforward ways to begin. Each engagement has its own
            eligibility, boundaries and confirmed scope.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {priorities.map((item) => {
            const Icon = item.icon;
            const topAccent = item.accent === "cyan" ? "bg-cyan-300" : item.accent === "violet" ? "bg-violet-400" : "bg-amber-300";
            return (
              <article key={item.num} className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#17202d] p-7 transition hover:border-cyan-300/35 hover:bg-[#1b2838] motion-reduce:transition-none">
                <span aria-hidden="true" className={"absolute left-0 top-0 h-1 w-full " + topAccent} />
                <div className="flex items-center justify-between">
                  <span className="rounded-xl border border-white/10 bg-white/5 p-3 text-cyan-200">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs tracking-widest text-slate-500">{item.num} / 03</span>
                </div>
                <h3 className="mt-9 text-2xl font-bold tracking-tight text-white">{item.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-slate-300">{item.description}</p>
                <p className="mt-7 border-t border-white/10 pt-6 text-xs font-medium uppercase tracking-wider text-slate-400">
                  {item.detail}
                </p>
                <Link href={item.href} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 transition hover:gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 motion-reduce:transition-none">
                  Explore service area <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111a26]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <SectionEyebrow>Our process</SectionEyebrow>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
              From first question to a clear next step.
            </h2>
            <p className="mt-5 max-w-md text-base leading-8 text-slate-400">
              Wix can remain a lightweight contact and booking channel.
              Sensitive client work and approvals stay inside GEM Enterprise.
            </p>
            <Link href="/enterprise/apply" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100">
              Open the enterprise intake route <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ol className="space-y-4">
            {process.map((item) => (
              <li key={item.step} className="flex gap-5 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <span className="font-mono text-lg font-bold text-cyan-300">{item.step}</span>
                <div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="review" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
        <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_90%_10%,rgba(0,217,230,0.14),transparent_40%),#17202d] p-8 sm:p-12 lg:p-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.74fr] lg:items-center">
            <div>
              <SectionEyebrow>Our founding offer</SectionEyebrow>
              <h2 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
                {foundingBusinessReviewOffer.name}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                {foundingBusinessReviewOffer.promise}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <span className="text-4xl font-extrabold text-cyan-200">
                  {foundingBusinessReviewOffer.priceLabel}
                </span>
                <span className="text-xs leading-6 text-slate-400">
                  Subject to eligibility, agreed scope and approval. No charge
                  or activation when requesting information.
                </span>
              </div>
              <Link href={reviewFooterUrl} className="mt-9 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 motion-reduce:transition-none">
                Request the founding review <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="rounded-2xl border border-white/15 bg-[#0f1824]/70 p-6 sm:p-8">
              <p className="mb-6 text-sm font-bold uppercase tracking-[0.12em] text-slate-300">What is included</p>
              <ul className="space-y-5">
                {foundingBusinessReviewOffer.includes.slice(0, 6).map((detail) => (
                  <li key={detail} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                    {detail}
                  </li>
                ))}
              </ul>
              <p className="mt-8 border-t border-white/10 pt-6 text-xs leading-6 text-slate-400">
                Not a penetration test, certification, legal opinion or promise
                of continuous monitoring. Additional work is separately scoped.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111a26]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <SectionEyebrow>Questions answered</SectionEyebrow>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Simple from the start.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Understand the difference between exploring services and
              authorizing an engagement.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 open:border-cyan-300/30">
                <summary className="cursor-pointer pr-5 text-sm font-semibold leading-6 text-white marker:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                  {faq.question}
                </summary>
                <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-7 text-slate-300">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="flex flex-col justify-between gap-8 rounded-3xl border border-white/10 bg-[#17202d] p-8 sm:p-10 lg:flex-row lg:items-center">
          <div>
            <SectionEyebrow>Ready to talk?</SectionEyebrow>
            <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-white">
              Start with a question. Leave with a direction.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
              Prefer a simple inquiry instead of a full business review request?
              Use the existing Wix contact channel. Avoid sending confidential
              evidence through public forms.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <a href={wixInquiryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
              <FileText className="h-4 w-4" aria-hidden="true" /> General inquiry
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link href="/contact" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
              <Globe2 className="h-4 w-4" aria-hidden="true" /> Contact GEM
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Privacy-aware inquiries</span>
          <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" aria-hidden="true" /> Governed campaign attribution</span>
          <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Scope before engagement</span>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Looking for support for yourself or your family?{" "}
          <Link href="/personal-security" className="font-semibold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 transition hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
            Explore personal &amp; family security
          </Link>
        </p>
      </section>
    </div>
  );
}
