import { socialSuiteHref, socialWorkspaceId, type SocialWorkspaceSearchParams } from "@/lib/social-media/channel-routes";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";
import { SocialPublishingQueuePanel } from "@/components/social-media/SocialPublishingQueuePanel";

const schedulingRules = [
  "Only a compliance-cleared, human-approved exact version can enter a publishing window.",
  "The authorized account or destination must match the destination recorded on the approved version.",
  "Idempotency prevents the same version and destination from being submitted twice.",
  "A schedule does not override an emergency lock, expired credential, connector failure, or platform restriction.",
  "Indeed remains limited to a genuine vacancy or approved employer update.",
] as const;

export default async function SocialMediaCalendarPage({ searchParams }: { searchParams: Promise<SocialWorkspaceSearchParams> }) {
  const workspaceId = socialWorkspaceId(await searchParams);
  const providers = getSocialMediaProviderReadiness();
  const readyForExternalWrite = providers.filter((provider) => provider.externalWriteAllowed);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-200" />
            <h2 className="text-lg font-bold text-white">Publishing calendar and queue preparation</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Organize approved content by destination and publishing window. The calendar is a coordination layer:
            it does not publish unapproved content, repair missing provider credentials, or bypass a platform or
            administrator lock.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={socialSuiteHref("/app/social-media/content", workspaceId)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-black hover:bg-cyan-300"
            >
              Prepare content <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={socialSuiteHref("/app/social-media/approvals", workspaceId)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.05]"
            >
              Review approvals
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-amber-200">
            <RadioTower className="h-5 w-5" />
            <h2 className="font-semibold">Live-destination readiness</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-amber-100/75">
            {readyForExternalWrite.length} of {providers.length} registered destinations currently pass every
            external-write gate. Locked destinations can still receive prepared drafts, but they cannot receive a
            live publishing job.
          </p>
          <Link
            href="/tokmetric/publishing"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100"
          >
            Open controlled publishing queue <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>

      <SocialPublishingQueuePanel />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <article key={provider.id} className="rounded-2xl border border-white/10 bg-card/75 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">{provider.label}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{provider.purpose}</p>
              </div>
              {provider.externalWriteAllowed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
              ) : (
                <LockKeyhole className="h-5 w-5 shrink-0 text-amber-300" />
              )}
            </div>
            <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                Scheduling state
              </div>
              <p className={`mt-2 text-sm font-semibold ${provider.externalWriteAllowed ? "text-emerald-300" : "text-amber-200"}`}>
                {provider.externalWriteAllowed ? "Eligible for approved queue jobs" : "Draft scheduling only"}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-bold text-white">Scheduling controls</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {schedulingRules.map((rule) => (
            <div key={rule} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-sm leading-6 text-slate-400">{rule}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
