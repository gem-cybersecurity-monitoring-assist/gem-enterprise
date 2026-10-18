import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/api/auth-helpers";

export const metadata: Metadata = {
  title: "AI Services | GEM Enterprise Workspace OS",
  description: "Governed GEM AI assistance, agents, intelligence, and media services.",
};

const STAFF_ROLES = new Set(["admin", "super_admin", "internal"]);

const services = [
  {
    title: "GEM AI Concierge",
    description: "Consent-aware assistance, initial routing, and human escalation through the protected support service.",
    href: "/app/support",
    state: "AVAILABLE",
    audience: "All authenticated workspace members",
    icon: Bot,
    staffOnly: false,
  },
  {
    title: "GEM Sentinel",
    description: "Native intelligence, monitoring, news, notifications, and cross-domain situational awareness.",
    href: "/intel",
    state: "AVAILABLE",
    audience: "All authenticated workspace members",
    icon: RadioTower,
    staffOnly: false,
  },
  {
    title: "AI Content & Video Studio",
    description: "Governed campaign content, trusted Windows rendering, private media return, version verification, and approval.",
    href: "/app/social-media/video",
    state: "HOST_REQUIRED",
    audience: "Authorized workspace content teams",
    icon: Video,
    staffOnly: false,
  },
  {
    title: "TokMetric AI Agents",
    description: "Specialized social operations agents operating behind workspace, compliance, and publishing controls.",
    href: "/tokmetric/agents",
    state: "AUTHORIZATION_REQUIRED",
    audience: "Authorized social operations teams",
    icon: Sparkles,
    staffOnly: false,
  },
  {
    title: "Enterprise Agent Governance",
    description: "Staff-only agent registry, operating evidence, approval queues, errors, and governance controls.",
    href: "/app/command-center/agents",
    state: "STAFF_RESTRICTED",
    audience: "Administrators and platform owners",
    icon: BrainCircuit,
    staffOnly: true,
  },
  {
    title: "AI Integration Registry",
    description: "OpenAI, Hugging Face, Base44, ComfyUI, Pinokio, OBS, and other governed connector definitions.",
    href: "/app/command-center/integrations",
    state: "STAFF_RESTRICTED",
    audience: "Administrators and platform owners",
    icon: ShieldCheck,
    staffOnly: true,
  },
] as const;

function stateTone(state: (typeof services)[number]["state"]) {
  if (state === "AVAILABLE") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  if (state === "STAFF_RESTRICTED") return "border-violet-400/25 bg-violet-400/10 text-violet-300";
  return "border-amber-400/25 bg-amber-400/10 text-amber-300";
}

export default async function AiServicesPage() {
  const gate = await requireSession();
  if (!gate.ok) redirect("/client-login?next=/app/ai-services");
  if (gate.accountStatus !== "active") redirect("/client-login?status=account-review");

  const canAccessStaffServices = STAFF_ROLES.has(gate.session.role);

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.13),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,.12),transparent_38%),linear-gradient(145deg,rgba(15,23,42,.97),rgba(2,6,23,.98))] p-6 sm:p-8">
        <div className="max-w-4xl">
          <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Workspace OS
          </Badge>
          <div className="mt-5 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <BrainCircuit className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-black text-white sm:text-4xl">GEM AI Services</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                One protected directory for assistance, intelligence, agent governance, and AI media. Your authenticated role determines which operating surfaces can open; this page never upgrades access.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="ai-service-directory" className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Service directory</p>
            <h2 id="ai-service-directory" className="mt-1 text-xl font-bold text-white">Choose the correct AI surface</h2>
          </div>
          <p className="text-xs text-slate-500">Server-authoritative role: {gate.session.role.replaceAll("_", " ")}</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const permitted = !service.staffOnly || canAccessStaffServices;
            return (
              <article key={service.title} className="flex min-h-72 flex-col rounded-2xl border border-white/10 bg-black/15 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <Badge className={stateTone(service.state)}>{service.state.replaceAll("_", " ")}</Badge>
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{service.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{service.description}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{service.audience}</p>
                <div className="mt-auto pt-5">
                  {permitted ? (
                    <Link href={service.href} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[.05] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:border-cyan-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                      Open service <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-violet-400/15 bg-violet-400/[.05] px-4 py-2.5 text-sm font-semibold text-violet-200">
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Administrator access required
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/15 bg-amber-400/[.035] p-5">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-white">Controlled activation remains authoritative</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Provider credentials, model access, local media-host health, external publishing authorization, and human approval remain separate gates. A visible AI service is not proof that every provider action is active.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
