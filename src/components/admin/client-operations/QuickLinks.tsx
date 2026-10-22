import Link from "next/link";
import type { ComponentType } from "react";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Mail,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Condensed versions of the existing operating-area links so navigation is
 * not lost when this page became data-backed.
 */
const areas: Array<{
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { title: "Client access & tenancy", href: "/app/admin/workspace-access", icon: Building2 },
  { title: "Customer lifecycle", href: "/app/admin/customer-success", icon: Users },
  { title: "Threat & security operations", href: "/app/command-center/monitoring", icon: ShieldAlert },
  { title: "Compliance & verification", href: "/app/admin/kyc", icon: ShieldCheck },
  { title: "Legal & policy", href: "/app/admin/approvals", icon: Scale },
  { title: "Finance & portfolio", href: "/app/admin/allocations", icon: Wallet },
  { title: "Commercial & service operations", href: "/app/admin/market/operations", icon: BadgeDollarSign },
  { title: "Communication governance", href: "/app/admin/communications", icon: Mail },
  { title: "Requests & approvals", href: "/app/admin/approvals", icon: ClipboardList },
  { title: "Documents & evidence", href: "/app/documents", icon: FileText },
  { title: "Audit & accountability", href: "/app/admin/audit", icon: Activity },
  { title: "Platform integrations", href: "/app/command-center/integrations", icon: CheckCircle2 },
];

export function QuickLinks() {
  return (
    <section aria-labelledby="quick-links-title">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
        Operating surfaces
      </p>
      <h2 id="quick-links-title" className="mt-1 text-xl font-bold text-white">
        Area quick links
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {areas.map(({ title, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-cyan-400/25 hover:bg-cyan-400/[0.045]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-slate-200 transition group-hover:text-white">
              {title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
