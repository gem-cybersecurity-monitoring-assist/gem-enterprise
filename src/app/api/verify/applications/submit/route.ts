import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emitAuditLog } from "@/lib/audit";
import {
  getRequestContext,
  requireSession,
} from "@/lib/api/auth-helpers";
import {
  submitVerificationApplication,
  toVerificationApplicationView,
  VerificationServiceError,
} from "@/lib/kyc/service";

const submitSchema = z
  .object({ applicationId: z.string().min(1) })
  .strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Application ID is required." }, 400);
  }

  try {
    const result = await submitVerificationApplication(
      gate.session.userId,
      parsed.data.applicationId,
    );
    const { ipAddress, userAgent } = getRequestContext(request);

    await emitAuditLog({
      userId: gate.session.userId,
      action: "kyc_submit",
      resource: "verification_application",
      resourceId: parsed.data.applicationId,
      metadata: {
        stage: "submitted_for_manual_review",
        alreadySubmitted: result.alreadySubmitted,
      },
      ipAddress,
      userAgent,
    });

    return json({
      ok: true,
      alreadySubmitted: result.alreadySubmitted,
      application: toVerificationApplicationView(result.application),
    });
  } catch (error) {
    if (error instanceof VerificationServiceError) {
      return json(
        { error: error.message, code: error.code, details: error.details },
        error.statusCode,
      );
    }
    console.error("[verify/submit]", error);
    return json({ error: "Internal server error" }, 500);
  }
}
