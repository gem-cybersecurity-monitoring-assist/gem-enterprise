import Link from "next/link";
import { ArrowRight, Film, HardDriveUpload, ShieldCheck, WandSparkles } from "lucide-react";
import { GovernedVideoPreviewPanel } from "@/components/social-media/GovernedVideoPreviewPanel";

const stages = [
  ["1", "Recipe", "Use an approved content version with scenes, narration, captions, and rendering inputs."],
  ["2", "Render", "Dispatch the recipe to the trusted private worker without exposing the renderer publicly."],
  ["3", "Verify", "Register the uploaded media checksum, MIME type, file size, and storage reference."],
  ["4", "Reapprove", "Create a new exact content version and return the finished video to compliance and human approval."],
] as const;

export default function SocialMediaVideoPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5 text-rose-200" />
            <h2 className="text-lg font-bold text-white">Governed video production</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            GEM video production is tied to an approved content version. Rendering, storage registration, private
            preview, compliance review, and final human approval remain separate recorded stages so a finished asset
            cannot silently replace the version that was reviewed.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stages.map(([number, label, description]) => (
              <div key={number} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/10 text-xs font-bold text-rose-200">
                  {number}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">{label}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.05] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-cyan-300">
            <HardDriveUpload className="h-5 w-5" />
            <h2 className="font-semibold">Start from an approved content item</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-cyan-100/70">
            Queue new video recipes from Content Production. Use this page to inspect the verified finished asset and
            its governance evidence after the trusted worker completes the upload.
          </p>
          <Link
            href="/app/social-media/content"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            Open content production <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3 text-xs leading-5 text-emerald-100/75">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
            Private preview does not publish the asset or change an approval decision.
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Film className="h-5 w-5 text-rose-200" />
          <h2 className="text-lg font-bold text-white">Verified video preview</h2>
        </div>
        <GovernedVideoPreviewPanel />
      </section>
    </div>
  );
}
