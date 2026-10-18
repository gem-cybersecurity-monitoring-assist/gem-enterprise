import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound, Plug, ShieldCheck } from "lucide-react";
import { WorkspaceIntegrationCatalog, type WorkspaceIntegrationItem } from "@/components/command-center/WorkspaceIntegrationCatalog";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";
import type { SocialMediaReadinessState } from "@/lib/social-media/providers";
import { governedIntegrationCatalog } from "@/lib/workspaceIntegrationCatalog";

export const metadata: Metadata = {
  title: "Integrations | GEM Enterprise Command Center",
  description: "Governed connector readiness and activation controls for GEM Enterprise.",
};

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function providerReadiness(state: SocialMediaReadinessState): WorkspaceIntegrationItem["readiness"] {
  if (state === "HIRING_WORKFLOW_ONLY") return "PARTIAL";
  if (state === "CONFIGURATION_REQUIRED") return "BLOCKED";
  return "HUMAN_REQUIRED";
}

function providerStateLabel(state: SocialMediaReadinessState) {
  return state.toLowerCase().replaceAll("_", " ");
}

export default async function IntegrationsCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string | string[]; project?: string | string[] }>;
}) {
  const socialProviders = getSocialMediaProviderReadiness();
  const configured = socialProviders.filter((provider) => provider.configurationReady).length;
  const params = await searchParams;
  const workspaceId = firstString(params.workspace);
  const projectId = firstString(params.project);

  const integrationCards: WorkspaceIntegrationItem[] = [
    {
      href: "/app/command-center/integrations/news",
      title: "Native News Automation",
      description: "Review GEM's source catalog, scheduled ingestion, attributed stories, video discovery, and native news experience.",
      category: "Intelligence",
      status: "Supabase ingestion active",
      readiness: "READY",
    },
    {
      href: "/app/command-center/social-media",
      title: "Social Media Operations",
      description: "TikTok, Facebook Pages, Instagram professional accounts, X, Nextdoor, Indeed Employer, LinkedIn, and YouTube readiness.",
      category: "Publishing",
      status: `${configured}/${socialProviders.length} configured`,
      readiness: configured === socialProviders.length ? "READY" : configured > 0 ? "PARTIAL" : "HUMAN_REQUIRED",
    },
    {
      href: "/app/command-center/social-media/content-studio",
      title: "Content and Video Studio",
      description: "Generate governed daily content, queue realistic videos on the local renderer, register completed media, and return exact versions to compliance and approval.",
      category: "AI & Media",
      status: "Local renderer remains fail-closed until its Windows host is healthy",
      readiness: "HUMAN_REQUIRED",
    },
    {
      href: "/app/command-center/tokmetric",
      title: "TokMetric",
      description: "TikTok OAuth, content production, compliance, exact-version approvals, publishing preflight, analytics, and audit controls.",
      category: "Publishing",
      status: "External publishing remains authorization-gated",
      readiness: "HUMAN_REQUIRED",
    },
    {
      href: "/app/support",
      title: "GEM AI Support",
      description: "Governed AI-assisted platform support with consent, safety boundaries, and human escalation rather than unrestricted agent action.",
      category: "AI & Media",
      status: "Platform support session service available",
      readiness: "READY",
    },
    {
      href: "/intel",
      title: "GEM Sentinel Intelligence",
      description: "Open the native monitoring and intelligence environment used for project signals, news, notifications, and cross-domain situational awareness.",
      category: "Security",
      status: "Read-only intelligence surface available",
      readiness: "READY",
    },
    ...socialProviders.map((provider) => ({
      href: `/app/social-media/accounts?provider=${encodeURIComponent(provider.id)}`,
      title: `${provider.label} connector`,
      description: `${provider.purpose} Supported content: ${provider.supportedContent.join(", ").toLowerCase()}.`,
      category: "Provider apps",
      status: `${provider.connectionMode === "OAUTH" ? "OAuth" : "Employer feed"} · ${providerStateLabel(provider.state)}`,
      readiness: providerReadiness(provider.state),
    })),
    ...governedIntegrationCatalog.map((integration) => ({
      href: `/app/command-center/integrations/catalog/${integration.slug}`,
      title: integration.title,
      description: integration.description,
      category: integration.category,
      status: integration.status,
      readiness: integration.readiness,
      capabilities: integration.capabilities,
      activationRequirements: integration.activationRequirements,
    })),
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/app/command-center" className="hover:text-cyan-300">Command Center</Link>
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        {projectId && workspaceId ? <><Link href={`/app/workspace/projects/${encodeURIComponent(projectId)}/tools`} className="hover:text-cyan-300">Project tools</Link><ArrowRight className="h-3 w-3" aria-hidden="true" /></> : null}
        <span aria-current="page" className="font-semibold text-slate-300">Integrations</span>
      </nav>

      <section className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.09] via-card/80 to-violet-500/[0.06] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">
            <Plug className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />Governed connectors
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Integration Command Center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Review configuration readiness, authorization requirements, live gates, account scope, and the exact controls that must pass before any external action is permitted.
            </p>
          </div>
        </div>
      </section>

      <WorkspaceIntegrationCatalog items={integrationCards} workspaceId={workspaceId} projectId={projectId} />

      <section className="rounded-2xl border border-white/10 bg-card/75 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <h2 className="font-semibold text-white">Activation rule</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              A configured provider is not an authorized provider. Connection health, required scopes, compliance, human approval, version hashes, idempotency, and live-publishing gates remain separate mandatory controls.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">
              <KeyRound className="h-3.5 w-3.5" />Workspace catalogue never bypasses provider authorization
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
