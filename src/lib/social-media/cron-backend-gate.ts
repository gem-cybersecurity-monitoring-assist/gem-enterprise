import { hasSocialTransactionalAuthority } from "./transactional-authority";
import { NextResponse } from "next/server";
import { shouldUseSupabaseGateway } from "@/lib/supabase-gateway";
import { probeSocialPublishingGatewayAdapter } from "./publishing/gateway-client";

/**
 * Cron jobs have machine authentication but no end-user session.
 * Refuse unsupported Prisma work while the production persistence authority
 * is Supabase gateway; never fall back to an unrelated database.
 *
 * The worker uses the verified gateway adapter. Planning and analytics can
 * use their existing Prisma transactions when explicitly bound to the same
 * gateway project and the worker adapter also passes its health check.
 */
export type SocialCronGatewayScope =
  | "social-publishing"
  | "social-analytics"
  | "social-autopilot";

function gatewayBlockResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "SOCIAL_GATEWAY_BACKEND_REQUIRED",
        message:
          "Social scheduling and analytics require a verified transactional gateway backend.",
      },
      externalActionTaken: false,
    },
    { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function socialCronGatewayBlock(
  scope: SocialCronGatewayScope,
): Promise<NextResponse | null> {
  if (!shouldUseSupabaseGateway()) return null;
  if (scope === "social-publishing" || hasSocialTransactionalAuthority()) {
    // Lifts only when the adapter flag is on AND the health probe passes.
    // Any doubt (flag off, probe failed, gateway error, timeout, or a
    // probe that throws) keeps the 503. The gate never propagates an
    // error — it is a fail-closed boundary.
    try {
      if (await probeSocialPublishingGatewayAdapter()) return null;
    } catch {
      return gatewayBlockResponse();
    }
  }
  return gatewayBlockResponse();
}
