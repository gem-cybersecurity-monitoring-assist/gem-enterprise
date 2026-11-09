import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Building2, CheckCircle2, CircleHelp,
  Compass, Layers3, LockKeyhole, MoveUpRight, PanelTop, ShieldCheck,
} from "lucide-react";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { saasCapabilityCatalog, type SaaSArea } from "@/lib/saasCapabilityCatalog";
import { saasAreaArchitecture, saasAreaOrder } from "@/lib/saasAreaArchitecture";

type PageProps = { params: Promise<{ area: string }> };
const validAreas: ReadonlySet<string> = new Set(saasAreaOrder);

export function generateStaticParams() {
  return saasAreaOrder.map((area) => ({ area }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area } = await params;
  const config = validAreas.has(area) ? saasAreaArchitecture[area as SaaSArea] : null;
  return {
    title: config ? `${config.title} | GEM Enterprise SaaS` : "GEM SaaS Management",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function SaaSAreaPage({ params }: PageProps) {
  const { area } = await params;
  if (!validAreas.has(area)) notFound();
  const gate = await requireAdmin();
  if (!gate.ok) {
    redirect(`/admin-login?next=${encodeURIComponent(`/app/command-center/saas/areas/${area}`)}`);
  }

  const selectedArea = area as SaaSArea;
  const definition = saasAreaArchitecture[selectedArea];
  const tools = saasCapabilityCatalog.filter((item) => item.area === selectedArea);
  const surfaces = tools.filter((item) => item.readiness === "existing-surface").length;
  const accent = selectedArea === "market" ? "amber" : selectedArea === "community" ? "violet" : selectedArea === "client" ? "emerald" : "cyan";

  return (
    <main className="mx-auto w-full max-w-[1820px] space-y-8 px-4 pb-20 pt-7 text-slate-100 sm:px-7 2xl:px-10">
      <nav aria-label="SaaS architecture breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/app/command-center/saas" className="inline-flex min-h-10 items-center gap-2 font-semibold text-cyan-200 hover:text-white"><ArrowLeft className="h-4 w-4" /> SaaS home</Link>
        <span className="text-slate-600">/</span><span className="text-slate-200">{definition.title}</span>
      </nav>
      <header className="relative isolate overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[linear-gradient(135deg,#071727_0%,#071426_49%,#111c35_100%)] px-6 py-10 sm:px-10 lg:min-h-[420px] lg:py-14 2xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-full max-w-[750px] opacity-80" style={{ background: "radial-gradient(ellipse at 65% 50%,rgba(34,211,238,.12),transparent 60%),repeating-linear-gradient(0deg,transparent 0 36px,rgba(34,211,238,.05) 37px 38px),repeating-linear-gradient(90deg,transparent 0 36px,rgba(34,211,238,.05) 37px 38px)", maskImage: "linear-gradient(to left,black,transparent 96%)" }} />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(290px,430px)] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200"><Layers3 className="h-4 w-4" /> {definition.eyebrow}</span>
            <h1 className="mt-7 max-w-4xl text-4xl font-bold leading-[1.09] tracking-tight text-white sm:text-5xl 2xl:text-6xl">{definition.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">{definition.subtitle}</p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{definition.purpose}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#area-workspaces" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300">Explore workspaces <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/app/command-center/saas" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Back to overview</Link>
            </div>
          </div>
          <aside className="rounded-[28px] border border-white/15 bg-white/[.055] p-6 shadow-2xl backdrop-blur sm:p-8" aria-label="Section context">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-cyan-200"><Compass className="h-4 w-4" /> Workspace map</span>
              <BadgeCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            </div>
            <p className="mt-6 text-5xl font-bold tabular-nums text-white">{tools.length.toString().padStart(2, "0")}</p>
            <p className="mt-2 text-sm text-slate-300">Registered functions in this section</p>
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
              <div><p className="text-2xl font-bold text-cyan-200">{surfaces}</p><p className="mt-1 text-xs leading-5 text-slate-400">Existing routes</p></div>
              <div><p className="text-2xl font-bold text-white">{tools.length - surfaces}</p><p className="mt-1 text-xs leading-5 text-slate-400">Gated or preview</p></div>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-400">Route presence is not a certification of provider connectivity or service activation.</p>
          </aside>
        </div>
      </header>

      <nav aria-label="SaaS operating divisions" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {saasAreaOrder.map((id, index) => {
          const item = saasAreaArchitecture[id];
          return (
            <Link key={id} href={`/app/command-center/saas/areas/${id}`} aria-current={id === selectedArea ? "page" : undefined}
              className={`flex min-h-[86px] items-center justify-between rounded-2xl border px-5 py-4 transition hover:border-cyan-400/30 hover:bg-white/[.07] ${id === selectedArea ? "border-cyan-400/45 bg-cyan-400/10 text-white" : "border-white/10 bg-white/[.035] text-slate-300"}`}>
              <span><span className="block text-xs text-cyan-300">{String(index + 1).padStart(2, "0")}</span><span className="mt-1 block font-semibold">{item.title}</span></span>
              <MoveUpRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]" aria-labelledby="operating-flow-heading">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/65 px-6 py-8 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">HOW THIS AREA WORKS</p>
          <h2 id="operating-flow-heading" className="mt-3 text-2xl font-bold text-white sm:text-3xl">One connected workflow, step by step.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {definition.steps.map(([title, description, detail], index) => (
              <article key={title} className="relative rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-lg font-bold text-cyan-200">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-cyan-300">{title}</p>
                <h3 className="mt-2 text-lg font-bold leading-6 text-white">{description}</h3>
                <p className="mt-4 text-sm leading-6 text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
        </div>
        <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(150deg,rgba(8,47,73,.35),rgba(15,23,42,.95))] p-7 sm:p-9">
          <ShieldCheck className="h-9 w-9 text-cyan-300" aria-hidden="true" />
          <h2 className="mt-6 text-2xl font-bold">Built around your existing enterprise.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">All destinations retain their existing GEM Enterprise authentication, tenant isolation, approvals and audit behavior.</p>
          <div className="mt-8 space-y-4 text-sm text-slate-300">
            <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" /> No replacement database</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" /> Existing permission controls</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" /> No automatic commerce activation</p>
          </div>
        </aside>
      </section>

      <section id="area-workspaces" aria-labelledby="area-workspaces-heading" className="scroll-mt-24">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">CONNECTED FUNCTIONAL SPACES</p>
            <h2 id="area-workspaces-heading" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Workspaces & functions</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400">Open each destination with full page context. Advanced or unactivated capabilities are disclosed directly on their cards.</p>
          </div>
          <p className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300">{tools.length} modules</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {tools.map((tool, index) => {
            const disabled = !tool.href;
            return (
              <article key={tool.id} className="group flex min-h-[285px] flex-col rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(30,41,59,.8),rgba(2,6,23,.7))] p-7 transition hover:border-cyan-400/25 hover:bg-slate-900 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-cyan-400/10 text-xl font-bold text-cyan-200">{String(index + 1).padStart(2, "0")}</span>
                  <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300">{tool.readiness === "existing-surface" ? "Existing route" : tool.readiness === "planned" ? "Planned" : tool.readiness === "preview-only" ? "Preview" : "Requests only"}</span>
                </div>
                <h3 className="mt-7 text-xl font-bold text-white">{tool.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-400">{tool.description}</p>
                <div className="mt-5 border-t border-white/10 pt-5">
                  {disabled ? <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><LockKeyhole className="h-4 w-4" /> Not activated</p> : (
                    <Link href={tool.href!} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/15">
                      Open this workspace <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <details className="mt-4 text-xs text-slate-500">
                  <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-slate-300"><CircleHelp className="h-3.5 w-3.5" /> Readiness requirement</summary>
                  <p className="mt-2 leading-6">{tool.activationGate}</p>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-8 text-sm text-slate-400">
        <span className="inline-flex items-center gap-2"><PanelTop className="h-4 w-4 text-cyan-300" /> GEM Enterprise · Unified SaaS Architecture</span>
        <Link href="/app/command-center/saas" className="inline-flex items-center gap-2 font-semibold text-cyan-200 hover:text-white">Return to SaaS overview <ArrowRight className="h-4 w-4" /></Link>
      </footer>
    </main>
  );
}
