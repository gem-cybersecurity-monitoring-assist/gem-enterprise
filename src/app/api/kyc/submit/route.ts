import { NextRequest, NextResponse } from "next/server";
import { gatewayVerificationUnavailable } from "@/lib/kyc/gateway-guard";
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

const schema = z.object({ applicationId: z.string().min(1).optional() }).strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.session.authSource === "supabase_gateway") return gatewayVerificationUnavailable();

  let body: unknown = {};
  try {
    if (request.headers.get("content-length") !== "0") body = await request.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return json({ error: "Validation failed" }, 400);

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
      resourceId: result.application.id,
      metadata: { endpoint: "legacy_compatibility" },
      ipAddress,
      userAgent,
    });

    return json({
      ok: true,
      alreadySubmitted: result.alreadySubmitted,
      application: toVerificationApplicationView(result.application),
      replacementEndpoint: "/api/verify/applications/submit",
    });
  } catch (error) {
    if (error instanceof VerificationServiceError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    console.error("[legacy kyc submit]", error);
    return json({ error: "Internal server error" }, 500);
  }
}
