import Link from "next/link";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "./format";

interface AuditEntry {
  id: string;
  action: string;
  resource: string | null;
  userId: string | null;
  createdAt: Date;
}

export function RecentAuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card className="border-white/10 bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
            <Activity className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base text-white">Recent audit activity</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Latest 10 audit records. Admin-visible only.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No audit records recorded.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.07] hover:bg-transparent">
                  <TableHead className="text-slate-400">Action</TableHead>
                  <TableHead className="text-slate-400">Resource</TableHead>
                  <TableHead className="text-slate-400">Actor</TableHead>
                  <TableHead className="text-slate-400">Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="border-white/[0.07]">
                    <TableCell className="max-w-56 truncate font-mono text-xs text-slate-200">
                      {String(entry.action)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-slate-400">
                      {entry.resource ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs text-slate-500">
                      {entry.userId ?? "system"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-slate-400">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-4 text-right">
          <Link
            href="/app/admin/audit"
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Review full audit evidence →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
