import { NextResponse } from "next/server";

/** Gateway sessions must not fall through into a different Prisma authority. */
export function gatewayVerificationUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      code: "VERIFICATION_GATEWAY_BACKEND_REQUIRED",
      error: "Verification is temporarily unavailable for this authentication mode.",
    },
    { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
