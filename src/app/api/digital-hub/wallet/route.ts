import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      mode: "non_custodial_browser_session",
      providers: [
        {
          id: "metamask",
          ecosystem: "evm",
          discovery: ["eip6963", "eip1193"],
          mobile: "provider_or_wallet_app",
        },
        {
          id: "coinbase",
          ecosystem: "evm",
          discovery: ["eip6963", "eip1193"],
          mobile: "provider_or_wallet_app",
        },
        {
          id: "phantom",
          ecosystem: "solana",
          discovery: ["phantom_injected_provider"],
          mobile: "phantom_in_app_browser",
        },
        {
          id: "browser",
          ecosystem: "evm",
          discovery: ["eip6963", "eip1193"],
          mobile: "provider_dependent",
        },
      ],
      session: {
        restoresAuthorizedAccounts: true,
        observesAccountChanges: true,
        observesNetworkChanges: true,
        localDisconnect: true,
      },
      custody: false,
      collectsPrivateKeys: false,
      collectsSeedPhrases: false,
      requestsTransactions: false,
      requestsPayments: false,
      requestsSignatures: false,
      storesWalletAddresses: false,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
