"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Bot,
  FileCheck2,
  Gauge,
  LockKeyhole,
  Plug,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommandCenterDirectory } from "@/components/command-center/CommandCenterDirectory";
import {
  FocusedOperationsWorkspace,
  isFocusedOperationsSection,
} from "@/components/command-center/FocusedOperationsWorkspace";
import {
  actionQueue,
  aiAgents,
  approvalQueue,
  commandCenterNavigationGroups,
  commandCenterSections,
  complianceFrameworks,
  complianceTasks,
  demoDisclosure,
  executiveMetrics,
  integrations,
  revenueProducts,
  securityIncidents,
  securityMetrics,
  tenantHealth,
  usageMeters,
  type CommandCenterMetric,
  type CommandCenterSection,
  type MetricTone,
} from "@/lib/commandCenter";

const toneClasses: Record<MetricTone, { text: string; bg: string; border: string }> = {
  cyan: { text: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  emerald: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  amber: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  rose: { text: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  violet: { text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  blue: { text: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/20" },
};

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (["healthy", "connected", "running", "active", "contained"].some((value) => normalized.includes(value))) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (["critical", "at risk", "error"].some((value) => normalized.includes(value))) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  }
  if (["attention", "degraded", "review", "watch", "high"].some((value) => normalized.includes(value))) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-cyan-500/25 bg-cyan-500/10 text-cyan-300";
}

function MetricCard({ metric }: { metric: CommandCenterMetric }) {
  const tone = toneClasses[metric.tone];
  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{metric.label}</p>
        {metric.trend ? <span className={`text-xs font-semibold ${tone.text}`}>{metric.trend}</span> : null}
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{metric.value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{metric.detail}</p>
    </div>
  );
}

function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: MetricTone }) {
  const color = {
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    violet: "bg-violet-400",
    blue: "bg-blue-400",
  }[tone];
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="h-4 w-4 text-cyan-300" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OverviewSection() {
  return <CommandCenterDirectory />;
}

function ExecutiveSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{executiveMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Leadership priorities" icon={TrendingUp}>
          <div className="space-y-3">{actionQueue.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/8 p-3"><div><p className="text-sm font-medium text-white">{item.title}</p><p className="text-xs text-slate-500">{item.owner} · {item.due}</p></div><Badge className={statusBadge(item.priority)}>{item.priority}</Badge></div>)}</div>
        </SectionCard>
        <SectionCard title="Operating posture" icon={Gauge}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[{ label: "Client retention", value: 94, tone: "emerald" as MetricTone }, { label: "Delivery health", value: 87, tone: "cyan" as MetricTone }, { label: "Security coverage", value: 91, tone: "blue" as MetricTone }, { label: "Compliance readiness", value: 84, tone: "violet" as MetricTone }].map((item) => <div key={item.label} className="rounded-lg border border-white/8 p-4"><div className="mb-2 flex justify-between text-sm"><span className="text-slate-400">{item.label}</span><span className="font-bold text-white">{item.value}%</span></div><ProgressBar value={item.value} tone={item.tone} /></div>)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{securityMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
      <SectionCard title="Active incident queue" icon={ShieldAlert} action={<Button size="sm" variant="outline" className="border-white/10"><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Incident</th><th className="pb-3">Tenant</th><th className="pb-3">Severity</th><th className="pb-3">Status</th><th className="pb-3 text-right">SLA age</th></tr></thead>
            <tbody className="divide-y divide-white/8">{securityIncidents.map((incident) => <tr key={incident.id}><td className="py-4"><p className="font-medium text-white">{incident.title}</p><p className="text-xs text-slate-500">{incident.id}</p></td><td className="py-4 text-slate-300">{incident.tenant}</td><td className="py-4"><Badge className={statusBadge(incident.severity)}>{incident.severity}</Badge></td><td className="py-4 text-slate-300">{incident.status}</td><td className="py-4 text-right font-mono text-slate-400">{incident.sla}</td></tr>)}</tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function ComplianceSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{complianceFrameworks.map((framework) => <div key={framework.name} className="rounded-xl border border-white/10 bg-card/75 p-5"><div className="flex items-start justify-between"><div><p className="font-semibold text-white">{framework.name}</p><p className="mt-1 text-xs text-slate-500">{framework.controls} controls · {framework.evidence}</p></div><Badge className={statusBadge(framework.status)}>{framework.status}</Badge></div><div className="mt-5 mb-2 flex justify-between text-xs"><span className="text-slate-400">Readiness</span><span className="font-bold text-white">{framework.readiness}%</span></div><ProgressBar value={framework.readiness} tone={framework.readiness >= 88 ? "emerald" : framework.readiness >= 80 ? "cyan" : "amber"} /></div>)}</div>
      <SectionCard title="Compliance action register" icon={FileCheck2}>
        <div className="grid gap-3 lg:grid-cols-2">{complianceTasks.map((task) => <div key={task.task} className="rounded-lg border border-white/8 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white">{task.task}</p><p className="mt-1 text-xs text-slate-500">{task.framework} · {task.owner}</p></div><Badge className={statusBadge(task.state)}>{task.state}</Badge></div><p className="mt-3 text-xs text-slate-400">Due {task.due}</p></div>)}</div>
      </SectionCard>
    </div>
  );
}

function RevenueSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="Commercial product catalog" icon={BadgeDollarSign}>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Product</th><th className="pb-3">Model</th><th className="pb-3">Customers</th><th className="pb-3">Monthly revenue</th><th className="pb-3">Margin</th><th className="pb-3">State</th></tr></thead><tbody className="divide-y divide-white/8">{revenueProducts.map((product) => <tr key={product.name}><td className="py-4 font-medium text-white">{product.name}</td><td className="py-4 text-slate-400">{product.model}</td><td className="py-4 text-slate-300">{product.customers}</td><td className="py-4 font-semibold text-white">{product.revenue}</td><td className="py-4 text-emerald-300">{product.margin}</td><td className="py-4"><Badge className={statusBadge(product.state)}>{product.state}</Badge></td></tr>)}</tbody></table></div>
      </SectionCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Usage metering" icon={Activity}><div className="space-y-5">{usageMeters.map((meter) => <div key={meter.label}><div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">{meter.label}</span><span className="font-mono text-xs text-slate-400">{meter.display}</span></div><ProgressBar value={(meter.used / meter.limit) * 100} tone={(meter.used / meter.limit) > 0.8 ? "amber" : "cyan"} /></div>)}</div></SectionCard>
        <SectionCard title="Revenue activation path" icon={Workflow}><div className="space-y-3">{["Connect Stripe billing and webhook verification", "Approve Basic, Professional, and Enterprise prices", "Map service entitlements to plans", "Enable metered usage invoice items", "Activate renewal and expansion workflows"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-lg border border-white/8 p-3"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold text-cyan-300">{index + 1}</div><span className="text-sm text-slate-300">{item}</span></div>)}</div></SectionCard>
      </div>
    </div>
  );
}

