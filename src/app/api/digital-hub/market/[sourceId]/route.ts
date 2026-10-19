import { NextRequest, NextResponse } from "next/server";
import { persistDigitalHubEvent } from "@/lib/digital-hub/backend";
import { getDigitalHubMarketSource } from "@/lib/digital-hub/ecosystem";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await context.params;
  const source = getDigitalHubMarketSource(sourceId);

  if (!source) {
    return NextResponse.json(
      { ok: false, error: "MARKET_SOURCE_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

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
      event: "market_reference_open",
      target: source.id,
      path: "/digital-hub",
    }).catch((error) => {
      console.error("[digital-hub:market-open]", error);
    });
  }

  return NextResponse.redirect(source.href, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
