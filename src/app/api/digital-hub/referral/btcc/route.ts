import { NextRequest, NextResponse } from "next/server";
import { digitalHubCatalog } from "@/lib/digital-hub/catalog";
import { persistDigitalHubEvent } from "@/lib/digital-hub/backend";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const referer = request.headers.get("referer");
  let sameOrigin = false;

  if (referer) {
    try {
      sameOrigin = new URL(referer).origin === request.nextUrl.origin;
    } catch {
      sameOrigin = false;
    }
  }

  if (sameOrigin) {
    await persistDigitalHubEvent({
      event: "referral_open",
      target: "btcc",
      path: "/digital-hub",
    }).catch((error) => {
      console.error("[digital-hub:referral-persistence]", error);
    });
  }

  return NextResponse.redirect(digitalHubCatalog.referral.href, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
