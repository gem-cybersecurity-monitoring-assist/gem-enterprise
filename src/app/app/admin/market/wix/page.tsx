import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * GEM's operator-owned front door for its connected Classic Wix site.
 * This does not proxy the Wix admin, modify the Editor, or claim to be a live API health view.
 */
const wix = {
  dashboard: "https://manage.wix.com/dashboard/fcfea988-421b-4278-b5e5-dfbb7ee1532d",
  website: "https://firmgem.wixsite.com/gem-assist-1",
  inquiry: "https://firmgem.wixforms.com/f/7515843603776668706",
  article:
    "https://firmgem.wixsite.com/gem-assist-1/post/gem-enterprise-security-readiness-first-steps-for-business-owners",
  operationsArt:
    "https://static.wixstatic.com/media/1c4f14_bea61101b3ad4719bddcda39ec42f3ac~mv2.png",
  review:
    "https://www.gemcybersecurityassist.com/business-review?lead=referral&campaign=founding-first-20&utm_source=wix-gem-assist-1&utm_medium=organic&utm_campaign=founding-first-20",
} as const;

const workspaces = [
  {
    name: "Wix site dashboard",
    description: "Open the official account to manage published pages, media, forms, and native apps.",
    href: wix.dashboard,
    icon: LayoutDashboard,
    external: true,
  },
  {
    name: "Live marketing website",
    description: "Inspect what visitors can actually see before promoting any campaign.",
    href: wix.website,
    icon: ExternalLink,
    external: true,
  },
  {
    name: "Public general inquiry",
    description: "Standalone form for low-sensitivity messages, separate from GEM governed onboarding.",
    href: wix.inquiry,
    icon: LifeBuoy,
    external: true,
  },
  {
    name: "Published security resource",
    description: "Educational article linking visitors toward the existing GEM intake flow.",
    href: wix.article,
    icon: BookOpen,
    external: true,
  },
  {
    name: "GEM campaign governance",
    description: "Review marketing campaigns and consent gates without auto-sending.",
    href: "/app/admin/campaigns",
    icon: ShieldCheck,
    external: false,
  },
  {
    name: "GEM GTM activation",
    description: "Manage the already-built market-entry calendar, review offer, and acquisition plan.",
    href: "/app/admin/market/activation",
    icon: Palette,
    external: false,
  },
  {
    name: "GEM Social Media Studio",
    description: "Reuse the existing studio to prepare content and review provider readiness before approved distribution.",
    href: "/app/social-media",
    icon: Palette,
    external: false,
  },
] as const;

const gates = [
  {
    title: "Apply GEM typography",
    detail:
      "In Wix Classic Editor: Site Design → Text theme. Use Inter as the heading and paragraph family to match the existing GEM platform.",
  },
  {
    title: "Replace legacy homepage imagery",
    detail:
      "Select the new 'GEM Enterprise — Updated Security Operations Center' file in Wix Media Manager. It is illustrative artwork, not evidence of a staffed live SOC.",
  },
  {
    title: "Repair mobile layout",
    detail:
      "Remove the duplicated 'Protecting Data' blocks, ensure hero/media fit the mobile viewport, and set appropriate heading order and image alt text.",
  },
  {
    title: "Simplify irrelevant features",
    detail:
      "Hide restaurants, reservations, hotel and sample-store pages in the Editor only after confirming their data and dependencies. Do not delete customer records or consultations.",
  },
  {
    title: "Verify and release",
    detail:
      "Finish all remaining serious accessibility findings, test public inquiry and bookings, verify consent and external handoff, then publish only after preview approval.",
  },
] as const;

function ExternalAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-300/40 bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      {children}<ArrowUpRight aria-hidden className="h-4 w-4" />
    </a>
  );
}

