import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  governedIntegrationBySlug,
  governedIntegrationCatalog,
  type GovernedIntegrationReadiness,
} from "@/lib/workspaceIntegrationCatalog";
import { cn } from "@/lib/utils";

interface ConnectorPageProps {
  params: Promise<{ connector: string }>;
  searchParams: Promise<{
    workspace?: string | string[];
    project?: string | string[];
  }>;
}

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function scoped(href: string, workspaceId: string | null, projectId: string | null) {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace", workspaceId);
  if (projectId) params.set("project", projectId);
  const suffix = params.toString();
  return suffix ? `${href}${href.includes("?") ? "&" : "?"}${suffix}` : href;
}

function readinessClass(readiness: GovernedIntegrationReadiness) {
  return cn(
    "border",
    readiness === "READY" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    readiness === "PARTIAL" && "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    readiness === "HUMAN_REQUIRED" && "border-amber-400/25 bg-amber-400/10 text-amber-300",
    readiness === "BLOCKED" && "border-rose-400/25 bg-rose-400/10 text-rose-300",
  );
}

export function generateStaticParams() {
  return governedIntegrationCatalog.map((integration) => ({ connector: integration.slug }));
}

export async function generateMetadata({ params }: ConnectorPageProps): Promise<Metadata> {
  const { connector } = await params;
  const integration = governedIntegrationBySlug(connector);
  if (!integration) return { title: "Integration | GEM Enterprise" };
  return {
    title: `${integration.title} Integration | GEM Enterprise`,
    description: integration.description,
  };
}

export default async function ConnectorPage({ params, searchParams }: ConnectorPageProps) {
  const [{ connector }, query] = await Promise.all([params, searchParams]);
  const integration = governedIntegrationBySlug(connector);
  if (!integration) notFound();

  const workspaceId = firstString(query.workspace);
  const projectId = firstString(query.project);
  const catalogHref = scoped("/app/command-center/integrations", workspaceId, projectId);
  const operationalHref = scoped(integration.operationalHref, workspaceId, projectId);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/app/command-center" className="hover:text-cyan-300">Command Center</Link>
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        <Link href={catalogHref} className="hover:text-cyan-300">Integrations</Link>
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        <span aria-current="page" className="font-semibold text-slate-300">{integration.title}</span>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_40%),linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">{integration.category}</Badge>
              <Badge className={readinessClass(integration.readiness)}>{integration.readiness.replaceAll("_", " ")}</Badge>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Plug className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-3xl font-black text-white sm:text-4xl">{integration.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{integration.description}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 xl:w-80">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Current status</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{integration.status}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="connector-capabilities" className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <h2 id="connector-capabilities" className="text-lg font-bold text-white">Governed capabilities</h2>
          </div>
          <ul className="mt-5 space-y-3">
            {integration.capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="connector-activation" className="rounded-2xl border border-amber-400/15 bg-amber-400/[.035] p-5">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-amber-300" aria-hidden="true" />
            <h2 id="connector-activation" className="text-lg font-bold text-white">Activation requirements</h2>
          </div>
          <ul className="mt-5 space-y-3">
            {integration.activationRequirements.map((requirement) => (
              <li key={requirement} className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-black/10 p-3 text-sm text-slate-300">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                {requirement}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-white">Continue inside GEM</h2>
          <p className="mt-1 text-sm text-slate-400">Opening an operating surface does not bypass provider authorization or workspace controls.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={catalogHref} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to catalogue
          </Link>
          <Link href={operationalHref} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200">
            Open operating surface <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
