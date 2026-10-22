import { NextRequest, NextResponse } from "next/server";
import {
  consumeDigitalHubRateLimit,
  digitalHubEventSchema,
  isAllowedDigitalHubEvent,
  persistDigitalHubEvent,
} from "@/lib/digital-hub/backend";
import {
  requireSameOriginSupportRequest,
  SupportSecurityError,
} from "@/lib/support/security";

export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...headers,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginSupportRequest(request);
  } catch (error) {
    if (error instanceof SupportSecurityError) {
      return response({ ok: false, error: error.code }, error.statusCode);
    }
    return response({ ok: false, error: "REQUEST_REJECTED" }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2_048) {
    return response({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateKey = forwarded || request.headers.get("x-real-ip") || "anonymous";
  const rate = consumeDigitalHubRateLimit(rateKey);
  const rateHeaders = {
    "X-RateLimit-Limit": "30",
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
  };

  if (!rate.allowed) {
    return response({ ok: false, error: "RATE_LIMITED" }, 429, rateHeaders);
  }

  const body = await request.json().catch(() => null);
  const parsed = digitalHubEventSchema.safeParse(body);
  if (!parsed.success || !isAllowedDigitalHubEvent(parsed.data)) {
    return response({ ok: false, error: "INVALID_EVENT" }, 400, rateHeaders);
  }

  try {
    const stored = await persistDigitalHubEvent(parsed.data);
    return response({ ok: true, ...stored }, 202, rateHeaders);
  } catch (error) {
    console.error("[digital-hub:event-persistence]", error);
    return response({ ok: false, error: "EVENT_PERSISTENCE_UNAVAILABLE" }, 503, rateHeaders);
  }
}
