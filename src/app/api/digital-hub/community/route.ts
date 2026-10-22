import { NextRequest, NextResponse } from "next/server";
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
      event: "community_open",
      target: "community-hub",
      path: "/digital-hub",
    }).catch((error) => {
      console.error("[digital-hub:community-open]", error);
    });
  }

  return NextResponse.redirect(new URL("/hub", request.nextUrl.origin), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
