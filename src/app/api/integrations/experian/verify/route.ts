import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  refreshExperianCredential,
  requestExperianDeveloperToken,
  verifyExperianRead,
} from "@/lib/experian/client";
import { requireExperianConfig } from "@/lib/experian/config";
import {
  authorizeExperianWorkspace,
  requireSameOriginExperianMutation,
} from "@/lib/experian/security";
import {
  getExperianConnection,
  getExperianCredential,
  persistExperianConnection,
} from "@/lib/experian/store";
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
    const existing = await getExperianConnection(input.workspaceId);
    if (!existing || existing.state !== "CONNECTED") {
      throw new TokMetricError(
        409,
        "EXPERIAN_CONNECTION_REQUIRED",
        "Connect Experian before running read verification.",
      );
    }
    let credential = await getExperianCredential(existing.id);
    const expiresSoon = credential.expiresAt
      ? new Date(credential.expiresAt).getTime() <= Date.now() + 60_000
      : false;
    if (config.authMode === "DEVELOPER_PASSWORD") {
      credential = await requestExperianDeveloperToken(config);
    } else if (expiresSoon) {
      credential = await refreshExperianCredential({ config, credential });
    }
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
      action: "experian.connector.read_verified",
      entityType: "connector",
      entityId: connection.id,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        environment: config.environment,
        consumerCreditPayloadStored: false,
        externalWritePerformed: false,
      },
    });
    return NextResponse.json(
      {
        ok: true,
        verification: {
          state: connection.state,
          displayLabel: connection.displayLabel,
          lastReadVerifiedAt: connection.lastReadVerifiedAt,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (workspaceId) {
      await emitTokMetricAudit({
        workspaceId,
        actorId,
        action: "experian.connector.read_verification_failed",
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
