import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Code2,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Megaphone,
  RadioTower,
  ShieldCheck,
  UsersRound,
  Video,
} from "lucide-react";
import { TokMetricActivationPanel } from "@/components/tokmetric/TokMetricActivationPanel";
import { TokMetricConnectorPanel } from "@/components/tokmetric/TokMetricConnectorPanel";
import { TokMetricGptCredentialManager } from "@/components/tokmetric/TokMetricGptCredentialManager";

export const metadata: Metadata = {
  title: "TikTok Operations | GEM Enterprise Command Center",
  description:
    "Unified TokMetric workspace for TikTok accounts, content, compliance, approvals, publishing, analytics, GPT Actions, and audit controls.",
};

const modules = [
  {
    href: "/tokmetric/dashboard",
    label: "Operations Dashboard",
    description: "Connector state, approval readiness, compliance posture, and publishing blockers.",
    icon: BarChart3,
  },
  {
    href: "/tokmetric/accounts",
    label: "TikTok Accounts",
    description: "OAuth-only connections for Organic, Shop, Business, advertiser, and developer accounts.",
    icon: KeyRound,
  },
  {
    href: "/tokmetric/content-studio",
    label: "Content Studio",
    description: "Campaigns, scripts, captions, media versions, hashtags, covers, and schedules.",
    icon: Video,
  },
  {
    href: "/tokmetric/compliance",
    label: "Compliance Center",
    description: "Commercial disclosures, claims, copyright, music rights, privacy, and policy review.",
    icon: FileCheck2,
  },
  {
    href: "/tokmetric/approvals",
    label: "Approval Center",
    description: "Human decisions tied to exact content versions, hashes, accounts, and settings.",
    icon: UsersRound,
  },
  {
    href: "/tokmetric/publishing",
    label: "Publishing Queue",
    description: "Controlled jobs, prerequisites, idempotency, emergency locks, and external status.",
    icon: RadioTower,
  },
  {
    href: "/tokmetric/analytics",
    label: "Analytics",
    description: "Source-labeled TikTok metrics that separate live, imported, calculated, and unknown data.",
    icon: CalendarDays,
  },
  {
    href: "/tokmetric/developer",
    label: "Developer & GPT Controls",
    description: "OAuth callbacks, APIs, webhooks, logs, rate limits, and Custom GPT Action readiness.",
    icon: Code2,
  },
  {
    href: "/tokmetric/agents",
    label: "Specialized AI Agents",
    description: "Controlled strategist, script writer, quality reviewer, and publishing coordinator workflows.",
    icon: Bot,
  },
];

const controlState = [
  ["Native GEM Enterprise module", "READY"],
  ["Custom GPT Action contracts", "READY"],
  ["Bearer credential management", "READY"],
  ["Command Center workflow gateway", "READY"],
  ["TikTok OAuth authorization", "AUTHORIZATION_REQUIRED"],
  ["Human approval enforcement", "ENABLED"],
  ["Live publishing", "LOCKED"],
] as const;

function StateBadge({ state }: { state: string }) {
  const ready = ["READY", "ENABLED"].includes(state);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
        ready
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-300"
      }`}
    >
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
      {state.replaceAll("_", " ")}
    </span>
  );
}

export default function TokMetricCommandCenterPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.09] via-card/80 to-violet-500/[0.06] p-6">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Megaphone className="h-3.5 w-3.5" />
                TokMetric
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Native GEM module
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              TikTok and TikTok Shop Operations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              One controlled entry point for TikTok account authorization, content production,
              compliance review, human approvals, publishing preparation, analytics, audit history,
              and the TokMetric Custom GPT action layer.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100/80 xl:max-w-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Publishing safety lock
            </div>
            Live publishing remains disabled until TikTok OAuth, approved scopes, connector health,
            compliance clearance, exact-version approval, and production activation all pass.
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-white/10 bg-card/75 p-5 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <Icon className="h-5 w-5 text-cyan-300" />
            </div>
            <h2 className="mt-5 font-semibold text-white group-hover:text-cyan-200">{label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </Link>
        ))}
      </section>

      <TokMetricActivationPanel />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TokMetricConnectorPanel />

        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <div className="mb-5 flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-bold text-white">GPT and launch controls</h2>
          </div>
          <div className="space-y-3">
            {controlState.map(([label, state]) => (
              <div
                key={label}
                className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-slate-300">{label}</span>
                <StateBadge state={state} />
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/tokmetric/developer"
              className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/[0.05]"
            >
              GPT connection controls
            </Link>
            <Link
              href="/tokmetric/review-demo"
              className="rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-semibold text-black hover:bg-cyan-300"
            >
              App review evidence
            </Link>
          </div>
        </article>
      </section>

      <TokMetricGptCredentialManager />
    </div>
  );
}
