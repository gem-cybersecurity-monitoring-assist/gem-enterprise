import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plug, ShieldCheck } from "lucide-react";
import { WorkspaceIntegrationCatalog, type WorkspaceIntegrationItem } from "@/components/command-center/WorkspaceIntegrationCatalog";
import { Badge } from "@/components/ui/badge";
import { governedIntegrationCatalog } from "@/lib/workspaceIntegrationCatalog";

export const metadata: Metadata = {
  title: "Workspace Integrations | GEM Enterprise",
  description: "Read-only governed connector directory for the GEM Enterprise Workspace OS.",
};

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function WorkspaceIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string | string[]; project?: string | string[] }>;
}) {
  const query = await searchParams;
  const workspaceId = firstString(query.workspace);
  const projectId = firstString(query.project);
  const items: WorkspaceIntegrationItem[] = governedIntegrationCatalog.map((integration) => ({
    href: integration.operationalHref,
    title: integration.title,
    description: integration.description,
    category: integration.category,
    status: integration.status,
    readiness: integration.readiness,
    capabilities: integration.capabilities,
    activationRequirements: integration.activationRequirements,
  }));

  return (
    <div className="space-y-6 pb-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/app/workspace" className="hover:text-cyan-300">Workspace OS</Link>
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        <span aria-current="page" className="font-semibold text-slate-300">Integrations</span>
      </nav>

      <section className="rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_42%),linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-6 sm:p-8">
        <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Workspace OS
        </Badge>
        <div className="mt-5 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <Plug className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Workspace Integration Directory</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Inspect supported GEM connector families, their operating destinations, capabilities, and activation requirements. This membership-protected directory is read-only and never grants an external account or OAuth scope.
            </p>
          </div>
        </div>
      </section>

      <WorkspaceIntegrationCatalog items={items} workspaceId={workspaceId} projectId={projectId} />
    </div>
  );
}
