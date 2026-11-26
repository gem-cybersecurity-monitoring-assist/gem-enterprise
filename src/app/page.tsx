import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  ChevronDown,
  FileText,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HomeStoreShowcase } from "@/components/store/HomeStoreShowcase";
import { InteractiveEarthShowcase } from "@/components/home/InteractiveEarthShowcase";
import { ProjectWorkspaceShowcase } from "@/components/home/ProjectWorkspaceShowcase";
import { PlatformAccessDirectory } from "@/components/home/PlatformAccessDirectory";
import { foundingBusinessReviewOffer } from "@/lib/market/launchOffer";
import { buildBusinessReviewCampaignUrl } from "@/lib/market/gtmActivation";

export const metadata = {
  title: "GEM Enterprise | Defend. Protect. Prevail.",
  description:
    "GEM Enterprise provides access-controlled cybersecurity, compliance, financial-security coordination, and property-risk services subject to eligibility, scope, and signed agreements.",
};

const stats = [
  { value: "Controlled", label: "Client Access" },
  { value: "RBAC", label: "Role-Based Controls" },
  { value: "Audited", label: "Security Events" },
  { value: "Scoped", label: "Service Activation" },
];

const services = [
  {
    icon: Shield,
    title: "Cybersecurity Services",
    description:
      "Monitoring, assessment, incident-response coordination, and exposure-review services activated only after technical scope and provider coverage are confirmed.",
    tags: ["Assessment", "Monitoring", "Response"],
    href: "/services",
    color: "cyan",
    image:
      "https://media.base44.com/images/public/69d42975b7b1794c3dc01661/5c6e6baaf_generated_image.png",
  },
  {
    icon: Landmark,
    title: "Financial-Security Coordination",
    description:
      "Risk-review, fraud-prevention, documentation, and specialist-coordination workflows. GEM does not promise custody, recovery, returns, or regulated financial services through this public page.",
    tags: ["Risk Review", "Controls", "Coordination"],
    href: "/products/financial",
    color: "purple",
    image:
      "https://media.base44.com/images/public/69d42975b7b1794c3dc01661/9b9d1f784_generated_image.png",
  },
  {
    icon: Building2,
    title: "Property & Asset Risk",
    description:
      "Property-risk review, documentation support, fraud-awareness, and authorized specialist referrals subject to ownership, legal authority, and jurisdictional review.",
    tags: ["Property", "Documentation", "Risk"],
    href: "/products/real-estate",
    color: "amber",
    image:
      "https://media.base44.com/images/public/69d42975b7b1794c3dc01661/1f7e5fb1b_generated_image.png",
  },
];

const features = [
  {
    icon: LayoutDashboard,
    title: "Authenticated Dashboard",
    description: "Access-controlled portfolio, request, review, and operational views.",
  },
  {
    icon: ShieldCheck,
    title: "Eligibility & Review",
    description: "Applicant status, human review, approval gates, and entitlement controls.",
  },
  {
    icon: MessageSquare,
    title: "Support Workflows",
    description: "Structured enquiries, escalation paths, and auditable support activity.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "In-app and configured delivery channels, subject to verified provider setup.",
  },
  {
    icon: FileText,
    title: "Document Controls",
    description: "Document metadata and review workflows; sensitive upload remains disabled until secure storage is verified.",
  },
  {
    icon: Users,
    title: "Role Management",
    description: "Client, analyst, reviewer, administrator, and entitlement-based access patterns.",
  },
];

const previewItems = [
  {
    category: "Cyber",
    title: "Advisory presentation preview",
    summary:
      "Shows how a sourced security advisory may be organized after source, timestamp, confidence, and affected-product validation.",
  },
  {
    category: "Financial",
    title: "Fraud-pattern briefing preview",
    summary:
      "Shows a planned format for documenting account-takeover or payment-diversion indicators without claiming a live event.",
  },
  {
    category: "Property",
    title: "Property-risk briefing preview",
    summary:
      "Shows a planned format for title, ownership, and payment-risk review after authoritative records are verified.",
  },
];

