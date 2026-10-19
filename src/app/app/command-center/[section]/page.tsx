import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandCenterView } from "@/components/command-center/CommandCenterView";
import {
  commandCenterSections,
  isCommandCenterSection,
  type CommandCenterSection,
} from "@/lib/commandCenter";

interface CommandCenterSectionPageProps {
  params: Promise<{ section: string }>;
}

export async function generateMetadata({ params }: CommandCenterSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  if (!isCommandCenterSection(section)) {
    return { title: "Command Center | GEM Enterprise" };
  }

  return {
    title: `${commandCenterSections[section].title} | GEM Enterprise`,
    description: commandCenterSections[section].description,
  };
}

export function generateStaticParams() {
  return (Object.keys(commandCenterSections) as CommandCenterSection[])
    .filter((section) => section !== "overview")
    .map((section) => ({ section }));
}

export default async function CommandCenterSectionPage({ params }: CommandCenterSectionPageProps) {
  const { section } = await params;
  if (!isCommandCenterSection(section)) notFound();

  return <CommandCenterView section={section} />;
}
