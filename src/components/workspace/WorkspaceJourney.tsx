/**
 * WorkspaceJourney (WS-C)
 *
 * Client journey: onboarding/activation stage derived from organization status,
 * intake submissions and membership; milestones from workspace projects; and
 * blockers from open high-priority service requests. Everything shown comes
 * from the database — nothing is invented.
 */
import { AlertTriangle, CheckCircle2, Circle, CircleDot, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface JourneyStage {
  id: string;
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming";
}

export interface JourneyMilestone {
  id: string;
  name: string;
  status: string;
  targetDateLabel: string | null;
  progress: number;
}

export interface JourneyBlocker {
  id: string;
  subject: string;
  priority: string;
  status: string;
}

export interface JourneySignals {
  stages: JourneyStage[];
  milestones: JourneyMilestone[];
  /** Null when blocker records are not visible in this session. */
  blockers: JourneyBlocker[] | null;
}

function StageIcon({ state }: { state: JourneyStage["state"] }) {
  if (state === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />;
  if (state === "current") return <CircleDot className="h-5 w-5 text-cyan-300" aria-hidden="true" />;
  return <Circle className="h-5 w-5 text-slate-600" aria-hidden="true" />;
}

export function WorkspaceJourney({ signals }: { signals: JourneySignals }) {
  return (
    <section aria-labelledby="workspace-journey-heading" className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Journey</p>
        <h2 id="workspace-journey-heading" className="mt-1 text-lg font-bold text-white sm:text-xl">
          Onboarding, milestones, and blockers
        </h2>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white">Activation stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {signals.stages.map((stage) => (
                <li key={stage.id} className="flex gap-3">
                  <StageIcon state={stage.state} />
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        stage.state === "upcoming" ? "text-slate-500" : "text-white",
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{stage.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <Flag className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Project milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signals.milestones.length ? (
              <ul className="space-y-3">
                {signals.milestones.map((milestone) => (
                  <li key={milestone.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{milestone.name}</p>
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        {milestone.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-400/70"
                        style={{ width: `${Math.max(0, Math.min(100, milestone.progress))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {milestone.targetDateLabel ? `Target: ${milestone.targetDateLabel}` : "No target date recorded"} · {milestone.progress}% complete
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-slate-500">No milestones recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" /> Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signals.blockers === null ? (
              <p className="text-xs leading-5 text-slate-500">
                Blocker records are not visible through this session.
              </p>
            ) : signals.blockers.length ? (
              <ul className="space-y-2">
                {signals.blockers.map((blocker) => (
                  <li key={blocker.id} className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                    <p className="text-sm font-semibold text-white">{blocker.subject}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Priority: {blocker.priority} · Status: {blocker.status.replaceAll("_", " ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-slate-500">No blockers recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
