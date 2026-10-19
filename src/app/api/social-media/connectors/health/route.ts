import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  parseJson,
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
import { refreshSocialAccessToken } from "@/lib/social-media/oauth/client";
import { evaluateSocialCredentialLifecycle } from "@/lib/social-media/oauth/lifecycle";
import {
  claimSocialConnectorCredentialRefresh,
  loadSocialConnectorCredential,
  recordSocialConnectorLifecycle,
  releaseSocialConnectorCredentialRefreshClaim,
} from "@/lib/social-media/oauth/lifecycle-store";

const healthSchema = z.object({
  workspaceId: z.string().trim().min(1),
  connectorId: z.string().trim().min(1),
});

const rejectedRefreshCodes = new Set([
  "SOCIAL_TOKEN_REFRESH_REJECTED",
  "SOCIAL_REFRESH_TOKEN_MISSING",
  "SOCIAL_TOKEN_REFRESH_UNSUPPORTED",
]);

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(
      403,
      "CROSS_ORIGIN_REQUEST_BLOCKED",
      "Connector credential checks require a same-origin request.",
    );
  }
}

function isRejectedRefresh(error: unknown) {
  return error instanceof TokMetricError && rejectedRefreshCodes.has(error.code);
}

function isTransientRefreshFailure(error: unknown) {
  return error instanceof TokMetricError && error.code === "SOCIAL_TOKEN_REFRESH_UNAVAILABLE";
}

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let auditableWorkspaceId: string | undefined;
  let connectorId: string | undefined;
  let provider: string | undefined;
  let actorId: string | undefined;
  let refreshClaimId: string | undefined;
  let refreshAttempted = false;
  let refreshSucceeded = false;
  let concurrentRotationObserved = false;

  try {
    requireSameOrigin(request);
    const session = await requireActiveTokMetricSession(request);
    actorId = session.userId;
    const parsed = await parseJson(request, healthSchema);
    workspaceId = parsed.workspaceId!;
    connectorId = parsed.connectorId!;
    const membership = await requireWorkspaceAccess(workspaceId, session);
    auditableWorkspaceId = workspaceId;
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(workspaceId, "connector");

    const stored = await loadSocialConnectorCredential({ workspaceId, connectorId });
    provider = stored.connector.provider;
    const { config, missing, ok } = validateSocialOAuthProviderConfig(stored.connector.provider);
    if (!ok) {
      throw new TokMetricError(
        503,
        "SOCIAL_OAUTH_CONFIGURATION_CHANGED",
        `${getSocialOAuthProviderConfig(stored.connector.provider).displayName} configuration is incomplete: ${missing.join(", ")}`,
      );
    }

    let credential = stored.credential;
    let lifecycle = evaluateSocialCredentialLifecycle(config, credential);

    if (lifecycle.shouldRefresh) {
      const claim = await claimSocialConnectorCredentialRefresh({
        workspaceId,
        connectorId,
        expectedCredentialRotatedAt: stored.credentialRotatedAt,
      });
      refreshClaimId = claim.claimId;
      refreshAttempted = true;

      try {
        const refreshed = await refreshSocialAccessToken({ config, credential });
        credential = refreshed.credential;
        lifecycle = evaluateSocialCredentialLifecycle(config, credential);
        refreshSucceeded = true;
      } catch (error) {
        const latest = await loadSocialConnectorCredential({ workspaceId, connectorId });
        if (latest.credentialRotatedAt !== stored.credentialRotatedAt) {
          credential = latest.credential;
          lifecycle = evaluateSocialCredentialLifecycle(config, credential);
          concurrentRotationObserved = true;
        } else if (isRejectedRefresh(error)) {
          const reauthorization = {
            ...lifecycle,
            lifecycle: "REAUTHORIZATION_REQUIRED" as const,
            connectorState: "REAUTHORIZATION_REQUIRED" as const,
            shouldRefresh: false,
          };
          await recordSocialConnectorLifecycle({
            workspaceId,
            connectorId,
            lifecycle: reauthorization,
            refreshClaimId,
            refreshAttempted: true,
            refreshSucceeded: false,
          });
          throw error;
        } else if (isTransientRefreshFailure(error)) {
          const degraded = {
            ...lifecycle,
            connectorState: "DEGRADED" as const,
            shouldRefresh: false,
          };
          await recordSocialConnectorLifecycle({
            workspaceId,
            connectorId,
            lifecycle: degraded,
            refreshClaimId,
            refreshAttempted: true,
            refreshSucceeded: false,
          });
          throw error;
        } else {
          const closed = {
            ...lifecycle,
            connectorState:
              lifecycle.lifecycle === "EXPIRED_REFRESHABLE"
                ? ("TOKEN_EXPIRED" as const)
                : ("DEGRADED" as const),
            shouldRefresh: false,
          };
          await recordSocialConnectorLifecycle({
            workspaceId,
            connectorId,
            lifecycle: closed,
            refreshClaimId,
            refreshAttempted: true,
            refreshSucceeded: false,
          });
          throw error;
        }
      }
    }

    let connector;
    try {
      connector = await recordSocialConnectorLifecycle({
        workspaceId,
        connectorId,
        lifecycle,
        credential: refreshSucceeded ? credential : undefined,
        expectedCredentialRotatedAt: refreshSucceeded ? stored.credentialRotatedAt : undefined,
        refreshClaimId,
        refreshAttempted,
        refreshSucceeded,
        concurrentRotationObserved,
      });
    } catch (error) {
      if (!(error instanceof TokMetricError) || error.code !== "SOCIAL_CREDENTIAL_ROTATION_CONFLICT") {
        throw error;
      }
      const latest = await loadSocialConnectorCredential({ workspaceId, connectorId });
      credential = latest.credential;
      lifecycle = evaluateSocialCredentialLifecycle(config, credential);
      refreshSucceeded = false;
      concurrentRotationObserved = true;
      connector = await recordSocialConnectorLifecycle({
        workspaceId,
        connectorId,
        lifecycle,
        refreshClaimId,
        refreshAttempted,
        refreshSucceeded: false,
        concurrentRotationObserved: true,
      });
    }

    await emitTokMetricAudit({
      workspaceId,
      actorId,
      action: "social.connector.credential_health_checked",
      entityType: "connector",
      entityId: connectorId,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        provider,
        lifecycle: lifecycle.lifecycle,
        tokenRefreshAttempted: refreshAttempted,
        tokenRefreshSucceeded: refreshSucceeded,
        concurrentRotationObserved,
        providerAccountProbePerformed: false,
        externalPublishingEnabled: false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        connector,
        credentialHealth: lifecycle,
        tokenRefreshAttempted: refreshAttempted,
        tokenRefreshSucceeded: refreshSucceeded,
        concurrentRotationObserved,
        providerAccountProbePerformed: false,
        externalPublishingActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (auditableWorkspaceId) {
      await emitTokMetricAudit({
        workspaceId: auditableWorkspaceId,
        actorId,
        action: "social.connector.credential_health_failed",
        entityType: "connector",
        entityId: connectorId,
        correlationId: cid,
        outcome: "failure",
        sourceChannel: "website",
        metadata: {
          provider,
          tokenRefreshAttempted: refreshAttempted,
          concurrentRotationObserved,
          failureCode: error instanceof TokMetricError ? error.code : "UNEXPECTED_ERROR",
          externalPublishingEnabled: false,
        },
      }).catch(() => undefined);
    }
    const response = tokMetricErrorResponse(error, cid);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    if (auditableWorkspaceId && connectorId && refreshClaimId) {
      await releaseSocialConnectorCredentialRefreshClaim({
        workspaceId: auditableWorkspaceId,
        connectorId,
        claimId: refreshClaimId,
      }).catch(() => undefined);
    }
  }
}
