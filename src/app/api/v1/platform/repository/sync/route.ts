import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { repositoryConnection, platformConfigurationEvidence } from "@/lib/platformEnvironment";

export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;


  return NextResponse.json(
    {
      status: "not_configured",
      code: "REPOSITORY_SYNC_NOT_IMPLEMENTED",
      message: "No repository sync job was created. A durable sync adapter must be configured before this action is available.",
      repository: repositoryConnection,
      evidence: platformConfigurationEvidence(),
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
