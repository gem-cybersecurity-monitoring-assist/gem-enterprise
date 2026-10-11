import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { deploymentPlan, platformConfigurationEvidence } from "@/lib/platformEnvironment";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json({ deploymentPlan, evidence: platformConfigurationEvidence() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;


  return NextResponse.json(
    {
      error: "Deployment plan creation should be persisted and reviewed before production deployment actions are enabled.",
      deploymentPlan,
      evidence: platformConfigurationEvidence(),
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
