import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  ClipboardList,
  FileCheck2,
  Inbox,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StatusBucket } from "./snapshot";
import { humanize } from "./format";

interface QueueDef {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  toneText: string;
  toneBg: string;
  buckets: StatusBucket[];
  /** Keys counted as needing operator attention. */
  attentionKeys: string[];
  attentionLabel: string;
  emptyLabel: string;
  /** Operational next action shown when the queue has no recorded rows. */
  emptyActionLabel: string;
  emptyActionHref: string;
}

function QueueCard({ queue }: { queue: QueueDef }) {
  const attentionCount = queue.buckets
    .filter((b) => queue.attentionKeys.includes(b.key))
    .reduce((sum, b) => sum + b.count, 0);
  const total = queue.buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <Link
      href={queue.href}
      className="group block rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.055]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${queue.toneBg}`}>
          <queue.icon className={`h-5 w-5 ${queue.toneText}`} aria-hidden="true" />
        </div>
        <p className="text-2xl font-bold text-white sm:text-3xl">
          {total === 0 ? "0" : attentionCount}
        </p>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-200">{queue.title}</p>
      <p className="mt-1 text-xs text-slate-500">{queue.attentionLabel}</p>
      <div className="mt-3 space-y-1">
        {queue.buckets.length === 0 ? (
          <div>
            <p className="text-xs text-slate-600">{queue.emptyLabel}</p>
            <Link
              href={queue.emptyActionHref}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
            >
              {queue.emptyActionLabel} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          queue.buckets.map((b) => (
            <div
              key={b.key}
              className="flex items-center justify-between text-xs text-slate-500"
            >
              <span>{humanize(b.key)}</span>
              <span className="font-semibold text-slate-300">{b.count}</span>
            </div>
          ))
        )}
      </div>
      <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-cyan-300 opacity-80 transition group-hover:opacity-100">
        Open queue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

interface Props {
  serviceRequestsByStatus: StatusBucket[];
  approvalsByState: StatusBucket[];
  intakeByStatus: StatusBucket[];
  kycByStatus: StatusBucket[];
}

export function OperationsQueues({
  serviceRequestsByStatus,
  approvalsByState,
  intakeByStatus,
  kycByStatus,
}: Props) {
  const queues: QueueDef[] = [
    {
      title: "Service requests",
      // The control center is the authoritative admin surface for service
      // requests (persisted queue counts + /api/admin/requests); the old
      // /app/admin/approvals link opened the wrong queue entirely.
      href: "/app/admin/client-operations#ops-queues",
      icon: ClipboardList,
      toneText: "text-cyan-300",
      toneBg: "bg-cyan-400/10",
      buckets: serviceRequestsByStatus,
      attentionKeys: ["open", "in_progress", "pending_info"],
      attentionLabel: "Open, in progress, or awaiting info",
      emptyLabel: "No service requests recorded.",
      emptyActionLabel: "Review intake submissions",
      emptyActionHref: "/app/admin/intake",
    },
    {
      title: "Approvals",
      href: "/app/admin/approvals",
      icon: FileCheck2,
      toneText: "text-rose-300",
      toneBg: "bg-rose-400/10",
      buckets: approvalsByState,
      attentionKeys: ["APPROVAL_REQUIRED"],
      attentionLabel: "Awaiting an operator decision",
      emptyLabel: "No approval requests recorded.",
      emptyActionLabel: "Open verification review",
      emptyActionHref: "/review/verification",
    },
    {
      title: "Intake submissions",
      href: "/app/admin/intake",
      icon: Inbox,
      toneText: "text-amber-300",
      toneBg: "bg-amber-400/10",
      buckets: intakeByStatus,
      attentionKeys: ["RECEIVED", "TRIAGE", "NEEDS_INFORMATION"],
      attentionLabel: "Received, in triage, or needing information",
      emptyLabel: "No intake submissions recorded.",
      emptyActionLabel: "Provision workspace access",
      emptyActionHref: "/app/admin/workspace-access",
    },
    {
      title: "KYC applications",
      href: "/app/admin/kyc",
      icon: ShieldCheck,
      toneText: "text-emerald-300",
      toneBg: "bg-emerald-400/10",
      buckets: kycByStatus,
      attentionKeys: [
        "started",
        "in_progress",
        "documents_uploaded",
        "under_review",
        "manual_review",
      ],
      attentionLabel: "Pending a review outcome",
      emptyLabel: "No KYC applications recorded.",
      emptyActionLabel: "Open KYC administration",
      emptyActionHref: "/app/admin/kyc",
    },
  ];

  return (
    <section id="ops-queues" aria-labelledby="ops-queues-title" className="scroll-mt-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Operations queues
        </p>
        <h2 id="ops-queues-title" className="mt-1 text-xl font-bold text-white">
          Live workload from persisted records
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {queues.map((queue) => (
          <QueueCard key={queue.title} queue={queue} />
        ))}
      </div>
      <Card className="mt-3 border-white/[0.07] bg-white/[0.02]">
        <CardContent className="p-4 text-xs leading-6 text-slate-500">
          Counts are grouped by the record&apos;s current status as stored in the
          database. The headline figure is the subset that needs operator
          attention; the breakdown below it shows every recorded state.
        </CardContent>
      </Card>
    </section>
  );
}