const homepageHeroReviewHref = buildBusinessReviewCampaignUrl({
  source: "homepage",
  medium: "hero",
});
const homepageFooterReviewHref = buildBusinessReviewCampaignUrl({
  source: "homepage",
  medium: "footer-cta",
});

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://media.base44.com/images/public/69d42975b7b1794c3dc01661/b42c69a20_generated_image.png"
            alt="Illustrative global security-network concept"
            fill
            className="object-cover opacity-20"
            priority
          />
          <InteractiveEarthShowcase />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/90" />
        </div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 h-96 w-96 rounded-full bg-purple-600 blur-3xl" />
        </div>
        <div className="container relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
          <Badge className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs uppercase tracking-widest text-cyan-400">
            <Activity className="h-3 w-3" aria-hidden="true" />
            CONTROLLED PRODUCTION LAUNCH — 2026
          </Badge>
          <h1 className="mb-6 text-6xl font-black leading-none md:text-8xl">
            <span className="block text-cyan-400">Defend.</span>
            <span className="block text-white">Protect.</span>
            <span className="block text-white">Prevail.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-center text-lg leading-relaxed text-slate-300">
            GEM Enterprise is an access-controlled platform for cybersecurity, compliance,
            financial-security coordination, and property-risk services. Sensitive and
            high-impact services are activated only after eligibility, scope, provider,
            jurisdiction, and contractual checks are complete.
          </p>
          <div className="mb-5 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-cyan-400 px-8 font-semibold text-black hover:bg-cyan-500">
              <Link href={homepageHeroReviewHref}>
                Start ${foundingBusinessReviewOffer.priceUsd} Business Review <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-cyan-400/30 px-8 font-semibold text-cyan-200 hover:bg-cyan-400/10">
              <Link href="/services">
                Browse Services <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 px-8 font-semibold text-white hover:bg-white/10">
              <Link href="/get-started">
                Enterprise Access <ChevronDown className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <Link
            href="/enterprise-solutions"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            Explore Enterprise Solutions <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="w-full border-y border-white/10 bg-background/40 py-12">
        <div className="container mx-auto max-w-screen-2xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={stat.label} className={index < 3 ? "border-r border-cyan-500/20" : undefined}>
                <div className="mb-1 text-2xl font-black text-cyan-400">{stat.value}</div>
                <div className="text-xs uppercase tracking-widest text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProjectWorkspaceShowcase />

      <PlatformAccessDirectory />

      <section className="container mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 text-center">
          <Badge className="mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-widest text-slate-400">
            Service areas
          </Badge>
          <h2 className="mb-4 text-4xl font-black text-white md:text-5xl">
            Clear scope before activation
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Public descriptions explain possible capabilities. Actual availability,
            coverage, staffing, deliverables, response targets, fees, and limitations are
            defined in an approved proposal and signed agreement.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const borderColor =
              service.color === "cyan"
                ? "border-cyan-500/30 hover:border-cyan-400"
                : service.color === "purple"
                  ? "border-purple-500/30 hover:border-purple-400"
                  : "border-amber-500/30 hover:border-amber-400";
            const tagColor =
              service.color === "cyan"
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                : service.color === "purple"
                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20";

            return (
              <Link
                key={service.title}
                href={service.href}
                className={`group relative overflow-hidden rounded-2xl border bg-white/[0.02] transition-all hover:-translate-y-1 hover:bg-white/[0.04] ${borderColor}`}
              >
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={service.image}
                    alt={`Illustrative concept for ${service.title}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white/70">
                    Illustrative image
                  </span>
                  <div className="absolute left-4 top-4">
                    <Badge className={`rounded-full border text-xs ${tagColor}`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {service.tags[0]}
                    </Badge>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="mb-3 text-xl font-bold text-white transition-colors group-hover:text-cyan-400">
                    {service.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-slate-400">{service.description}</p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {service.tags.map((tag) => (
                      <span key={tag} className={`rounded border px-2 py-0.5 text-xs ${tagColor}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center text-sm font-semibold text-cyan-400">
                    Review details <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <HomeStoreShowcase />

      <section className="border-y border-white/10 bg-white/[0.02] py-24">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <Badge className="mb-4 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs uppercase tracking-widest text-amber-200">
              Controlled activation
            </Badge>
            <h2 className="mb-4 text-4xl font-black text-white">Built to fail closed</h2>
            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-slate-400">
              Features that depend on unverified storage, providers, staffing, or external
              integrations remain restricted instead of pretending to be operational. For
              example, identity-document upload is disabled until private storage and malware
              scanning are verified end to end.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-xl border border-white/10 bg-background/40 p-6 transition-all hover:border-cyan-500/30">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                    <Icon className="h-5 w-5 text-cyan-400" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 font-bold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/architecture">
                Review platform architecture <LockKeyhole className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="relative h-[380px] overflow-hidden rounded-2xl">
            <Image
              src="https://media.base44.com/images/public/69d42975b7b1794c3dc01661/fe8b6bcec_generated_image.png"
              alt="Illustrative intelligence-reporting interface"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white/70">
              Demonstration image
            </span>
          </div>
          <div>
            <Badge className="mb-4 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs uppercase tracking-widest text-amber-200">
              Intelligence preview
            </Badge>
            <h2 className="mb-6 text-4xl font-black text-white">Example reporting—not a live feed</h2>
            <div className="space-y-4">
              {previewItems.map((item) => (
                <article key={item.title} className="rounded-xl border border-white/10 bg-background/60 p-5">
                  <Badge className="mb-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-xs text-cyan-400">
                    {item.category}
                  </Badge>
                  <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{item.summary}</p>
                </article>
              ))}
            </div>
            <Link href="/intel" className="mt-6 inline-flex items-center gap-2 font-semibold text-cyan-400 transition-all hover:gap-3">
              Review intelligence disclosure <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="github-sponsors-heading" className="container mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 id="github-sponsors-heading" className="mb-4 text-3xl font-bold text-white">
          Support open-source development
        </h2>
        <p className="mb-6 text-slate-400">
          Help maintain the GEM tracked-secret scanner, an independently usable Apache-2.0 Python utility for checking selected credential exposure patterns in Git-tracked files.
        </p>
        <div className="mb-6 grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 p-4">
            <h3 className="font-semibold text-white">Detection and testing</h3>
            <p className="mt-2 text-sm text-slate-400">Support maintenance of detection rules and synthetic regression tests.</p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <h3 className="font-semibold text-white">Developer adoption</h3>
            <p className="mt-2 text-sm text-slate-400">Help improve installation guides, CI integration and reproducible examples.</p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <h3 className="font-semibold text-white">Open development</h3>
            <p className="mt-2 text-sm text-slate-400">Support transparent maintenance, release notes and community feedback.</p>
          </div>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-400">
          Sponsorship is voluntary and does not purchase GEM services, ownership, exclusivity or guaranteed security outcomes. The scanner is a supplemental check, not a comprehensive security solution.
        </p>
        <a
          href="https://github.com/gem-cybersecurity-monitoring-assist/gem-enterprise/tree/main/open-source/tracked-secret-scanner"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-block text-sm font-semibold text-cyan-400 underline underline-offset-4"
        >
          Explore the scanner, usage instructions and maintenance roadmap
        </a>
        <div className="mx-auto flex w-full flex-col items-center gap-4">
          <iframe
            src="https://github.com/sponsors/support371/button"
            title="Sponsor support371"
            height={32}
            width={114}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="rounded-md border-0"
          />
          <iframe
            src="https://github.com/sponsors/support371/card"
            title="GitHub Sponsors profile for support371"
            height={225}
            width={600}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full max-w-[600px] border-0"
          />
          <a
            href="https://github.com/sponsors/support371"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-cyan-400 underline underline-offset-4"
          >
            Open the GitHub Sponsors page
          </a>
        </div>
      </section>

      <section className="container mx-auto px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-5xl font-black text-white">Start with a paid review, then expand what proves useful</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400">
            Small and growing businesses can begin with the {foundingBusinessReviewOffer.priceLabel}.
            Broader enterprise, monitoring, financial-security, and jurisdiction-restricted services
            continue through qualification and approved scope.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-cyan-400 px-10 font-semibold text-black hover:bg-cyan-500">
              <Link href={homepageFooterReviewHref}>
                Request Business Review <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 px-10 font-semibold text-white hover:bg-white/10">
              <Link href="/get-started">Enterprise Access</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
