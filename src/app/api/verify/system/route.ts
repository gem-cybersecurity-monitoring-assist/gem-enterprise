import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { SECURE_DOCUMENT_UPLOAD_ACTIVE } from "@/lib/kyc/capabilities";
import { evaluatePilotReadiness } from "@/lib/kyc/pilot-readiness";
import {
  GEM_VERIFY_ASSURANCE_LEVELS,
  GEM_VERIFY_MODULES,
  GEM_VERIFY_SYSTEM,
} from "@/lib/kyc/system";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const [accounts, statusGroups, reviewCount, decisionCount, documentCount] =
      await Promise.all([
        db.user.findMany({
          select: {
            id: true,
            role: true,
            status: true,
            isActive: true,
            isEmailVerified: true,
          },
        }),
        db.kYCApplication.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        db.kYCReview.count(),
        db.decision.count(),
        db.kycDocument.count(),
      ]);

    const readiness = evaluatePilotReadiness({
      accounts,
      documentUploadActive: SECURE_DOCUMENT_UPLOAD_ACTIVE,
    });

    const applicationsByStatus = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all]),
    );
    const totalApplications = statusGroups.reduce(
      (total, group) => total + group._count._all,
      0,
    );

    return json({
      ok: true,
      evaluatedAt: new Date().toISOString(),
      viewerRole: gate.session.role,
      system: GEM_VERIFY_SYSTEM,
      assuranceLevels: GEM_VERIFY_ASSURANCE_LEVELS,
      modules: GEM_VERIFY_MODULES,
      readiness,
      operations: {
        totalApplications,
        applicationsByStatus,
        reviewEvents: reviewCount,
        finalDecisions: decisionCount,
        storedDocuments: documentCount,
      },
      safeguards: {
        externalIdentityProviderRequired: false,
        automaticApprovalEnabled: false,
        biometricDecisioningEnabled: false,
        secureDocumentUploadEnabled: SECURE_DOCUMENT_UPLOAD_ACTIVE,
        separationOfDutiesRequired: true,
        auditTrailRequired: true,
      },
    });
  } catch (error) {
    console.error("[GET /api/verify/system]", error);
    return json(
      {
        ok: false,
        error: "GEM Verify system status could not be evaluated.",
        diagnostic: "database_unavailable",
        system: GEM_VERIFY_SYSTEM,
        assuranceLevels: GEM_VERIFY_ASSURANCE_LEVELS,
        modules: GEM_VERIFY_MODULES,
      },
      503,
    );
  }
}
