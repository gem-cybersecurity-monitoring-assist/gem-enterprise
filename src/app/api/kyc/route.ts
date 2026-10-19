import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/auth-helpers";
import {
  getLatestVerificationApplication,
  toVerificationApplicationView,
} from "@/lib/kyc/service";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const application = await getLatestVerificationApplication(gate.session.userId);
  return json({
    ok: true,
    application: application
      ? toVerificationApplicationView(application)
      : null,
    replacementEndpoint: "/api/verify/applications",
  });
}

export async function POST() {
  return json(
    {
      error: "The legacy KYC intake endpoint is disabled.",
      code: "LEGACY_KYC_INTAKE_DISABLED",
      replacementEndpoint: "/api/verify/applications",
      prohibitedData:
        "Do not submit identity documents, government identification numbers, financial records, credentials, or biometric information.",
    },
    410,
  );
}
