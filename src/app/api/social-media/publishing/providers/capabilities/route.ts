import { NextRequest, NextResponse } from "next/server";
import {
  getSocialPublishingCapabilities,
  isYoutubeUploadCertified,
  youtubeUploadCertifiedTimestamp,
} from "@/lib/social-media/publishing/capabilities";
import {
  correlationId,
  requireTokMetricSession,
  requireWorkspaceAccess,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

/**
 * Operator-visible per-provider publishing capability truth table.
 * Contains no secrets — only what the adapters can actually do today.
 */
export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          correlationId: cid,
          error: { code: "VALIDATION_ERROR", message: "workspaceId is required." },
        },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
    await requireWorkspaceAccess(workspaceId, session);
    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        youtubeUploadCertified: isYoutubeUploadCertified(),
        youtubeUploadCertifiedAt: youtubeUploadCertifiedTimestamp(),
        capabilities: getSocialPublishingCapabilities(),
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
