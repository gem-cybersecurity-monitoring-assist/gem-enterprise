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
import { getCreatorInfoForPublishing } from "@/lib/tokmetric/publishing/service";

const schema = z.object({
  workspaceId: z.string().min(1),
  connectorId: z.string().min(1),
});

type CreatorInfoPayload = {
  workspaceId: string;
  connectorId: string;
};

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const input = await parseJson(request, schema) as CreatorInfoPayload;
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "publish", "content");
    const creator = await getCreatorInfoForPublishing({
      workspaceId: input.workspaceId,
      connectorId: input.connectorId,
      actorId: session.userId,
      correlationId: cid,
    });
    return NextResponse.json({ ok: true, correlationId: cid, data: creator }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
