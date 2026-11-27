import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  parseJson,
  requirePermission,
  requireSameOriginRequest,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import { db } from "@/lib/db";
import { requireSocialConnectorSession, requireSocialConnectorWorkspace, tokMetricConnectorDatabase } from "@/lib/social-media/connector-authority";
import { queryReadOnlyTikTokCreatorSettings } from "@/lib/tokmetric/publishing/preflight";
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
    requireSameOriginRequest(request);
    const session = await requireSocialConnectorSession(request, true);
    const database = tokMetricConnectorDatabase(session) ?? db;
    const input = await parseJson(request, schema) as CreatorInfoPayload;
    const membership = await requireSocialConnectorWorkspace(input.workspaceId, session, database);
    requirePermission(membership, "publish", "content");
    const parameters = {
      workspaceId: input.workspaceId,
      connectorId: input.connectorId,
      actorId: session.userId,
      correlationId: cid,
    };
    const creator = session.authSource === "supabase_gateway"
      ? await queryReadOnlyTikTokCreatorSettings(parameters, database)
      : await getCreatorInfoForPublishing(parameters);
    return NextResponse.json({ ok: true, correlationId: cid, data: creator }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
