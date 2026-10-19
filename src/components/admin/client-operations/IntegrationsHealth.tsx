import Link from "next/link";
import { PlugZap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StatusBucket } from "./snapshot";
import { humanize } from "./format";

/**
 * Provider connection states straight from the Connector records.
 * Never inferred — each state count is shown exactly as grouped.
 */
export function IntegrationsHealth({ states }: { states: StatusBucket[] }) {
  const total = states.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="border-white/10 bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
            <PlugZap className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base text-white">Integrations health</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Recorded provider connection states — shown exactly as stored, never inferred.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {states.length === 0 ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5 text-sm leading-7 text-amber-100/80">
            No provider connections recorded — setup required.
          </div>
        ) : (
          <div className="space-y-2">
            {states.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3"
              >
                <Badge
                  variant="outline"
                  className={
                    s.key === "CONNECTED"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : s.key === "DEGRADED" ||
                          s.key === "TOKEN_EXPIRED" ||
                          s.key === "REAUTHORIZATION_REQUIRED" ||
                          s.key === "BLOCKED"
                        ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
                        : "border-white/15 bg-white/[0.04] text-slate-300"
                  }
                >
                  {humanize(s.key)}
                </Badge>
                <span className="text-lg font-bold text-white">{s.count}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {total} connector record{total === 1 ? "" : "s"} total.
          </p>
          <Link
            href="/app/command-center/integrations"
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Open integrations operations →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
