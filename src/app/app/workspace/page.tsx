import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  LockKeyhole,
  Plug,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/api/auth-helpers";
import { resolveWorkspaceAccess } from "@/lib/workspaceAccess";
import { cn } from "@/lib/utils";
import { getOrganizationWorkspaceOverview } from "@/lib/organizationWorkspace";
import { OrganizationWorkspaceOperatingSystem } from "@/components/workspace/OrganizationWorkspaceOperatingSystem";
import { WorkspaceDirectory } from "@/components/workspace/WorkspaceDirectory";
import { getGatewaySessionToken, resolveAccessDestination } from "@/lib/auth";
import { workspaceGateway } from "@/lib/supabase-gateway";

export const metadata: Metadata = {
  title: "Workspace | GEM Enterprise",
  description: "Membership-scoped GEM Enterprise organization workspace.",
};

export const dynamic = "force-dynamic";

interface WorkspacePageProps {
  searchParams: Promise<{
    workspace?: string | string[];
    access?: string | string[];
  }>;
}

function firstString(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function ControlState({ locked }: { locked: boolean }) {
  return (
    <Badge
      className={cn(
        "border",
        locked
          ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
          : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
      )}
    >
      {locked ? (
        <LockKeyhole className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
      )}
      {locked ? "Locked" : "Available"}
    </Badge>
  );
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const gate = await requireSession();
  if (!gate.ok) {
    redirect("/client-login");
  }
  if (gate.session.role !== "client") {
    redirect(resolveAccessDestination(gate.session));
  }
  if (gate.accountStatus !== "active") {
    redirect("/client-login?status=account-review");
  }

  const params = await searchParams;
  const requestedWorkspaceId = firstString(params.workspace);
  const accessNotice = firstString(params.access);
  const gatewayToken = gate.session.authSource === "supabase_gateway" ? await getGatewaySessionToken() : null;
  const resolution = gatewayToken
    ? await workspaceGateway<{ workspaces: Awaited<ReturnType<typeof resolveWorkspaceAccess>>["workspaces"] }>("access", gatewayToken).then(({ workspaces }) => ({
        workspaces,
        selected: requestedWorkspaceId ? workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? null : workspaces[0] ?? null,
        requestedWorkspaceId,
        requestedDenied: Boolean(requestedWorkspaceId && !workspaces.some((workspace) => workspace.id === requestedWorkspaceId)),
      }))
    : await resolveWorkspaceAccess(gate.session.userId, requestedWorkspaceId);

  if (resolution.requestedDenied) {
    redirect("/app/workspace?access=denied");
  }

  if (!requestedWorkspaceId && resolution.workspaces.length > 0) {
    return (
      <div className="space-y-6 pb-10">
        {accessNotice === "denied" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            The requested workspace is not assigned to this client account. Choose from the workspaces shown below.
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_38%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-7">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                <Building2 className="mr-1.5 h-3.5 w-3.5" /> Workspace Directory
              </Badge>
              <Badge variant="outline" className="border-white/15 text-slate-300">
                Client account · assigned access only
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">GEM Enterprise Workspace OS</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">Manage every service in one flow.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Each workspace is its own dedicated dashboard. Choose where you want to work first; GEM opens only workspaces assigned to this client account and does not silently switch you into another portal or organization.
            </p>
          </div>
        </section>

        <WorkspaceDirectory workspaces={resolution.workspaces} />

        <Card className="border-cyan-400/15 bg-cyan-400/[0.035]">
          <CardContent className="flex gap-3 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <p className="font-semibold text-white">Assigned access only</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Directory cards come from active workspace memberships. Searching or opening this page never creates a role, membership, entitlement, or access to another organization.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selected = resolution.selected;

  if (!selected) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-8">
        <Card className="border-amber-400/20 bg-amber-400/[0.04]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
              <Building2 className="h-5 w-5 text-amber-300" />
            </div>
            <CardTitle className="text-xl text-white">No active workspace assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-7 text-slate-300">
              This client account is authenticated, but it is not currently assigned to an active organization workspace. GEM does not create a synthetic membership or expose another organization as a fallback.
            </p>
            <div className="rounded-xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-slate-400">
              Workspace access begins only after an administrator assigns this client account to a real organization workspace with an active membership and role.
            </div>
            <Button asChild variant="outline" className="border-white/15 text-slate-200">
              <Link href="/app/support">Contact workspace support</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const operatingOverview = gatewayToken
    ? await workspaceGateway<Awaited<ReturnType<typeof getOrganizationWorkspaceOverview>>>("overview", gatewayToken, { workspaceId: selected.id })
    : await getOrganizationWorkspaceOverview(gate.session.userId, selected.id);

  const controls = [
    ["Global emergency lock", selected.controls.globalEmergencyLock],
    ["Publishing", selected.controls.publishingDisabled],
    ["Advertising", selected.controls.advertisingDisabled],
    ["Shop write operations", selected.controls.shopWriteDisabled],
    ["Connector operations", selected.controls.connectorDisabled],
  ] as const;

  const metrics = [
    { label: "Active members", value: selected.counts.members, Icon: Users },
    { label: "Connector records", value: selected.counts.connectors, Icon: Plug },
    {
      label: "Approval records",
      value: selected.counts.approvalRecords,
      Icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_38%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Membership scoped
              </Badge>
              <Badge variant="outline" className="border-white/15 text-slate-300">
                Dedicated workspace
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {selected.organization.name}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {selected.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              You are inside one assigned workspace. Projects, services, team, tools, reporting, AI, and integrations remain scoped to this workspace and its recorded permissions.
            </p>
          </div>
          <div className="space-y-3 xl:min-w-[280px]">
            <Button asChild variant="outline" className="w-full justify-start border-white/15 text-slate-200">
              <Link href="/app/workspace">
                <ArrowLeft className="mr-2 h-4 w-4" /> All workspaces
              </Link>
            </Button>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Assigned role</p>
              <p className="mt-2 font-semibold text-white">{selected.role.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {selected.role.description ?? "No additional role description is recorded."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value, Icon }) => (
          <Card key={label} className="border-white/10 bg-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
                <Icon className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <OrganizationWorkspaceOperatingSystem overview={operatingOverview} />

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Workspace controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {controls.map(([label, locked]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <span className="text-sm text-slate-300">{label}</span>
                <ControlState locked={locked} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Role permissions</CardTitle>
          </CardHeader>
          <CardContent>
            {selected.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selected.permissions.map((permission) => (
                  <Badge
                    key={`${permission.scope}:${permission.action}`}
                    variant="outline"
                    className="border-white/12 bg-white/[0.025] text-slate-300"
                  >
                    {permission.scope} · {permission.action}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-slate-400">
                No explicit permission labels are attached to this membership role. Protected actions remain unavailable unless an authoritative server-side gate permits them.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-cyan-400/15 bg-cyan-400/[0.035]">
        <CardContent className="flex gap-3 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div>
            <p className="font-semibold text-white">Data boundary</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Workspace selection is validated on the server from this client account’s active memberships. Another portal role cannot enter the Client Workspace through this route.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
