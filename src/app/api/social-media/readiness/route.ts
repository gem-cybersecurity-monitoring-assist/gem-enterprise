import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";
import { shouldUseSupabaseGateway } from "@/lib/supabase-gateway";
import { getSocialBackendReadiness } from "@/lib/social-media/backend-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const providers = getSocialMediaProviderReadiness();

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      livePublishingEnabled: process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED === "true",
      externalActionTaken: false,
      providers,
      workflowBackend: getSocialBackendReadiness(shouldUseSupabaseGateway()),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
