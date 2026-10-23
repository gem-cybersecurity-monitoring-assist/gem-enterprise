import { ExperianConnectionPanel } from "@/components/financial/ExperianConnectionPanel";

export default function CreditReadinessPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Financial Shield
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Credit readiness connections</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Connect an approved Experian API product, verify read access, and review the exact capabilities
          granted to this workspace.
        </p>
      </div>
      <ExperianConnectionPanel />
    </div>
  );
}
