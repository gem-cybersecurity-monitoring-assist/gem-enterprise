import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  parseJson,
  requirePermission,
  requireTokMetricSession,
  requireWorkspaceAccess,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import { refreshVideoPublishStatus } from "@/lib/tokmetric/publishing/service";

const schema = z.object({
  workspaceId: z.string().min(1),
  jobId: z.string().min(1),
});

type PublishStatusPayload = {
  workspaceId: string;
  jobId: string;
};

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const input = await parseJson(request, schema) as PublishStatusPayload;
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "publish", "content");
    const status = await refreshVideoPublishStatus({
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      actorId: session.userId,
      correlationId: cid,
    });
    return NextResponse.json({ ok: true, correlationId: cid, data: status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
