import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import {
  listVerificationReviewQueue,
  toVerificationApplicationView,
} from "@/lib/kyc/service";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const applications = await listVerificationReviewQueue(
    gate.session.userId,
    gate.session.role,
  );
  return json({
    applications: applications.map((application) =>
      toVerificationApplicationView(application, { includeInternal: true }),
    ),
    total: applications.length,
    replacementEndpoint: "/api/verify/review",
  });
}

export async function POST() {
  return json(
    {
      error:
        "Legacy KYC decision mutation is disabled because it could overwrite an existing decision.",
      code: "LEGACY_KYC_DECISION_MUTATION_DISABLED",
      replacementEndpoint: "/api/verify/review",
    },
    410,
  );
}
