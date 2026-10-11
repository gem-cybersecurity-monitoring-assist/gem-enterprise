import { NextRequest, NextResponse } from "next/server";
import {
  correlationId,
  emitTokMetricAudit,
  requirePermission,
  requireActiveTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import {
  getSocialOAuthProviderConfig,
  validateSocialOAuthProviderConfig,
} from "@/lib/social-media/oauth/config";
import { loadSocialConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
import { probeSocialConnector } from "@/lib/social-media/oauth/probes";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/social-media/connectors/[id]/test
 *
 * Read-only connectivity probe for a single connector. The probe performs one
 * HTTP GET against the provider's own account API and never publishes, posts,
 * or mutates provider-side state.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let connectorId: string | undefined;
  let provider: string | undefined;
  let actorId: string | undefined;

  try {
    const session = await requireActiveTokMetricSession(request);
    actorId = session.userId;
    const { id } = await context.params;
    connectorId = id?.trim();
    if (!connectorId) {
      throw new TokMetricError(400, "VALIDATION_ERROR", "Connector id is required.");
    }
    workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim() || undefined;
    if (!workspaceId) {
      throw new TokMetricError(400, "VALIDATION_ERROR", "workspaceId is required.");
    }
    const membership = await requireWorkspaceAccess(workspaceId, session);
    requirePermission(membership, "manage", "connectors");

    const stored = await loadSocialConnectorCredential({ workspaceId, connectorId });
    provider = stored.connector.provider;
    const { missing, ok } = validateSocialOAuthProviderConfig(stored.connector.provider);
    if (!ok) {
      throw new TokMetricError(
        503,
        "SOCIAL_OAUTH_CONFIGURATION_CHANGED",
        `${getSocialOAuthProviderConfig(stored.connector.provider).displayName} configuration is incomplete: ${missing.join(", ")}`,
      );
    }

    const probe = await probeSocialConnector({
      config: getSocialOAuthProviderConfig(stored.connector.provider),
      credential: stored.credential,
    });

    await emitTokMetricAudit({
      workspaceId,
      actorId,
      action: "social.connector.test_probed",
      entityType: "connector",
      entityId: connectorId,
      correlationId: cid,
      outcome: probe.healthy ? "success" : "failure",
      sourceChannel: "website",
      metadata: {
        provider,
        healthy: probe.healthy,
        latencyMs: probe.latencyMs,
        accountNamePresent: Boolean(probe.accountName),
        scopeCount: probe.scopes.length,
        readOnlyProbe: true,
        externalPublishingEnabled: false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        connectorId,
        provider,
        healthy: probe.healthy,
        latencyMs: probe.latencyMs,
        accountName: probe.accountName || stored.connector.displayName,
        scopes: probe.scopes,
        checkedAt: probe.checkedAt,
        readOnlyProbe: true,
        externalPublishingActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (workspaceId) {
      await emitTokMetricAudit({
        workspaceId,
        actorId,
        action: "social.connector.test_probe_failed",
        entityType: "connector",
        entityId: connectorId,
        correlationId: cid,
        outcome: "failure",
        sourceChannel: "website",
        metadata: {
          provider,
          readOnlyProbe: true,
          failureCode: error instanceof TokMetricError ? error.code : "UNEXPECTED_ERROR",
          externalPublishingEnabled: false,
        },
      }).catch(() => undefined);
    }
    return tokMetricErrorResponse(error, cid);
  }
}
