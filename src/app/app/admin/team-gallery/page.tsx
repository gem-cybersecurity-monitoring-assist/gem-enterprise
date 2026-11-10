import type { Metadata } from "next";
import { TeamGalleryPreview } from "@/components/admin/TeamGalleryPreview";
import Link from "next/link";

/**
 * Protected source-media review: /app/admin/** is restricted in src/proxy.ts to
 * admin, super_admin and internal sessions. This route must not be moved
 * to the public company section without publication approval.
 */
export const metadata: Metadata = {
  title: "Teams Source Media | GEM Enterprise",
  description: "Protected source-media review of Notion team photographs and enterprise roles.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminTeamGalleryPage() {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-[#0b1b2b] p-5">
      <div>
        <p className="font-semibold text-white">Live publishing and website management</p>
        <p className="mt-1 text-sm text-slate-400">Review source media here, and edit website copy or personnel publication in the connected management console.</p>
      </div>
      <Link href="/app/admin/personnel-management" className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-[#061423]">Open Live Management</Link>
    </div>
    <TeamGalleryPreview/>
  </div>;
}
