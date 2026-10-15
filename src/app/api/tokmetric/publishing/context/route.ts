import { NextRequest, NextResponse } from "next/server";
import { correlationId, requireTokMetricSession, tokMetricErrorResponse } from "@/lib/tokmetric/security";
import { getVideoPublishingContext } from "@/lib/tokmetric/publishing/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const context = await getVideoPublishingContext(session);
    return NextResponse.json(
      { ok: true, correlationId: cid, data: context },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
