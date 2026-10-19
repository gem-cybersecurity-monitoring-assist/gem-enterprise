import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandCenterView } from "@/components/command-center/CommandCenterView";
import { DataNotConnected } from "../_components/DataNotConnected";
import {
  commandCenterNotConnectedSections,
  commandCenterSections,
  isCommandCenterSection,
  type CommandCenterSection,
} from "@/lib/commandCenter";

interface CommandCenterSectionPageProps {
  params: Promise<{ section: string }>;
}

/**
 * Datasets that previously rendered fabricated values in each affected
 * section. Named here so the not-connected notice is explicit about what is
 * missing; the underlying datasets remain empty until connected services and
 * persisted organization records back them.
 */
const notConnectedDatasets: Record<string, string[]> = {
  executive: ["Executive metrics", "Leadership priorities"],
  security: ["Security metrics", "Incident queue"],
  compliance: ["Framework readiness", "Compliance action register"],
  revenue: ["Product catalog", "Usage metering"],
  clients: ["Tenant health"],
  agents: ["AI agent registry", "Human approval queue"],
  integrations: ["Integration states"],
};

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

  const needsConnectionNotice = commandCenterNotConnectedSections.includes(section);

  return (
    <>
      {needsConnectionNotice ? (
        <div className="mb-6">
          <DataNotConnected
            sectionTitle={commandCenterSections[section].title}
            datasets={notConnectedDatasets[section] ?? []}
          />
        </div>
      ) : null}
      <CommandCenterView section={section} />
    </>
  );
}
