import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { repositoryConnection, platformConfigurationEvidence } from "@/lib/platformEnvironment";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json({ repository: repositoryConnection, evidence: platformConfigurationEvidence() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;


  return NextResponse.json(
    {
      error: "Repository connection changes must be performed through the connected GitHub/Vercel integration flow.",
      repository: repositoryConnection,
      evidence: platformConfigurationEvidence(),
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
