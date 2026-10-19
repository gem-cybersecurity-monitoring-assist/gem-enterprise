import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { ArrowRight, ImageIcon, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { ContentOrchestratorPanel } from "@/components/social-media/ContentOrchestratorPanel";
import { MarketLaunchPackPanel } from "@/components/social-media/MarketLaunchPackPanel";

const productionOutputs = [
  ["Short-form video", "Hook, narration, scenes, captions, camera direction, and renderer-ready recipe."],
  ["Images and carousels", "Platform-aware visual brief, slide structure, overlay copy, and accessibility notes."],
  ["Platform copy", "Channel-specific captions, hashtags, calls to action, and publishing checklist."],
  ["Governance evidence", "Unsupported claims, security-sensitive details, regulatory wording, and approval flags."],
] as const;

export default function SocialMediaContentPage() {
  const campaign = JSON.parse(
    readFileSync(join(process.cwd(), "public/market-launch/founding-first-20.json"), "utf8"),
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-200" />
            <h2 className="text-lg font-bold text-white">Cross-platform content production</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Generate a complete campaign package from current GEM services and approved source material. The
            orchestrator prepares unique channel variants while retaining source references, compliance findings,
            exact-version approval, and a record that no external action was taken during preparation.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {productionOutputs.map(([label, description], index) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-2">
                  {index % 2 === 0 ? (
                    <ImageIcon className="h-4 w-4 text-cyan-300" />
                  ) : (
                    <MessageSquareText className="h-4 w-4 text-violet-200" />
                  )}
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-semibold">Safe production boundary</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-emerald-100/75">
            Content generation does not equal approval or publication. Unsupported claims, internal security details,
            regulatory statements, customer references, and unlicensed media remain blocked or routed to a human reviewer.
          </p>
          <Link
            href="/app/social-media/approvals"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:text-emerald-100"
          >
            Review the approval workflow <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>

      <MarketLaunchPackPanel campaign={campaign} />

      <ContentOrchestratorPanel />
    </div>
  );
}