export default function WixMarketEntryConsolePage() {
  return (
    <main className="space-y-8 animate-fade-in">
      <header className="space-y-5">
        <Link href="/app/admin/market/operations" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Commercial operations
        </Link>
        <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-[#07182b] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative z-10 grid gap-7 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div className="space-y-4">
              <Badge className="border border-amber-400/30 bg-amber-400/10 text-amber-200">GEM Enterprise • Market entry</Badge>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Wix Brand &amp; Marketing Control
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Your GEM-branded operating entry to the existing Wix website, identity assets and
                governed enterprise marketing. This is a linked control workspace, not a replacement
                for Wix&apos;s native dashboard or an automatic sync to Wix Editor.
              </p>
              <div className="flex flex-wrap gap-3">
                <ExternalAction href={wix.dashboard}>Open Wix Dashboard</ExternalAction>
                <Button asChild variant="outline" className="min-h-11 border-cyan-400/30 text-cyan-200">
                  <a href={wix.website} target="_blank" rel="noopener noreferrer">
                    Visit live site <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs leading-5 text-slate-400">
                Free-plan first • Inter typography • navy/charcoal, cyan and gold accents •
                no paid upgrades or automatic publishing.
              </p>
            </div>
            <a
              href={wix.operationsArt}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-white/15 bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              aria-label="Open illustrative GEM Security Operations Center artwork"
            >
              <Image
                src={wix.operationsArt}
                alt="Illustration of a cybersecurity operations team reviewing digital security dashboards."
                fill
                unoptimized
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-contain"
              />
              <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-medium text-white">
                <ImageIcon aria-hidden className="h-4 w-4 text-amber-300" /> Illustrative artwork
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </a>
          </div>
        </div>
      </header>

      <section aria-labelledby="wix-links-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Only what you need</p>
          <h2 id="wix-links-heading" className="mt-1 text-xl font-bold text-white">Management shortcuts</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((item) => (
            <Card key={item.name} className="border-white/10 bg-card transition hover:border-cyan-400/35">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <item.icon aria-hidden className="h-5 w-5 text-cyan-300" /> {item.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-12 text-sm leading-6 text-slate-400">{item.description}</p>
                {item.external ? (
                  <a className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-300 underline-offset-4 hover:underline" href={item.href} target="_blank" rel="noopener noreferrer">
                    Open <ArrowUpRight aria-hidden className="h-4 w-4" />
                  </a>
                ) : (
                  <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-300 underline-offset-4 hover:underline" href={item.href}>
                    Open <ArrowUpRight aria-hidden className="h-4 w-4" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="handoff-heading" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="handoff-heading" className="flex items-center gap-2 text-lg font-bold text-white">
              <ShieldCheck className="h-5 w-5 text-cyan-300" /> Official GEM intake handoff
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Use the existing attributed Business Security &amp; Operations Review link for
              qualification and approvals. The standalone Wix form does not automatically become a GEM client record.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              The $199 GEM Business Security &amp; Operations Review is separate from Wix consultations
              listed at $200 and $300. A request is not an approval, service activation, or charge.
            </p>
          </div>
          <ExternalAction href={wix.review}>View tracked review</ExternalAction>
        </div>
      </section>

      <section aria-labelledby="wix-checklist-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 text-amber-300" />
          <h2 id="wix-checklist-heading" className="text-xl font-bold text-white">Editor release checklist</h2>
        </div>
        <p className="text-sm text-slate-400">
          These are outstanding Editor actions, not completed changes or automatically checked live statuses.
          The assessment completed on 13 October 2026 at 23:12 UTC reported 15 serious findings across 20 pages.
          This is a dated baseline, not a current passing scan.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {gates.map((gate, i) => (
            <div key={gate.title} className="flex gap-3 rounded-xl border border-white/10 bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-xs font-bold text-amber-200">{i + 1}</span>
              <div>
                <h3 className="font-semibold text-white">{gate.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{gate.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex items-start gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-sm leading-6 text-slate-300">
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p>Brand image is stored in Wix Media Manager. This hub has no write access to Wix pages, billing,
          orders or customer data. Wix and GEM remain separately governed until explicit integration tests pass.</p>
      </footer>
    </main>
  );
}
