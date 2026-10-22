import { NextResponse } from "next/server";
import {
  digitalHubEcosystem,
  publicDigitalHubProfiles,
} from "@/lib/digital-hub/ecosystem";

export const dynamic = "force-dynamic";

export async function GET() {
  const reownConfigured = Boolean(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID);
  const phantomAppConfigured = Boolean(process.env.NEXT_PUBLIC_PHANTOM_APP_ID);

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      brand: digitalHubEcosystem.brand,
      wallets: digitalHubEcosystem.wallets,
      profiles: publicDigitalHubProfiles(),
      redirects: {
        canonicalOrigin: digitalHubEcosystem.brand.publicUrl,
        walletReturnPath: digitalHubEcosystem.brand.walletReturnPath,
        walletReturnUrl: `${digitalHubEcosystem.brand.publicUrl}${digitalHubEcosystem.brand.walletReturnPath}`,
      },
      adapters: {
        injectedEvm: true,
        phantomInjected: true,
        farcasterMiniAppRoute: false,
        reownAppKit: {
          configured: reownConfigured,
          projectIdRequired: true,
          supportedExpansion: ["EVM", "Solana", "Bitcoin", "TON", "TRON"],
        },
        phantomConnect: {
          configured: phantomAppConfigured,
          appIdRequiredForEmbeddedProviders: true,
          injectedProviderRequiresAppId: false,
        },
      },
      marketSources: digitalHubEcosystem.marketSources,
      community: digitalHubEcosystem.community,
      security: {
        custody: false,
        privateKeyCollection: false,
        seedPhraseCollection: false,
        automaticTransactions: false,
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
