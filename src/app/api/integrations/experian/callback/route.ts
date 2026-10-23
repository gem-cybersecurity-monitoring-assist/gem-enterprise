import { NextRequest, NextResponse } from "next/server";
import {
  exchangeExperianAuthorizationCode,
  verifyExperianRead,
} from "@/lib/experian/client";
import { requireExperianConfig } from "@/lib/experian/config";
import { authorizeExperianWorkspace } from "@/lib/experian/security";
import { decodeExperianState } from "@/lib/experian/state";
import {
  consumeExperianAuthorizationAttempt,
  persistExperianConnection,
} from "@/lib/experian/store";
import {
  correlationId,
  emitTokMetricAudit,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

function callbackRedirect(
  request: NextRequest,
  redirectAfter: string,
  state: "connected" | "failed",
) {
  const redirect = new URL(redirectAfter, request.url);
  redirect.searchParams.set("provider", "experian");
  redirect.searchParams.set("connectionState", state);
  return redirect;
}
export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let actorId: string | undefined;
  try {
    const stateValue = request.nextUrl.searchParams.get("state");
    if (!stateValue) {
      throw new TokMetricError(401, "EXPERIAN_STATE_MISSING", "Experian authorization state is missing.");
    }
    const state = decodeExperianState(stateValue);
    workspaceId = state.workspaceId;
    actorId = state.actorId;
    const session = await authorizeExperianWorkspace(request, state.workspaceId);
    if (session.userId !== state.actorId) {
      throw new TokMetricError(
        401,
        "EXPERIAN_SESSION_MISMATCH",
        "Experian callback requires the initiating authenticated session.",
      );
    }
    const consumed = await consumeExperianAuthorizationAttempt(state);
    const denied = request.nextUrl.searchParams.get("error");
    if (denied) {
      throw new TokMetricError(
        400,
        "EXPERIAN_AUTHORIZATION_DENIED",
        "Experian authorization was not completed.",
      );
    }
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      throw new TokMetricError(
        400,
        "EXPERIAN_AUTHORIZATION_CODE_MISSING",
        "Experian callback did not include an authorization code.",
      );
    }
    const config = requireExperianConfig();
    if (
      config.authMode !== "AUTHORIZATION_CODE" ||
      !config.consumerDelegationApproved ||
      consumed.attempt.redirectUri !== config.redirectUri
    ) {
      throw new TokMetricError(
        503,
        "EXPERIAN_CONFIGURATION_CHANGED",
        "Experian authorization configuration changed before the callback completed.",
      );
    }
    const credential = await exchangeExperianAuthorizationCode({
      config,
      code,
      codeVerifier: consumed.codeVerifier,
      requestedScopes: consumed.attempt.requestedScopes,
    });
    const verification = await verifyExperianRead({ config, credential });
    const connection = await persistExperianConnection({
      workspaceId: state.workspaceId,
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
      workspaceId: state.workspaceId,
      actorId: session.userId,
      action: "experian.connector.authorized",
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
    const response = NextResponse.redirect(
      callbackRedirect(request, consumed.attempt.redirectAfter, "connected"),
    );
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  } catch (error) {
    if (workspaceId) {
      await emitTokMetricAudit({
        workspaceId,
        actorId,
        action: "experian.connector.authorization_failed",
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