function ClientsSection() {
  return (
    <SectionCard title="Client portfolio health" icon={Users}>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Organization</th><th className="pb-3">Plan</th><th className="pb-3">Health</th><th className="pb-3">Security</th><th className="pb-3">Compliance</th><th className="pb-3">MRR</th><th className="pb-3">Renewal</th><th className="pb-3">Signal</th></tr></thead><tbody className="divide-y divide-white/8">{tenantHealth.map((tenant) => <tr key={tenant.name}><td className="py-4 font-medium text-white">{tenant.name}</td><td className="py-4 text-slate-400">{tenant.plan}</td><td className="py-4 font-bold text-white">{tenant.health}</td><td className="py-4 text-slate-300">{tenant.security}</td><td className="py-4 text-slate-300">{tenant.compliance}</td><td className="py-4 font-semibold text-white">{tenant.mrr}</td><td className="py-4 text-slate-400">{tenant.renewal}</td><td className="py-4"><Badge className={statusBadge(tenant.signal)}>{tenant.signal}</Badge></td></tr>)}</tbody></table></div>
    </SectionCard>
  );
}

function AgentsSection() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <SectionCard title="AI agent registry" icon={Bot}><div className="space-y-3">{aiAgents.map((agent) => <div key={agent.name} className="rounded-lg border border-white/8 bg-white/[0.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{agent.name}</p><p className="mt-1 text-xs text-slate-500">{agent.purpose}</p></div><Badge className={statusBadge(agent.status)}>{agent.status}</Badge></div><div className="mt-4 grid grid-cols-3 gap-3 text-xs"><div><p className="text-slate-500">Success</p><p className="mt-1 font-semibold text-emerald-300">{agent.success}</p></div><div><p className="text-slate-500">Tasks</p><p className="mt-1 font-semibold text-white">{agent.tasks}</p></div><div><p className="text-slate-500">Errors</p><p className="mt-1 font-semibold text-amber-300">{agent.errors}</p></div></div><p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><LockKeyhole className="h-3 w-3" />Human approval: {agent.approval}</p></div>)}</div></SectionCard>
      <SectionCard title="Human approval queue" icon={LockKeyhole} action={<Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">{approvalQueue.length} pending</Badge>}><div className="space-y-3">{approvalQueue.map((approval) => <div key={approval.id} className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-4"><p className="text-sm font-medium text-white">{approval.action}</p><p className="mt-1 text-xs text-slate-500">{approval.agent} · {approval.tenant}</p><div className="mt-3 flex items-center justify-between"><Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">{approval.risk}</Badge><span className="text-xs text-slate-500">{approval.age}</span></div><div className="mt-3 flex gap-2"><Button size="sm" className="bg-cyan-500 text-black hover:bg-cyan-400">Review</Button><Button size="sm" variant="outline" className="border-white/10">Reject</Button></div></div>)}</div></SectionCard>
    </div>
  );
}

function IntegrationsSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{integrations.map((integration) => <div key={integration.name} className="rounded-xl border border-white/10 bg-card/75 p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10"><Plug className="h-4 w-4 text-cyan-300" /></div><div><p className="font-medium text-white">{integration.name}</p><p className="text-xs text-slate-500">{integration.category}</p></div></div><Badge className={statusBadge(integration.state)}>{integration.state}</Badge></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-500">Last health check</p><p className="mt-1 text-slate-300">{integration.lastCheck}</p></div><div><p className="text-slate-500">Owner</p><p className="mt-1 text-slate-300">{integration.owner}</p></div></div><Button size="sm" variant="outline" className="mt-4 w-full border-white/10">Configure</Button></div>)}</div>
  );
}

export function CommandCenterView({ section }: { section: CommandCenterSection }) {
  const router = useRouter();
  const [range, setRange] = useState("30d");
  const [tenant, setTenant] = useState("all");
  const meta = commandCenterSections[section];
  const usesIllustrativeAnalytics = [
    "executive",
    "security",
    "compliance",
    "revenue",
    "clients",
    "agents",
    "integrations",
  ].includes(section);
  const content = useMemo(() => {
    if (isFocusedOperationsSection(section)) {
      return <FocusedOperationsWorkspace section={section} />;
    }
    switch (section) {
      case "executive": return <ExecutiveSection />;
      case "security": return <SecuritySection />;
      case "compliance": return <ComplianceSection />;
      case "revenue": return <RevenueSection />;
      case "clients": return <ClientsSection />;
      case "agents": return <AgentsSection />;
      case "integrations": return <IntegrationsSection />;
      default: return <OverviewSection />;
    }
  }, [section]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.08] via-card/70 to-violet-500/[0.05] p-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-500/25 bg-cyan-500/10 text-cyan-300"><Sparkles className="mr-1 h-3 w-3" />GEM Operations</Badge>
              {usesIllustrativeAnalytics ? (
                <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">Demo data</Badge>
              ) : (
                <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">Focused workspace</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{meta.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{meta.description}</p>
          </div>
          {usesIllustrativeAnalytics ? (
            <div className="flex flex-wrap gap-2">
              <select value={tenant} onChange={(event) => setTenant(event.target.value)} className="h-9 rounded-md border border-white/10 bg-background px-3 text-xs text-slate-300 outline-none focus:border-cyan-500/50" aria-label="Organization filter">
                <option value="all">All organizations</option><option value="northstar">Northstar Health</option><option value="apex">Apex Realty Group</option><option value="harbor">Harbor Financial</option>
              </select>
              {["7d", "30d", "90d"].map((value) => <Button key={value} size="sm" variant={range === value ? "default" : "outline"} onClick={() => setRange(value)} className={range === value ? "bg-cyan-500 text-black hover:bg-cyan-400" : "border-white/10"}>{value}</Button>)}
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {commandCenterNavigationGroups.map((group) => {
              const active = group.sections.includes(section);
              const destination = group.sections[0] === "overview"
                ? "/app/command-center"
                : `/app/command-center/${group.sections[0]}`;
              return (
                <Button key={group.label} asChild size="sm" variant={active ? "default" : "ghost"} className={active ? "bg-white text-black hover:bg-slate-200" : "text-slate-400 hover:text-white"}>
                  <Link href={destination}>{group.label}</Link>
                </Button>
              );
            })}
          </div>
          <div className="relative shrink-0">
            <label htmlFor="command-center-page" className="sr-only">Open an operating page</label>
            <select
              id="command-center-page"
              value={section}
              onChange={(event) => {
                const destination = event.target.value === "overview"
                  ? "/app/command-center"
                  : `/app/command-center/${event.target.value}`;
                router.push(destination);
              }}
              className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50 sm:w-64"
            >
              {commandCenterNavigationGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.sections.map((item) => (
                    <option key={item} value={item}>{commandCenterSections[item].title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>

      {content}

      <div className={`flex flex-col gap-3 rounded-xl border p-4 text-xs sm:flex-row sm:items-center sm:justify-between ${usesIllustrativeAnalytics ? "border-amber-500/15 bg-amber-500/[0.04] text-amber-100/80" : "border-cyan-500/15 bg-cyan-500/[0.04] text-cyan-100/80"}`}>
        <p className="flex items-start gap-2">
          {usesIllustrativeAnalytics ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />}
          {usesIllustrativeAnalytics
            ? demoDisclosure
            : "Navigation does not grant access. Existing authentication, role, organization, and approval controls remain authoritative."}
        </p>
        <Link href="/app/command-center/integrations" className={`flex shrink-0 items-center gap-1 font-semibold hover:underline ${usesIllustrativeAnalytics ? "text-amber-300" : "text-cyan-300"}`}>
          Review integrations <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
