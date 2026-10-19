import { NextResponse } from "next/server";
import { shouldUseSupabaseGateway } from "@/lib/supabase-gateway";

/**
 * Cron jobs have machine authentication but no end-user session.
 * Refuse unsupported Prisma work while the production persistence authority
 * is Supabase gateway; never fall back to an unrelated database.
 */
export function socialCronGatewayBlock(): NextResponse | null {
  if (!shouldUseSupabaseGateway()) return null;
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "SOCIAL_GATEWAY_BACKEND_REQUIRED",
        message: "Social scheduling and analytics require a verified transactional gateway backend.",
      },
      externalActionTaken: false,
    },
    { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
