import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationRow } from "./snapshot";
import { formatDateTime } from "./format";

interface Props {
  organizations: OrganizationRow[];
  truncated: boolean;
}

export function ClientManagementTable({ organizations, truncated }: Props) {
  return (
    <Card className="border-white/10 bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
            <Building2 className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base text-white">Client management</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Organizations from the persisted record. Showing up to 50, newest first.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {organizations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
            <p className="text-sm font-semibold text-white">No organizations recorded</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              Client organizations appear here once intake is processed and workspace access is provisioned.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/app/admin/intake"
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
              >
                Review intake submissions
              </Link>
              <Link
                href="/app/admin/workspace-access"
                className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Provision workspace access
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.07] hover:bg-transparent">
                  <TableHead className="text-slate-400">Organization</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Plan</TableHead>
                  <TableHead className="text-right text-slate-400">Workspaces</TableHead>
                  <TableHead className="text-right text-slate-400">Members</TableHead>
                  <TableHead className="text-right text-slate-400">Open requests</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id} className="border-white/[0.07]">
                    <TableCell>
                      <Link
                        href={`/app/admin/workspace-access?organization=${encodeURIComponent(org.slug)}`}
                        className="font-semibold text-slate-100 hover:text-cyan-200 hover:underline"
                      >
                        {org.name}
                      </Link>
                      <div className="text-xs text-slate-500">{org.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          org.status === "active"
                            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                            : "border-white/15 bg-white/[0.04] text-slate-300"
                        }
                      >
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {org.billingPlan ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-white">
                      {org.workspaceCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-white">
                      {org.memberCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-white">
                      {org.openRequestCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-slate-400">
                      {formatDateTime(org.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {truncated
              ? "List capped at 50 organizations — narrow scope on the workspace access page."
              : `${organizations.length} organization${organizations.length === 1 ? "" : "s"} shown.`}
          </p>
          <Link
            href="/app/admin/workspace-access"
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Open workspace access administration →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
