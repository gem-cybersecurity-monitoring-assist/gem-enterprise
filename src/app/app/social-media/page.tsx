import { socialSuiteHref, socialWorkspaceId, type SocialWorkspaceSearchParams } from "@/lib/social-media/channel-routes";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  CircleOff,
  Film,
  Layers3,
  ListChecks,
  Megaphone,
  Network,
  PenSquare,
  Settings2,
  ShieldCheck,
  Video,
} from "lucide-react";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";

const modules = [
  {
    href: "/app/social-media/accounts",
    label: "Social Accounts",
    description: "Connect approved Pages, professional accounts, organizations, channels, and employer feeds.",
    icon: Network,
    accent: "text-cyan-300",
    surface: "bg-cyan-500/10",
  },
  {
    href: "/app/social-media/content",
    label: "Content Production",
    description: "Prepare governed campaign packages, captions, scripts, creative briefs, and channel variants.",
    icon: Megaphone,
    accent: "text-violet-200",
    surface: "bg-violet-500/10",
  },
  {
    href: "/app/social-media/create",
    label: "Create Content",
    description: "Generate governed text, image, and video-ready channel variants from approved source material.",
    icon: PenSquare,
    accent: "text-fuchsia-200",
    surface: "bg-fuchsia-500/10",
  },
  {
    href: "/app/social-media/campaigns",
    label: "Campaigns",
    description: "Load, generate, and inspect the real daily content plan and campaign production state.",
    icon: Layers3,
    accent: "text-cyan-200",
    surface: "bg-cyan-500/10",
  },
  {
    href: "/app/social-media/video",
    label: "Video Studio",
    description: "Move approved recipes through rendering, asset verification, private preview, and reapproval.",
    icon: Video,
    accent: "text-rose-200",
    surface: "bg-rose-500/10",
  },
  {
    href: "/app/social-media/tokmetric",
    label: "TokMetric",
    description: "Operate TikTok accounts, compliance, approvals, publishing preparation, analytics, and agents.",
    icon: Film,
    accent: "text-fuchsia-200",
    surface: "bg-fuchsia-500/10",
  },
  {
    href: "/app/social-media/approvals",
    label: "Compliance & Approvals",
    description: "Review claims, disclosures, media rights, exact versions, and human publishing decisions.",
    icon: CheckSquare2,
    accent: "text-emerald-300",
    surface: "bg-emerald-500/10",
  },
  {
    href: "/app/social-media/calendar",
    label: "Publishing Calendar",
    description: "Coordinate approved content, destination readiness, publishing windows, and queue handoffs.",
    icon: CalendarDays,
    accent: "text-amber-200",
    surface: "bg-amber-500/10",
  },
  {
    href: "/app/social-media/queue",
    label: "Publishing Queue",
    description: "Inspect real scheduled, blocked, retrying, failed, and published jobs without triggering a write.",
    icon: ListChecks,
    accent: "text-amber-200",
    surface: "bg-amber-500/10",
  },
  {
    href: "/app/social-media/analytics",
    label: "Analytics & Learning",
    description: "Review verified performance signals and feed useful learnings back into future content plans.",
    icon: BarChart3,
    accent: "text-sky-200",
    surface: "bg-sky-500/10",
  },
  {
    href: "/app/social-media/settings",
    label: "Provider Settings",
    description: "Review account authorization, connector readiness, and the remaining provider activation gates.",
    icon: Settings2,
    accent: "text-emerald-200",
    surface: "bg-emerald-500/10",
  },
] as const;

const workflow = [
  ["1", "Connect", "Authorize the correct business destinations without sharing account passwords."],
  ["2", "Create", "Generate platform-specific copy, images, carousels, scripts, and video recipes."],
  ["3", "Review", "Run compliance checks and bind human approval to the exact content version."],
  ["4", "Schedule", "Place approved content into a governed publishing window and destination queue."],
  ["5", "Measure", "Use source-labeled analytics to improve the next plan without inventing results."],
] as const;

export default async function SocialMediaSuiteOverviewPage({ searchParams }: { searchParams: Promise<SocialWorkspaceSearchParams> }) {
  const workspaceId = socialWorkspaceId(await searchParams);
  const providers = getSocialMediaProviderReadiness();
  const configured = providers.filter((provider) => provider.configurationReady).length;
  const approved = providers.filter(
    (provider) => !provider.platformApprovalRequired || provider.platformApprovalGranted,
  ).length;
  const writable = providers.filter((provider) => provider.externalWriteAllowed).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Destinations</p>
          <p className="mt-3 text-3xl font-bold text-white">{providers.length}</p>
          <p className="mt-2 text-sm text-slate-400">Registered social and employer channels</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Configured</p>
          <p className="mt-3 text-3xl font-bold text-cyan-300">{configured}</p>
          <p className="mt-2 text-sm text-slate-400">Application configuration available</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Approval ready</p>
          <p className="mt-3 text-3xl font-bold text-emerald-300">{approved}</p>
          <p className="mt-2 text-sm text-slate-400">No outstanding platform approval flag</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">External writes</p>
          <p className="mt-3 text-3xl font-bold text-amber-200">{writable}</p>
          <p className="mt-2 text-sm text-slate-400">Live destinations currently passing every gate</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ href, label, description, icon: Icon, accent, surface }) => (
          <Link
            key={href}
            href={socialSuiteHref(href, workspaceId)}
            className="group rounded-2xl border border-white/10 bg-card/75 p-5 transition hover:-translate-y-0.5 hover:border-cyan-500/25 hover:bg-white/[0.04]"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${surface}`}>
              <Icon className={`h-5 w-5 ${accent}`} />
            </div>
            <div className="mt-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white group-hover:text-cyan-200">{label}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-bold text-white">Managed publishing lifecycle</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {workflow.map(([number, label, description]) => (
              <div key={number} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-bold text-cyan-300">
                  {number}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">{label}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-amber-200">
            {writable > 0 ? <CheckCircle2 className="h-5 w-5" /> : <CircleOff className="h-5 w-5" />}
            <h2 className="font-semibold">Publishing authority</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-amber-100/75">
            Connecting an account does not automatically authorize publication. Each destination still requires
            connector health, platform permission, compliant content, exact-version approval, idempotency, and
            the applicable production gates.
          </p>
          <Link
            href={socialSuiteHref("/app/social-media/accounts", workspaceId)}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100"
          >
            Review account readiness <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>
    </div>
  );
}
