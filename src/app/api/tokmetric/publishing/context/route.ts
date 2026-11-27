import { NextRequest, NextResponse } from "next/server";
import { correlationId, tokMetricErrorResponse } from "@/lib/tokmetric/security";
import { db } from "@/lib/db";
import { requireSocialConnectorSession, tokMetricConnectorDatabase } from "@/lib/social-media/connector-authority";
import { getVideoPublishingContext } from "@/lib/tokmetric/publishing/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireSocialConnectorSession(request, true);
    const context = await getVideoPublishingContext(session, tokMetricConnectorDatabase(session) ?? db);
    return NextResponse.json(
      { ok: true, correlationId: cid, data: context },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
