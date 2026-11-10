import { requireSocialConnectorSession, requireSocialConnectorWorkspace, tokMetricConnectorDatabase } from "@/lib/social-media/connector-authority";
import { NextRequest, NextResponse } from "next/server";
import { correlationId, emitTokMetricAudit, tokMetricErrorResponse, TokMetricError } from "@/lib/tokmetric/security";
import { exchangeAuthorizationCode } from "@/lib/tokmetric/oauth/client";
import { decodeOAuthState } from "@/lib/tokmetric/oauth/state";
import { persistAuthorizedConnector } from "@/lib/tokmetric/oauth/connectors";
import { consumeOAuthAuthorizationAttempt } from "@/lib/tokmetric/oauth/attempts";
import { type SessionPayload } from "@/lib/auth";

async function sessionFromStateActor(request: NextRequest, actorId: string): Promise<SessionPayload> {
  // getSessionFromRequest (via requireSocialConnectorSession) resolves both
  // local JWT sessions and supabase_gateway (sg1.) sessions; the previous
  // local-JWT-only lookup rejected every gateway session with 401 here.
  const session = await requireSocialConnectorSession(request, true);
  if (!session || session.userId !== actorId) throw new TokMetricError(401, "UNAUTHENTICATED", "OAuth callback requires the initiating authenticated session.");
  return session;
}

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let actorId: string | undefined;
  let auditDatabase: ReturnType<typeof tokMetricConnectorDatabase>;
  try {
    const error = request.nextUrl.searchParams.get("error");
    if (error) throw new TokMetricError(400, "TIKTOK_AUTHORIZATION_DENIED", "TikTok authorization was not completed.");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new TokMetricError(400, "MISSING_AUTHORIZATION_CODE", "TikTok callback did not include an authorization code.");
    const stateValue = request.nextUrl.searchParams.get("state");
    if (!stateValue) throw new TokMetricError(401, "OAUTH_STATE_MISSING", "OAuth state is missing.");
    const state = decodeOAuthState(stateValue);
    workspaceId = state.workspaceId;
    actorId = state.actorId;
    const session = await sessionFromStateActor(request, state.actorId);
    const database = tokMetricConnectorDatabase(session);
    await requireSocialConnectorWorkspace(state.workspaceId, session, database);
    auditDatabase = database;
    const consumed = await consumeOAuthAuthorizationAttempt(state, database);
    const token = await exchangeAuthorizationCode({ code, codeVerifier: consumed.codeVerifier });
    const connector = await persistAuthorizedConnector({ workspaceId: state.workspaceId, actorId: session.userId, provider: state.provider, token, correlationId: cid }, database);
    return NextResponse.redirect(new URL(`/tokmetric/accounts?connector=${connector.id}&state=connected`, request.url));
  } catch (error) {
    if (workspaceId) await emitTokMetricAudit({ workspaceId, actorId, action: "tokmetric.connector.authorization_failed", entityType: "connector", correlationId: cid, outcome: "failure", sourceChannel: "website" }, auditDatabase).catch(() => undefined);
    return tokMetricErrorResponse(error, cid);
  }
}
