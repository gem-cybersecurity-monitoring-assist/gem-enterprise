import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  emitTokMetricAudit,
  parseJson,
  requirePermission,
  requireActiveTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import { parseSocialOAuthProvider } from "@/lib/social-media/oauth/config";
import {
  assertSocialProviderPauseAdmin,
  pauseSocialProvider,
  unpauseSocialProvider,
} from "@/lib/social-media/oauth/provider-pause";

type RouteContext = { params: Promise<{ provider: string }> };

const pauseSchema = z.object({
  workspaceId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
});

const unpauseSchema = z.object({
  workspaceId: z.string().trim().min(1),
});

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(
      403,
      "CROSS_ORIGIN_REQUEST_BLOCKED",
      "Provider pause changes require a same-origin request.",
    );
  }
}

/**
 * Admin-only gate: pausing a provider changes publishing behavior for the
 * whole workspace, so it requires workspace administrator authority on top of
 * the connector management permission.
 */
function requirePauseAdmin(
  membership: Awaited<ReturnType<typeof requireWorkspaceAccess>>,
  session: Awaited<ReturnType<typeof requireActiveTokMetricSession>>,
) {
  requirePermission(membership, "manage", "connectors");
  assertSocialProviderPauseAdmin(membership, session);
}

/**
 * PUT /api/social-media/connectors/[provider]/pause
 * Pauses publishing for one provider inside one workspace.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let provider: string | undefined;
  try {
    requireSameOrigin(request);
    const session = await requireActiveTokMetricSession(request);
    const { provider: rawProvider } = await context.params;
    provider = parseSocialOAuthProvider(rawProvider);
    const parsed = await parseJson(request, pauseSchema);
    workspaceId = parsed.workspaceId!;
    const membership = await requireWorkspaceAccess(workspaceId, session);
    requirePauseAdmin(membership, session);

    const record = await pauseSocialProvider({
      workspaceId,
      provider,
      pausedBy: session.userId,
      reason: parsed.reason,
    });

    await emitTokMetricAudit({
      workspaceId,
      actorId: session.userId,
      action: "social.connector.provider_paused",
      entityType: "connector",
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        provider,
        pausedAt: record.pausedAt.toISOString(),
        reason: record.reason,
        externalPublishingEnabled: false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        provider,
        paused: true,
        pausedAt: record.pausedAt.toISOString(),
        pausedBy: record.pausedBy,
        reason: record.reason,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}

/**
 * DELETE /api/social-media/connectors/[provider]/pause
 * Resumes publishing for one provider inside one workspace.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let provider: string | undefined;
  try {
    requireSameOrigin(request);
    const session = await requireActiveTokMetricSession(request);
    const { provider: rawProvider } = await context.params;
    provider = parseSocialOAuthProvider(rawProvider);
    const parsed = await parseJson(request, unpauseSchema);
    workspaceId = parsed.workspaceId!;
    const membership = await requireWorkspaceAccess(workspaceId, session);
    requirePauseAdmin(membership, session);

    const result = await unpauseSocialProvider({ workspaceId, provider });

    await emitTokMetricAudit({
      workspaceId,
      actorId: session.userId,
      action: "social.connector.provider_unpaused",
      entityType: "connector",
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        provider,
        wasPaused: result.wasPaused,
        externalPublishingEnabled: false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        provider,
        paused: false,
        wasPaused: result.wasPaused,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
