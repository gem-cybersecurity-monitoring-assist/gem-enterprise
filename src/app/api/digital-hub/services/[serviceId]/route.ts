import { NextRequest, NextResponse } from "next/server";
import { persistDigitalHubEvent } from "@/lib/digital-hub/backend";
import { getDigitalHubService } from "@/lib/digital-hub/catalog";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await context.params;
  const service = getDigitalHubService(serviceId);

  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SERVICE_NOT_FOUND" },
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
      event: "service_open",
      target: service.id,
      path: "/digital-hub",
    }).catch((error) => {
      console.error("[digital-hub:service-open]", error);
    });
  }

  return NextResponse.redirect(new URL(service.href, request.nextUrl.origin), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}
