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
import { markVideoUploadComplete } from "@/lib/tokmetric/publishing/service";

const schema = z.object({
  workspaceId: z.string().min(1),
  jobId: z.string().min(1),
});

type UploadCompletePayload = {
  workspaceId: string;
  jobId: string;
};

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const input = await parseJson(request, schema) as UploadCompletePayload;
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "publish", "content");
    const job = await markVideoUploadComplete({
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      actorId: session.userId,
      correlationId: cid,
    });
    return NextResponse.json({ ok: true, correlationId: cid, data: job }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
