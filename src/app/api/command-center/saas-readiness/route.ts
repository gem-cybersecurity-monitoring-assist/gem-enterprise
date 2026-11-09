import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { getGatewaySessionToken } from "@/lib/auth";
import { buildCommandCenterSnapshot } from "@/lib/commandCenterSnapshotService";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";
import {
  getSocialBackendReadiness,
  getSocialBackendReadinessWithProbe,
} from "@/lib/social-media/backend-readiness";
import { adminReadGateway, shouldUseSupabaseGateway } from "@/lib/supabase-gateway";
import { buildSaaSReadinessReport, isSaaSGatewayAdminStats } from "@/lib/saasRuntimeReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only administrator evidence endpoint. Reuses operating snapshots and
 * provider readiness instead of creating a parallel tenant or billing system.
 * A provider configuration flag is never treated as successful authorization.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const gatewaySelected = shouldUseSupabaseGateway();
  const providers = getSocialMediaProviderReadiness();
  const gatewayAdminStatsPromise = (async () => {
    if (!gatewaySelected) return null;
    const token = await getGatewaySessionToken();
    if (!token) return null;
    try {
      const result: unknown = await adminReadGateway("stats", token);
      return isSaaSGatewayAdminStats(result) ? result : null;
    } catch (error) {
      console.error("[saas-readiness] administrator gateway statistics unavailable", error);
      return null;
    }
  })();
  const [snapshot, social, gatewayAdminStats] = await Promise.all([
    buildCommandCenterSnapshot(),
    getSocialBackendReadinessWithProbe(gatewaySelected).catch((error: unknown) => {
      console.error("[saas-readiness] social backend probe unavailable", error);
      return getSocialBackendReadiness(gatewaySelected);
    }),
    gatewayAdminStatsPromise,
  ]);

  return NextResponse.json(
    buildSaaSReadinessReport({
      snapshot,
      socialBackendState: social.state,
      gatewaySelected,
      gatewayAdminStats,
      providers,
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
