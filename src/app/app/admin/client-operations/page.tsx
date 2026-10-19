import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight, LayoutGrid, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminRole, requireSession } from "@/lib/api/auth-helpers";
import { getClientOperationsSnapshot, type ClientOperationsSnapshot } from "@/components/admin/client-operations/snapshot";
import { ClientManagementTable } from "@/components/admin/client-operations/ClientManagementTable";
import { OperationsQueues } from "@/components/admin/client-operations/OperationsQueues";
import { IntegrationsHealth } from "@/components/admin/client-operations/IntegrationsHealth";
import { RecentAuditLog } from "@/components/admin/client-operations/RecentAuditLog";
import { QuickLinks } from "@/components/admin/client-operations/QuickLinks";

export const metadata: Metadata = {
  title: "Client Operations & Security Control Center | GEM Enterprise",
  description:
    "Unified internal operating center: client records, operations queues, integrations health, and audit evidence.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = "force-dynamic";

function NotAuthorized() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center pb-10">
      <Card className="w-full max-w-lg border-rose-400/25 bg-rose-400/[0.04]">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-400/10">
            <ShieldAlert className="h-5 w-5 text-rose-300" aria-hidden="true" />
          </div>
          <CardTitle className="pt-2 text-xl text-white">Not authorized</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-slate-300">
            The Client Operations & Security Control Center is restricted to
            platform administrators. Your account does not hold an administrator
            role, so no operating data is displayed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ClientOperationsPage() {
  const gate = await requireSession();
  if (!gate.ok) {
    redirect("/admin-login");
  }

  if (!isAdminRole(gate.session.role)) {
    return <NotAuthorized />;
  }

  // Error isolation: a snapshot failure degrades to an explicit error state
  // instead of failing the whole control center.
  let snapshot: ClientOperationsSnapshot | null = null;
  let snapshotError = false;
  try {
    snapshot = await getClientOperationsSnapshot();
  } catch (error) {
    console.error("[client-operations] snapshot failed:", error);
    snapshotError = true;
  }

  return (
    <div className="space-y-7 pb-10">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <li>
            <Link
              href="/app/admin"
              className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-medium text-slate-400 transition hover:text-cyan-300"
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              Admin
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="font-semibold text-slate-200">
            Client Operations
          </li>
        </ol>
      </nav>

      <header className="rounded-3xl border border-cyan-400/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_42%),rgba(255,255,255,.03)] p-6 sm:p-8">
        <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
          Unified client operations
        </Badge>
        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          Client Operations & Security Control Center
        </h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
          Live internal operating center backed by persisted records: client
          organizations, operations queues, provider connection state, and audit
          evidence. Existing GEM systems remain authoritative; this page surfaces
          their current state instead of duplicating them.
        </p>
      </header>

      {snapshotError || !snapshot ? (
        <Card className="border-amber-400/25 bg-amber-400/[0.04]">
          <CardContent className="flex gap-3 p-6">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <p className="font-semibold text-white">Operating snapshot unavailable</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                The live snapshot could not be loaded, so queue counts and client
                records are hidden rather than shown stale. Quick links below remain
                available.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <OperationsQueues
            serviceRequestsByStatus={snapshot.serviceRequestsByStatus}
            approvalsByState={snapshot.approvalsByState}
            intakeByStatus={snapshot.intakeByStatus}
            kycByStatus={snapshot.kycByStatus}
          />

          <ClientManagementTable
            organizations={snapshot.organizations}
            truncated={snapshot.truncated}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <IntegrationsHealth states={snapshot.connectorsByState} />
            <RecentAuditLog entries={snapshot.auditLog} />
          </div>
        </>
      )}

      <QuickLinks />

      <Card className="border-amber-400/15 bg-amber-400/[.03]">
        <CardContent className="p-5 text-sm leading-7 text-slate-300">
          Client data remains membership-scoped and permission-gated. Financial,
          digital-asset, cybersecurity, legal, and compliance actions must use the
          relevant authoritative service, approval, and audit controls; this control
          center does not bypass those boundaries.
        </CardContent>
      </Card>
    </div>
  );
}
