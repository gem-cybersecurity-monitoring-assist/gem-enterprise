import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, requireAdmin } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { verifyMailTransport } from "@/lib/mail/send";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { ipAddress } = getRequestContext(request);
  const limit = rateLimit(ipAddress, {
    key: "auth:recovery-readiness:verify",
    windowMs: 15 * 60_000,
    max: 3,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  const verification = await verifyMailTransport();
  const response = {
    ok: verification.ok,
    service: "gem-password-recovery",
    code: verification.code,
    configured: verification.readiness.configured,
    transportSecurity: verification.readiness.transportSecurity,
    missingVariables: verification.readiness.missing,
    sentMessage: false,
    credentialsExposed: false,
  };

  if (!verification.ok) {
    console.warn("[mail] SMTP transport verification did not pass", {
      code: verification.code,
      missingVariables: verification.readiness.missing,
    });
  }

  return json(response, verification.ok ? 200 : 503);
}
