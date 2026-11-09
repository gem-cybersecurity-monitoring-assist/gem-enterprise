import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { SaaSServiceQueue } from "@/components/command-center/SaaSServiceQueue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Service Operations | GEM Enterprise SaaS",
  description: "Authenticated administrative service request queue and audited lifecycle controls.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SaaSServiceOperationsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect("/admin-login?next=%2Fapp%2Fcommand-center%2Fsaas%2Fservice-operations");
  return (
    <main className="mx-auto w-full max-w-[1820px] space-y-7 px-4 pb-20 pt-8 text-slate-100 sm:px-7 2xl:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/command-center/saas" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> SaaS management home
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 px-4 py-2 text-xs font-semibold text-cyan-200">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Audited, role-protected workflow
        </span>
      </div>
      <SaaSServiceQueue />
    </main>
  );
}
