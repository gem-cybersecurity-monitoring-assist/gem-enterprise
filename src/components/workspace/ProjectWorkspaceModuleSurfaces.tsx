import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  Plug,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProjectEnvironmentId } from "@/lib/projectWorkspace";

interface WorkspaceConnectorSummary {
  id: string;
  provider: string;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  disabledAt: Date | null;
  lastHealthAt: Date | null;
}

interface ProjectWorkspaceModuleSurfacesProps {
  environment: ProjectEnvironmentId;
  workspaceId: string;
  projectId: string;
  connectors: WorkspaceConnectorSummary[];
  approvalCount: number;
  globalEmergencyLock: boolean;
  publishingDisabled: boolean;
  advertisingDisabled: boolean;
  shopWriteDisabled: boolean;
  connectorDisabled: boolean;
}

const readyConnectorStates = new Set(["CONNECTED"]);

function scoped(href: string, workspaceId: string, projectId: string) {
  return `${href}${href.includes("?") ? "&" : "?"}workspace=${encodeURIComponent(workspaceId)}&project=${encodeURIComponent(projectId)}`;
}

function stateTone(state: string) {
  return readyConnectorStates.has(state)
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
    : "border-amber-400/25 bg-amber-400/10 text-amber-300";
}

export function ProjectWorkspaceModuleSurfaces({
  environment,
  workspaceId,
  projectId,
  connectors,
  approvalCount,
  globalEmergencyLock,
  publishingDisabled,
  advertisingDisabled,
  shopWriteDisabled,
  connectorDisabled,
}: ProjectWorkspaceModuleSurfacesProps) {
  if (environment === "tools") {
    return (
      <section aria-labelledby="workspace-integrations-heading" className="rounded-2xl border border-white/10 bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">Workspace OS integrations</p>
            <h3 id="workspace-integrations-heading" className="mt-1 text-lg font-bold text-white">
              Governed integration catalogue
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              These are authoritative connector records for this workspace. Configuration, authorization, health, and approval remain separate gates.
            </p>
          </div>
          <Link
            href={scoped("/app/integrations", workspaceId, projectId)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[.05] px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Workspace integration catalogue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {connectors.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2" role="list" aria-label="Configured workspace connectors">
            {connectors.map((connector) => (
              <article key={connector.id} role="listitem" className="rounded-xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                      <Plug className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-white">{connector.displayName}</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {connector.provider.replaceAll("_", " ")}
                        {connector.externalAccountId ? ` · ${connector.externalAccountId}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={stateTone(connector.disabledAt ? "DISABLED" : connector.state)}>
                    {(connector.disabledAt ? "DISABLED" : connector.state).replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Last health check: {connector.lastHealthAt ? new Date(connector.lastHealthAt).toLocaleString() : "Not yet recorded"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div role="status" className="mt-5 flex gap-3 rounded-xl border border-dashed border-white/15 bg-black/10 p-4">
            <CircleOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-white">No connector record is configured</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">The catalogue stays empty rather than presenting prototype or synthetic connections.</p>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (environment === "monitoring") {
    const signals = [
      { label: "Global emergency lock", blocked: globalEmergencyLock, blockedText: "ENGAGED", readyText: "CLEAR" },
      { label: "External publishing", blocked: publishingDisabled, blockedText: "DISABLED", readyText: "AVAILABLE" },
      { label: "Advertising writes", blocked: advertisingDisabled, blockedText: "DISABLED", readyText: "AVAILABLE" },
      { label: "Store writes", blocked: shopWriteDisabled, blockedText: "DISABLED", readyText: "AVAILABLE" },
      { label: "Connector operations", blocked: connectorDisabled, blockedText: "DISABLED", readyText: "AVAILABLE" },
    ];
    const connected = connectors.filter((connector) => !connector.disabledAt && readyConnectorStates.has(connector.state)).length;

    return (
      <section aria-labelledby="gem-sentinel-heading" className="rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.08),transparent_45%),rgba(15,23,42,.72)] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <RadioTower className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">GEM Sentinel</p>
            <h3 id="gem-sentinel-heading" className="mt-1 text-lg font-bold text-white">Workspace readiness and threat-control surface</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Live workspace control flags and connector records are shown below. A clear control does not override provider authorization, compliance, or human approval.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {signals.map((signal) => (
            <article key={signal.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-4">
              {signal.blocked ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">{signal.label}</p>
                <p className={signal.blocked ? "mt-1 text-xs text-amber-300" : "mt-1 text-xs text-emerald-300"}>
                  {signal.blocked ? signal.blockedText : signal.readyText}
                </p>
              </div>
            </article>
          ))}
          <article className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-white">Governance records</p>
              <p className="mt-1 text-xs text-slate-400">{approvalCount} approvals · {connected}/{connectors.length} connectors connected</p>
            </div>
          </article>
        </div>
      </section>
    );
  }

  return null;
}
