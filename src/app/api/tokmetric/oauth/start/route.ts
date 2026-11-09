import { requireSocialConnectorSession, requireSocialConnectorWorkspace } from "@/lib/social-media/connector-authority";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { correlationId, emitTokMetricAudit, requirePermission, tokMetricErrorResponse, TokMetricError } from "@/lib/tokmetric/security";
import { buildAuthorizationUrl } from "@/lib/tokmetric/oauth/client";
import { connectorProviders, isPlatformApprovalRequired, validateTikTokOAuthConfig } from "@/lib/tokmetric/oauth/config";
import { createPkcePair } from "@/lib/tokmetric/oauth/crypto";
import { encodeOAuthState } from "@/lib/tokmetric/oauth/state";
import { createOAuthAuthorizationAttempt } from "@/lib/tokmetric/oauth/attempts";

const startSchema = z.object({ workspaceId: z.string().min(1), provider: z.enum(connectorProviders).default("TIKTOK_LOGIN_KIT") });

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireSocialConnectorSession(request);
    const params = startSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const membership = await requireSocialConnectorWorkspace(params.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    if (isPlatformApprovalRequired(params.provider)) throw new TokMetricError(409, "PLATFORM_APPROVAL_REQUIRED", "This TikTok connector requires platform product approval before authorization.");
    const { ok, missing, config } = validateTikTokOAuthConfig();
    if (!ok) throw new TokMetricError(503, "TOKMETRIC_OAUTH_NOT_CONFIGURED", `TikTok OAuth is not configured: ${missing.join(", ")}`);
    const pkce = createPkcePair();
    const attempt = await createOAuthAuthorizationAttempt({ workspaceId: params.workspaceId, actorId: session.userId, provider: params.provider, environment: config.environment, codeVerifier: pkce.verifier });
    const state = encodeOAuthState({ nonce: attempt.nonce, workspaceId: params.workspaceId, provider: params.provider, environment: config.environment, createdAt: Date.now(), actorId: session.userId });
    const url = buildAuthorizationUrl({ workspaceId: params.workspaceId, provider: params.provider, state, codeChallenge: pkce.challenge });
    await emitTokMetricAudit({ workspaceId: params.workspaceId, actorId: session.userId, action: "tokmetric.connector.authorization_started", entityType: "connector", correlationId: cid, outcome: "success", sourceChannel: "website", metadata: { provider: params.provider, environment: config.environment } });
    return NextResponse.redirect(url);
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
