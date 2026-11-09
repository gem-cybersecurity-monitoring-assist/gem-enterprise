import type { Metadata } from "next";
import { TeamGalleryPreview } from "@/components/admin/TeamGalleryPreview";

/**
 * Admin-only preview: /app/admin/** is restricted in src/proxy.ts to
 * admin, super_admin and internal sessions. This route must not be moved
 * to the public company section without publication approval.
 */
export const metadata: Metadata = {
  title: "Teams Gallery Review | GEM Enterprise",
  description: "Authenticated preview of original Notion team photographs and enterprise role stories.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminTeamGalleryPage() {
  return <TeamGalleryPreview />;
}
