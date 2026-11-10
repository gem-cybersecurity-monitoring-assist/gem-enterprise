import { requireSocialConnectorSession, requireSocialConnectorWorkspace } from "@/lib/social-media/connector-authority";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  requirePermission,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import {
  parseSocialOAuthProvider,
  validateSocialOAuthProviderConfig,
} from "@/lib/social-media/oauth/config";
import { createSocialNonce, createSocialPkcePair } from "@/lib/social-media/oauth/crypto";
import { buildSocialAuthorizationUrl } from "@/lib/social-media/oauth/client";
import { encodeSocialOAuthState } from "@/lib/social-media/oauth/state";
import { createSocialOAuthAuthorizationAttempt } from "@/lib/social-media/oauth/store";

const querySchema = z.object({
  workspaceId: z.string().trim().min(1),
  redirectAfter: z.string().trim().max(500).optional(),
});

function requireTrustedNavigation(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new TokMetricError(
      403,
      "CROSS_SITE_AUTHORIZATION_BLOCKED",
      "Social account authorization must start from the GEM Command Center.",
    );
  }
}

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const cid = correlationId(request);
  try {
    requireTrustedNavigation(request);
    const session = await requireSocialConnectorSession(request);
    const { provider: rawProvider } = await context.params;
    const provider = parseSocialOAuthProvider(rawProvider);
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      throw new TokMetricError(
        400,
        "VALIDATION_ERROR",
        "workspaceId and a valid local redirect target are required.",
      );
    }
    const params = parsed.data;
    const membership = await requireSocialConnectorWorkspace(params.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(params.workspaceId, "connector");

    const { config, missing, ok } = validateSocialOAuthProviderConfig(provider);
    if (!ok) {
      throw new TokMetricError(
        503,
        "SOCIAL_OAUTH_NOT_CONFIGURED",
        `${config.displayName} OAuth is not configured: ${missing.join(", ")}`,
      );
    }

    const pkce = config.usePkce ? createSocialPkcePair() : undefined;
    const nonce = createSocialNonce();
    const attempt = await createSocialOAuthAuthorizationAttempt({
      nonce,
      workspaceId: params.workspaceId,
      actorId: session.userId,
      provider,
      codeVerifier: pkce?.verifier,
      requestedScopes: config.scopes,
      redirectUri: config.redirectUri,
      redirectAfter: params.redirectAfter,
    });
    const state = encodeSocialOAuthState({
      nonce: attempt.nonce,
      workspaceId: params.workspaceId,
      actorId: session.userId,
      provider,
      createdAt: Date.now(),
    });
    const authorizationUrl = buildSocialAuthorizationUrl({
      config,
      state,
      codeChallenge: pkce?.challenge,
    });

    await emitTokMetricAudit({
      workspaceId: params.workspaceId,
      actorId: session.userId,
      action: "social.connector.authorization_started",
      entityType: "connector",
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        provider,
        scopeCount: config.scopes.length,
        pkce: config.usePkce,
        externalActionTaken: false,
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
