import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { socialAccountsHref, socialChannels } from "@/lib/social-media/channel-routes";
import {
  getSocialMediaProviderReadiness,
  type SocialMediaReadinessState,
} from "@/lib/social-media/providers";

export const metadata: Metadata = {
  title: "Social Media Operations | GEM Enterprise Command Center",
  description:
    "Fail-closed readiness, account authorization, and publishing controls for GEM social media and employer channels.",
};

function StatusBadge({ state }: { state: SocialMediaReadinessState }) {
  const configured = state !== "CONFIGURATION_REQUIRED";
  const label = state.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
        configured
          ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
          : "border-rose-500/25 bg-rose-500/10 text-rose-300"
      }`}
    >
      {configured ? <LockKeyhole className="h-3.5 w-3.5" /> : <CircleOff className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export default function SocialMediaCommandCenterPage() {
  const providers = getSocialMediaProviderReadiness();
  const configuredCount = providers.filter((provider) => provider.configurationReady).length;
  const approvalCount = providers.filter(
    (provider) => provider.platformApprovalRequired && provider.platformApprovalGranted,
  ).length;
  const lockedCount = providers.filter((provider) => !provider.externalWriteAllowed).length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.09] via-card/80 to-violet-500/[0.06] p-6">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Megaphone className="h-3.5 w-3.5" />
                GEM Social Media Command Center
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fail-closed controls
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Cross-platform content, authorization, and publishing readiness
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              One governed surface for TikTok, Facebook Pages, Instagram professional accounts, X,
              Nextdoor, Indeed Employer, LinkedIn Company Pages, and YouTube. Configuration readiness
              does not authorize publishing; platform approval, account authorization, and publishing
              permission remain separate controls.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100/80 xl:max-w-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              External writes remain locked
            </div>
            OAuth can store an approved account credential, but it cannot publish without connector health,
            channel policy, compliance, exact-version approval, idempotency, and both live gates.
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Channels</div>
          <div className="mt-3 text-3xl font-bold text-white">{providers.length}</div>
          <p className="mt-2 text-sm text-slate-400">Registered destinations</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Configured</div>
          <div className="mt-3 text-3xl font-bold text-white">{configuredCount}</div>
          <p className="mt-2 text-sm text-slate-400">Environment configuration complete</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Approvals</div>
          <div className="mt-3 text-3xl font-bold text-white">{approvalCount}</div>
          <p className="mt-2 text-sm text-slate-400">Recorded platform approvals</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Write locks</div>
          <div className="mt-3 text-3xl font-bold text-white">{lockedCount}</div>
          <p className="mt-2 text-sm text-slate-400">Providers blocked from external writes</p>
        </article>
      </section>

      <section aria-label="Social connections" className="rounded-2xl border border-white/10 bg-card/75 p-5">
        <h2 className="text-lg font-semibold text-white">Social connections</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={socialAccountsHref()} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-cyan-200">All accounts</Link>
          {socialChannels.map(({ id, label }) => (
            <Link key={id} href={socialAccountsHref(id)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-cyan-200">{label}</Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => (
          <article key={provider.id} className="rounded-2xl border border-white/10 bg-card/75 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  {provider.connectionMode === "EMPLOYER_FEED" ? (
                    <BriefcaseBusiness className="h-5 w-5 text-cyan-300" />
                  ) : (
                    <KeyRound className="h-5 w-5 text-cyan-300" />
                  )}
                  <h2 className="font-semibold text-white">{provider.label}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{provider.purpose}</p>
              </div>
              <StatusBadge state={provider.state} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {provider.supportedContent.map((contentType) => (
                <span
                  key={contentType}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300"
                >
                  {contentType.replaceAll("_", " ")}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-400">
              {provider.restrictions.map((restriction) => (
                <div key={restriction} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span>{restriction}</span>
                </div>
              ))}
            </div>

            {provider.platformApprovalRequired ? (
              <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3 text-xs text-amber-100/80">
                Platform approval: {provider.platformApprovalGranted ? "recorded" : "required before live activation"}
              </div>
            ) : null}

            {provider.missingConfiguration.length > 0 ? (
              <div className="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/[0.05] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-300">
                  Missing configuration names
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {provider.missingConfiguration.map((name) => (
                    <code key={name} className="rounded bg-black/30 px-2 py-1 text-[11px] text-rose-100/80">
                      {name}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/75 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-semibold text-white">Existing TikTok operating module</h2>
            <p className="mt-1 text-sm text-slate-400">
              TikTok OAuth, approvals, publishing preflight, analytics, and audit remain inside the
              established TokMetric command center.
            </p>
          </div>
          <Link
            href="/app/command-center/tokmetric"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-black hover:bg-cyan-300"
          >
            Open TokMetric
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
