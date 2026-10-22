import { NextResponse } from "next/server";
import { publicDigitalHubCatalog } from "@/lib/digital-hub/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      hub: publicDigitalHubCatalog(),
      capabilities: {
        referralRouting: true,
        serviceRouting: true,
        browserWalletDiscovery: true,
        walletSessionLifecycle: true,
        ecosystemPreviewApi: true,
        profileConnections: true,
        profileRouting: true,
        marketReferenceRoutes: true,
        communityHubRoute: true,
        governedCommunityRouting: true,
        walletCustody: false,
        privateKeyCollection: false,
        liveTradingFromPublicHub: false,
        providerStatusIsServerControlled: true,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
