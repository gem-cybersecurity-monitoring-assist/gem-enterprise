import Link from "next/link";
import { ArrowRight, Settings2, ShieldCheck } from "lucide-react";
import { SocialConnectorPanel } from "@/components/social-media/SocialConnectorPanel";
import { getSafeSocialOAuthReadiness } from "@/lib/social-media/oauth/readiness";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";

export default function SocialMediaSettingsPage() {
  const providers = getSocialMediaProviderReadiness();
  const oauthProviders = getSafeSocialOAuthReadiness();
  const configured = providers.filter((provider) => provider.configurationReady).length;
  const liveReady = providers.filter((provider) => provider.externalWriteAllowed).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-bold text-white">Provider configuration</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Review OAuth readiness and authorize only the business destinations your team is permitted to manage.
            Secrets remain server-side and connecting an account does not automatically enable publishing.
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-semibold">Readiness</h2>
          </div>
          <p className="mt-4 text-2xl font-bold text-white">{configured}/{providers.length} configured</p>
          <p className="mt-2 text-sm text-slate-400">{liveReady} destinations currently pass every external-write gate.</p>
        </article>
      </section>

      <SocialConnectorPanel providers={oauthProviders} />

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-5">
        <p className="text-sm leading-6 text-amber-100/80">
          Secret management, provider certification, emergency locks, and production activation remain administrator controls.
        </p>
        <Link href="/app/command-center/social-media" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100">
          Open administrator Command Center <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
