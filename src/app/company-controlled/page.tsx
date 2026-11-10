import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileSearch,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Company | GEM Enterprise",
  description:
    "Verified public overview of GEM Enterprise, its operating principles, service boundaries, and publication controls.",
};

const functions = [
  {
    icon: ShieldCheck,
    title: "Cybersecurity and risk coordination",
    description:
      "GEM develops and coordinates approved security, monitoring, incident-response, and risk-management scopes for eligible clients. Exact delivery arrangements are confirmed in writing.",
  },
  {
    icon: Scale,
    title: "Compliance readiness support",
    description:
      "GEM may support policy, control, evidence, and remediation planning. This work does not itself constitute legal advice, certification, licensing, or an accredited audit.",
  },
  {
    icon: Building2,
    title: "Financial and property-risk support",
    description:
      "Risk review, documentation, provider coordination, and specialist referrals are subject to legal authority, jurisdiction, ownership verification, and approved engagement limits.",
  },
  {
    icon: FileSearch,
    title: "Evidence-led publication",
    description:
      "Public statements about people, staffing, credentials, memberships, partnerships, performance, and availability require current evidence and publication approval.",
  },
];

const publicTeamAreas = [
  {
    title: "GEM Cybersecurity & Monitoring Assist",
    summary: "Security coordination, threat research, control evidence and incident readiness.",
    functions: ["Security oversight and monitoring", "Threat analysis and defensive research", "Compliance and response coordination"],
  },
  {
    title: "Alliance Trust Realty (ATR)",
    summary: "Property-related advisory workflow, client communications and documentation review.",
    functions: ["Property enquiry and documentation", "Agent and client coordination", "Specialist referral and licensing checks"],
  },
  {
    title: "Executive & governance functions",
    summary: "Strategic oversight, restricted relationship management and approval processes.",
    functions: ["Executive direction and decision review", "Restricted client matters", "Compliance and publication oversight"],
  },
  {
    title: "Shared enterprise operations",
    summary: "Cross-division systems, support processes and communications.",
    functions: ["Software and platform operations", "Client intake and service routing", "Financial-support coordination, people and communications"],
  },
] as const;

export default function ControlledCompanyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/60 px-6 py-24 cyber-grid">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified public overview
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Security, compliance readiness, and asset-risk coordination with controlled claims.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            GEM Enterprise presents only the operating information that can be stated responsibly
            at public level. Engagement-specific personnel, providers, service levels, and regulated
            activities are confirmed during qualification and contracting.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {functions.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-border/70 bg-card/70 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="leadership" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-16" aria-labelledby="leadership-overview-heading">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <UsersRound className="h-6 w-6 text-primary" aria-hidden="true" />
            <h2 id="leadership-overview-heading" className="text-2xl font-semibold">Leadership &amp; organizational oversight</h2>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
            GEM Enterprise maintains a documented structure for executive review, cybersecurity governance,
            Alliance Trust Realty advisory coordination and shared service operations. This outline describes
            responsibilities and planning—not a verified list of appointed officers, employees, or current
            service staffing. Named biographies and credentials require separate publication approval.
          </p>
        </div>
      </section>

      <section id="teams" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-16" aria-labelledby="teams-overview-heading">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="teams-overview-heading" className="text-3xl font-semibold">Enterprise teams &amp; functions</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Explore the functional areas represented in the company model. Descriptions are organizational
              guidance; individual staff assignments, operating coverage and regulated authorization are
              reviewed separately before being represented publicly.
            </p>
          </div>
          <Link href="/personnel" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20">
            Approved personnel directory <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {publicTeamAreas.map((area) => (
            <article key={area.title} className="rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7">
              <h3 className="text-xl font-semibold">{area.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{area.summary}</p>
              <ul className="mt-5 space-y-2">
                {area.functions.map((responsibility) => (
                  <li key={responsibility} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {responsibility}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="mt-5 text-xs leading-6 text-muted-foreground">
          The complete operational team and image review system is restricted to authorized enterprise
          administrators. Photographs of named people are not publicly displayed without documented
          identity matching, image consent and role approval.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border/70 bg-card/70 p-6">
            <UsersRound className="h-6 w-6 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold">Leadership and personnel publication</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Names, titles, biographies, photographs, qualifications, employment histories, and
              team-size statements are published only after identity, role, evidence, and consent
              checks are complete.
            </p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-card/70 p-6">
            <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold">Associations and providers</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              A vendor account, software subscription, professional membership, referral, or
              informal collaboration is not described as a partnership unless the relationship and
              public wording are verified and authorized.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8">
          <h2 className="text-2xl font-semibold">Discuss a qualified engagement</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Availability, jurisdiction, staffing, response targets, providers, and final scope are
            confirmed before activation.
          </p>
          <Link
            href="/get-started"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start qualification <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
