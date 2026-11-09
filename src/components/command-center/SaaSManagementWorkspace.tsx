"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, Building2,
  CheckCircle2, ChevronDown, ClipboardCheck, Command, Filter,
  Globe2, LayoutGrid, LifeBuoy, LockKeyhole, Megaphone, RefreshCw, Search,
  Settings2, ShieldCheck, Sparkles, Users, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import type { SaaSArea, SaaSCapability, SaaSReadiness } from "@/lib/saasCapabilityCatalog";

type ResponsePayload = {
  schemaVersion: number;
  type: "prelaunch-capability-register";
  runtimeHealthVerified: false;
  capabilities: SaaSCapability[];
};
type LoadState = "loading" | "ready" | "failed";

type QuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

const quickActions: QuickAction[] = [
  { id: "clients", label: "Manage clients", description: "Accounts, requests and relationships", href: "/app/admin/client-operations", icon: Users, tone: "text-cyan-300 bg-cyan-400/10" },
  { id: "workspaces", label: "Organizations", description: "Teams, memberships and access", href: "/app/admin/workspace-access", icon: Building2, tone: "text-sky-300 bg-sky-400/10" },
  { id: "approvals", label: "Review approvals", description: "Decisions awaiting your attention", href: "/app/admin/approvals", icon: ClipboardCheck, tone: "text-amber-300 bg-amber-400/10" },
  { id: "services", label: "Service delivery", description: "Requests, cases and support", href: "/app/admin/client-operations", icon: LifeBuoy, tone: "text-emerald-300 bg-emerald-400/10" },
  { id: "content", label: "Content & campaigns", description: "Marketing, publishing and reviews", href: "/app/social-media", icon: Megaphone, tone: "text-violet-300 bg-violet-400/10" },
  { id: "monitoring", label: "Monitor platform", description: "Health, evidence and integrations", href: "/app/command-center/monitoring", icon: Activity, tone: "text-rose-300 bg-rose-400/10" },
];

const categories: Array<{ id: "all" | SaaSArea; title: string; icon: LucideIcon }> = [
  { id: "all", title: "All tools", icon: LayoutGrid },
  { id: "owner", title: "Administration", icon: ShieldCheck },
  { id: "operations", title: "Operations", icon: Settings2 },
  { id: "client", title: "Client tools", icon: Users },
  { id: "community", title: "Community", icon: BookOpen },
  { id: "market", title: "Marketplace", icon: Globe2 },
];

const statusInfo: Record<SaaSReadiness, { short: string; classes: string; detail: string }> = {
  "existing-surface": { short: "Workspace", classes: "border-cyan-400/20 bg-cyan-400/5 text-cyan-200", detail: "Existing route. Feature availability depends on your permissions and backend." },
  "request-only": { short: "Enquiries", classes: "border-amber-400/20 bg-amber-400/5 text-amber-200", detail: "Requests can be reviewed; buying and payments are not activated." },
  "preview-only": { short: "Preview", classes: "border-violet-400/20 bg-violet-400/5 text-violet-200", detail: "Illustrative experience, not a live member system." },
  planned: { short: "Coming later", classes: "border-slate-600 bg-white/[0.03] text-slate-300", detail: "Implementation or activation is still required." },
};

const iconByArea: Record<SaaSArea, LucideIcon> = {
  owner: LockKeyhole,
  operations: Command,
  client: Users,
  community: BookOpen,
  market: Wallet,
};

function validCapability(value: unknown): value is SaaSCapability {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.title === "string"
    && typeof c.description === "string" && typeof c.activationGate === "string"
    && ["owner", "operations", "client", "community", "market"].includes(String(c.area))
    && ["existing-surface", "preview-only", "request-only", "planned"].includes(String(c.readiness))
    && (c.href === undefined || (typeof c.href === "string" && c.href.startsWith("/") && !c.href.startsWith("//")));
}
function validResponse(value: unknown): value is ResponsePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.schemaVersion === 1 && v.type === "prelaunch-capability-register"
    && v.runtimeHealthVerified === false && Array.isArray(v.capabilities) && v.capabilities.every(validCapability);
}

