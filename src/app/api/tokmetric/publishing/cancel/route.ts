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
import { cancelPullFromUrlPublish } from "@/lib/tokmetric/publishing/pullCancel";

const schema = z.object({
  workspaceId: z.string().min(1),
  jobId: z.string().min(1),
});

type CancelPayload = {
  workspaceId: string;
  jobId: string;
};

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const input = await parseJson(request, schema) as CancelPayload;
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "publish", "content");
    const job = await cancelPullFromUrlPublish({
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      actorId: session.userId,
      correlationId: cid,
    });
    return NextResponse.json(
      { ok: true, correlationId: cid, data: job },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
