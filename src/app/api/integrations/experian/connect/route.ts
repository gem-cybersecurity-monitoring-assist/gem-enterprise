import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestExperianDeveloperToken, verifyExperianRead } from "@/lib/experian/client";
import { requireExperianConfig } from "@/lib/experian/config";
import {
  authorizeExperianWorkspace,
  requireSameOriginExperianMutation,
} from "@/lib/experian/security";
import { persistExperianConnection } from "@/lib/experian/store";
import {
  correlationId,
  emitTokMetricAudit,
  parseJson,
  TokMetricError,
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
    const config = requireExperianConfig();
    if (config.authMode !== "DEVELOPER_PASSWORD") {
      throw new TokMetricError(
        409,
        "EXPERIAN_AUTH_MODE_MISMATCH",
        "This Experian product requires the hosted authorization flow.",
      );
    }
    const credential = await requestExperianDeveloperToken(config);
    const verification = await verifyExperianRead({ config, credential });
    const connection = await persistExperianConnection({
      workspaceId: input.workspaceId,
      authMode: config.authMode,
      environment: config.environment,
      credential,
      externalAccountReference: verification.externalAccountReference,
      displayLabel: verification.displayLabel,
      approvedCapabilities: config.approvedCapabilities,
      responseDigest: verification.responseDigest,
      verifiedAt: verification.verifiedAt,
    });
    await emitTokMetricAudit({
      workspaceId: input.workspaceId,
      actorId: session.userId,
      action: "experian.connector.connected",
      entityType: "connector",
      entityId: connection.id,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        authMode: config.authMode,
        environment: config.environment,
        readVerificationPerformed: true,
        consumerCreditPayloadStored: false,
        externalWritePerformed: false,
      },
    });
    return NextResponse.json(
      {
        ok: true,
        connection: {
          state: connection.state,
          displayLabel: connection.displayLabel,
          environment: connection.environment,
          lastReadVerifiedAt: connection.lastReadVerifiedAt,
          approvedCapabilities: connection.approvedCapabilities,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (workspaceId) {
      await emitTokMetricAudit({
        workspaceId,
        actorId,
        action: "experian.connector.connection_failed",
        entityType: "connector",
        correlationId: cid,
        outcome: "failure",
        sourceChannel: "website",
        metadata: { externalWritePerformed: false },
      }).catch(() => undefined);
    }
    return tokMetricErrorResponse(error, cid);
  }
}