export function SaaSManagementWorkspace() {
  const [capabilities, setCapabilities] = useState<SaaSCapability[]>([]);
  const [loadingState, setLoadingState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<"all" | SaaSArea>("all");
  const [query, setQuery] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<"all" | SaaSReadiness>("all");
  const [showAll, setShowAll] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadingState("loading");
    setError(null);
    try {
      const response = await fetch("/api/command-center/saas-capabilities", {
        credentials: "same-origin", cache: "no-store", signal,
      });
      if (!response.ok) {
        setLoadingState("failed");
        setError(response.status === 401 || response.status === 403
          ? "This account needs administrator access to use the SaaS workspace."
          : "Your tool directory is temporarily unavailable.");
        return;
      }
      const body: unknown = await response.json();
      if (!validResponse(body)) throw new Error("Catalog format unavailable");
      setCapabilities(body.capabilities);
      setLoadingState("ready");
    } catch {
      if (signal?.aborted) return;
      setLoadingState("failed");
      setError("We could not check your tools. No sample information is being shown.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const searchTerm = query.trim().toLocaleLowerCase();
    return capabilities.filter((item) =>
      (activeArea === "all" || item.area === activeArea)
      && (readinessFilter === "all" || item.readiness === readinessFilter)
      && (!searchTerm || [item.title, item.description, item.activationGate, item.id]
        .some((text) => text.toLocaleLowerCase().includes(searchTerm))),
    );
  }, [activeArea, capabilities, query, readinessFilter]);

  const browsingAll = !query.trim() && activeArea === "all" && readinessFilter === "all";
  const visible = browsingAll && !showAll ? filtered.slice(0, 9) : filtered;
  const openRoutes = capabilities.filter((item) => item.readiness === "existing-surface").length;
  const gatedRoutes = capabilities.length - openRoutes;

  return (
    <div className="space-y-9" data-testid="saas-friendly-workspace">
      <section aria-labelledby="saas-quick-actions" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Sparkles className="h-3.5 w-3.5" /> Start here</div>
            <h2 id="saas-quick-actions" className="text-2xl font-bold tracking-tight text-white">What would you like to manage?</h2>
            <p className="mt-1 text-sm text-slate-400">Open your most-used GEM workspaces in one tap.</p>
          </div>
          <Link href="/app/admin" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200">
            Full admin center <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map(({ id, label, description, href, icon: Icon, tone }) => (
            <Link key={id} href={href}
              className="group flex min-h-[112px] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-5 transition hover:-translate-y-0.5 hover:border-cyan-400/35 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-white">{label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-200" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section id="saas-tools" aria-labelledby="saas-management-title" className="space-y-5 scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><LayoutGrid className="h-3.5 w-3.5" /> Your toolbox</div>
            <h2 id="saas-management-title" className="text-2xl font-bold tracking-tight">Explore all management tools</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">Find the right tool without searching through different dashboards.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        </div>

        {loadingState === "loading" && <div role="status" className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-300">Loading your management tools…</div>}
        {loadingState === "failed" && <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-sm text-amber-100">{error}</div>}
        {loadingState === "ready" && (
          <>
            <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3 sm:p-4">
              <div className="relative">
                <Search aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type="search" aria-label="Search platform modules" value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="What are you looking for? Clients, documents, AI, approvals…"
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                {query && <button type="button" aria-label="Clear tool search" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button>}
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter by operating area">
                {categories.map(({ id, title, icon: Icon }) => (
                  <button key={id} type="button" aria-pressed={activeArea === id} onClick={() => { setActiveArea(id); setShowAll(false); }}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${activeArea === id ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/10"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" /> {title}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <p role="status" className="text-xs text-slate-400">{filtered.length} tools found · {openRoutes} existing routes · {gatedRoutes} require additional steps</p>
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Show</span>
                  <select aria-label="Filter module availability" value={readinessFilter} onChange={(event) => { setReadinessFilter(event.target.value as typeof readinessFilter); setShowAll(false); }}
                    className="min-h-9 rounded-lg border border-white/15 bg-slate-950 px-2 text-xs text-slate-200">
                    <option value="all">Everything</option>
                    <option value="existing-surface">Existing workspaces</option>
                    <option value="request-only">Request only</option>
                    <option value="preview-only">Previews</option>
                    <option value="planned">Coming later</option>
                  </select>
                </label>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 p-8 text-center">
                <Search className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-200">No matching tools were found.</p>
                <button type="button" onClick={() => { setQuery(""); setActiveArea("all"); setReadinessFilter("all"); }} className="mt-3 text-sm font-semibold text-cyan-300 underline underline-offset-4">Clear filters</button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((item) => {
                    const Icon = iconByArea[item.area];
                    return (
                      <article key={item.id} className="group flex flex-col rounded-2xl border border-white/10 bg-slate-900/55 p-5 transition hover:border-white/20 hover:bg-slate-900/80">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.055] text-slate-300"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                          <span title={statusInfo[item.readiness].detail} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusInfo[item.readiness].classes}`}>{statusInfo[item.readiness].short}</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                        <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{item.description}</p>
                        {item.href ? (
                          <Link href={item.href} className="mt-5 inline-flex min-h-10 items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
                            Open workspace <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        ) : (
                          <div className="mt-5 flex min-h-10 items-center text-sm font-medium text-slate-500"><LockKeyhole className="mr-2 h-4 w-4" /> Not available yet</div>
                        )}
                        {showTechnical && <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400"><strong className="font-medium text-slate-200">Activation requirement:</strong> {item.activationGate}</p>}
                      </article>
                    );
                  })}
                </div>
                {browsingAll && filtered.length > 9 && (
                  <button type="button" onClick={() => setShowAll((current) => !current)}
                    className="mx-auto flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
                    {showAll ? "Show fewer tools" : `Explore all ${filtered.length} tools`}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Links retain existing user permissions and approval controls.</p>
              <button type="button" aria-pressed={showTechnical} onClick={() => setShowTechnical((current) => !current)}
                className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white">
                {showTechnical ? "Hide" : "Show"} technical activation requirements <ChevronDown className={`h-4 w-4 transition-transform ${showTechnical ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
