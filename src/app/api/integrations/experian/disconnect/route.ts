import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revokeExperianCredential } from "@/lib/experian/client";
import { getExperianConfig } from "@/lib/experian/config";
import {
  authorizeExperianWorkspace,
  requireSameOriginExperianMutation,
} from "@/lib/experian/security";
import {
  disconnectExperianConnection,
  getExperianConnection,
  getExperianCredential,
} from "@/lib/experian/store";
import {
  correlationId,
  emitTokMetricAudit,
  parseJson,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const schema = z.object({ workspaceId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let actorId: string | undefined;
  try {
    requireSameOriginExperianMutation(request);
    const input = await parseJson(request, schema);
    workspaceId = input.workspaceId;
    const session = await authorizeExperianWorkspace(request, input.workspaceId);
    actorId = session.userId;
    const existing = await getExperianConnection(input.workspaceId);
    let revocation = { attempted: false, revoked: false };
    if (existing?.state === "CONNECTED") {
      const credential = await getExperianCredential(existing.id);
      revocation = await revokeExperianCredential({
        config: getExperianConfig(),
        credential,
      });
    }
    const disconnected = await disconnectExperianConnection(input.workspaceId);
    await emitTokMetricAudit({
      workspaceId: input.workspaceId,
      actorId: session.userId,
      action: "experian.connector.disconnected",
      entityType: "connector",
      entityId: disconnected?.id,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        providerRevocationAttempted: revocation.attempted,
        providerRevoked: revocation.revoked,
        localCredentialDeleted: Boolean(disconnected),
      },
    });
    return NextResponse.json(
      { ok: true, disconnected: true, providerRevocation: revocation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (workspaceId) {
      await emitTokMetricAudit({
        workspaceId,
        actorId,
        action: "experian.connector.disconnect_failed",
        entityType: "connector",
        correlationId: cid,
        outcome: "failure",
        sourceChannel: "website",
      }).catch(() => undefined);
    }
    return tokMetricErrorResponse(error, cid);
  }
}
