import Link from "next/link";
import { ArrowRight, PlugZap } from "lucide-react";

interface DataNotConnectedProps {
  /** Human-readable section title, e.g. "Security Operations". */
  sectionTitle: string;
  /** Names of the datasets that have no connected source in this section. */
  datasets: string[];
}

/**
 * Explicit not-connected notice for command-center sections whose datasets
 * have no verified backing service. Renders instead of (or above) empty
 * dataset shells so an empty surface is never mistaken for live data or for
 * zero activity.
 */
export function DataNotConnected({ sectionTitle, datasets }: DataNotConnectedProps) {
  return (
    <section
      aria-label={`${sectionTitle} data source status`}
      className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <PlugZap className="h-5 w-5 text-amber-300" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">Not connected — setup required</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {sectionTitle} has no connected data source yet.{" "}
            {datasets.length > 0 ? (
              <>
                {datasets.join(", ")} previously showed illustrative values and now{" "}
                {datasets.length === 1 ? "renders" : "render"} empty until the backing{" "}
                {datasets.length === 1 ? "service is" : "services are"} connected and
                organization records exist.{" "}
              </>
            ) : (
              <>Values here previously showed illustrative data and now render empty until backing services are connected and organization records exist. </>
            )}
            An empty dataset does not mean zero activity — it means no verified source is attached.
          </p>
          <Link
            href="/app/command-center/integrations"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200"
          >
            Review integrations <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
