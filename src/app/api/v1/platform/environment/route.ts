import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { platformEnvironment, platformConfigurationEvidence } from "@/lib/platformEnvironment";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json({
    environment: platformEnvironment,
    evidence: platformConfigurationEvidence(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json(
    {
      error: "Environment updates require an explicit implementation backed by persisted configuration and secret management.",
      environment: platformEnvironment,
      evidence: platformConfigurationEvidence(),
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
