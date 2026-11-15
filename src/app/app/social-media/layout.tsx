import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles, UsersRound } from "lucide-react";
import { SocialMediaSuiteNav } from "@/components/social-media/SocialMediaSuiteNav";

export const metadata: Metadata = {
  title: "Social Media Suite | GEM Enterprise",
  description:
    "Client and team workspace for social account connections, content production, governed video, TokMetric, approvals, scheduling, and analytics.",
};

export default function SocialMediaSuiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.1] via-card/85 to-violet-500/[0.08] p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                GEM Social Media Suite
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
                <UsersRound className="h-3.5 w-3.5" />
                Client and team workspace
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Manage every social channel, campaign, video, approval, and performance signal
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              This is the main website experience for authorized GEM clients and teams. Connect approved
              destinations, prepare cross-platform content, manage governed video production, operate
              TokMetric, review exact versions, organize schedules, and learn from verified analytics.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm leading-6 text-emerald-100/80 xl:max-w-sm">
            Administrative configuration, secret management, provider certification, emergency locks, and
            production activation remain in the separate administrator Command Center.
          </div>
        </div>
      </section>

      <Suspense fallback={<p role="status">Loading social navigation…</p>}>
        <SocialMediaSuiteNav />
      </Suspense>
      {children}
    </div>
  );
}
