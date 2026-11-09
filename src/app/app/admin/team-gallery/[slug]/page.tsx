import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamProfileDetail } from "@/components/admin/TeamProfileDetail";
import { teamGalleryEntries } from "@/lib/team-gallery-source";
import { getTeamProfileEditorial } from "@/lib/team-gallery-profiles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Professional Team Profile | GEM Enterprise",
  description: "Private editorial record with staff source image, professional role description and visual-story concepts.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = teamGalleryEntries.find((item) => item.slug === slug);
  const editorial = getTeamProfileEditorial(slug);
  if (!entry || !editorial) notFound();

  return <TeamProfileDetail entry={entry} editorial={editorial} />;
}
