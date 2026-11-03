import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildExperianAuthorizationUrl } from "@/lib/experian/client";
import { requireExperianConfig } from "@/lib/experian/config";
import { createExperianNonce, createExperianPkcePair } from "@/lib/experian/crypto";
import {
  authorizeExperianWorkspace,
  requireTrustedExperianNavigation,
} from "@/lib/experian/security";
import { encodeExperianState } from "@/lib/experian/state";
import { createExperianAuthorizationAttempt } from "@/lib/experian/store";
import {
  correlationId,
  emitTokMetricAudit,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const querySchema = z.object({
  workspaceId: z.string().trim().min(1),
  redirectAfter: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireTrustedExperianNavigation(request);
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      throw new TokMetricError(400, "VALIDATION_ERROR", "workspaceId is required.");
    }
    const session = await authorizeExperianWorkspace(request, parsed.data.workspaceId);
    const config = requireExperianConfig();
    if (config.authMode !== "AUTHORIZATION_CODE" || !config.consumerDelegationApproved) {
      throw new TokMetricError(
        409,
        "EXPERIAN_HOSTED_AUTHORIZATION_UNAVAILABLE",
        "Experian hosted consumer authorization is not approved for this application.",
      );
    }
    const nonce = createExperianNonce();
    const pkce = createExperianPkcePair();
    const attempt = await createExperianAuthorizationAttempt({
      nonce,
      workspaceId: parsed.data.workspaceId,
      actorId: session.userId,
      codeVerifier: pkce.verifier,
      requestedScopes: config.scopes,
      redirectUri: config.redirectUri,
      redirectAfter: parsed.data.redirectAfter,
    });
    const state = encodeExperianState({
      nonce: attempt.nonce,
      workspaceId: parsed.data.workspaceId,
      actorId: session.userId,
      createdAt: Date.now(),
    });
    const authorizationUrl = buildExperianAuthorizationUrl({
      config,
      state,
      codeChallenge: pkce.challenge,
    });
    await emitTokMetricAudit({
      workspaceId: parsed.data.workspaceId,
      actorId: session.userId,
      action: "experian.connector.authorization_started",
      entityType: "connector",
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        authMode: config.authMode,
        environment: config.environment,
        scopeCount: config.scopes.length,
        pkce: true,
        externalWritePerformed: false,
      },
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
