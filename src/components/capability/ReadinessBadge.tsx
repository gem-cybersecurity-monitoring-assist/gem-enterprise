import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  capabilityStateLabel,
  capabilityStateTone,
  type CapabilityState,
} from "@/lib/capabilityReadiness";

export interface ReadinessBadgeProps {
  state: CapabilityState;
  className?: string;
}

const TONE_CLASSES: Record<ReturnType<typeof capabilityStateTone>, string> = {
  emerald:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  cyan: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300",
  amber:
    "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  rose: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
  violet:
    "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  slate: "border-slate-500/40 bg-slate-500/15 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300",
};

const STATE_TITLES: Record<CapabilityState, string> = {
  LIVE: "Live — this capability is fully ready to use.",
  SURFACE_AVAILABLE:
    "Surface available — the route exists, but the backend is not ready, so the capability is not live.",
  SETUP_REQUIRED: "Setup required — one-time setup must be completed before use.",
  PROVIDER_NOT_CONFIGURED:
    "Provider not configured — an external provider must be configured before use.",
  AUTHORIZATION_REQUIRED: "Authorization required — you have no workspace access to this capability.",
  NOT_ENTITLED: "Not entitled — your plan or role does not include this capability.",
  RESTRICTED: "Restricted — access is restricted (compliance, KYC, restriction, or emergency lock).",
  DEGRADED:
    "Degraded — the capability is usable, but a configured provider reported unhealthy.",
  UNAVAILABLE: "Unavailable — this capability does not exist in this workspace.",
};

export function ReadinessBadge({ state, className }: ReadinessBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(TONE_CLASSES[capabilityStateTone(state)], className)}
      title={STATE_TITLES[state]}
    >
      {capabilityStateLabel(state)}
    </Badge>
  );
}
