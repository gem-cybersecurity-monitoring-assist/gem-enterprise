import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Film, ShieldCheck } from "lucide-react";
import { ContentOrchestratorPanel } from "@/components/social-media/ContentOrchestratorPanel";
import { GovernedVideoPreviewPanel } from "@/components/social-media/GovernedVideoPreviewPanel";
import { GemStorylineLibraryPanel } from "@/components/social-media/GemStorylineLibraryPanel";

export const metadata: Metadata = {
  title: "Content Studio | GEM Enterprise Command Center",
  description:
    "GEM storyline library, organic launch planning, channel-ready content, local video drafts, and human approval.",
};

export default function SocialMediaContentStudioPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.09] via-card/80 to-cyan-500/[0.06] p-6">
        <Link
          href="/app/command-center/social-media"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Social Media Command Center
        </Link>
        <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
                <Film className="h-3.5 w-3.5" />
                GEM Content Studio
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Human approval retained
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Daily content generation and realistic video production
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Run the existing adaptive content orchestrator, send approved video recipes to the free local ComfyUI worker, track execution, register completed media, privately preview the verified output, and return the final exact version to compliance and approval.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100/80 lg:max-w-sm">
            This studio creates, prepares, and previews media. It does not bypass publishing locks, provider authorization, or separate human approval.
          </div>
        </div>
      </section>

      <GemStorylineLibraryPanel />
      <ContentOrchestratorPanel />
      <GovernedVideoPreviewPanel />
    </div>
  );
}
