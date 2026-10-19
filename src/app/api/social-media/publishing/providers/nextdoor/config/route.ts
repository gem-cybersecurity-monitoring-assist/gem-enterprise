import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildNextdoorPublishConfig,
  NEXTDOOR_CONFIG_KEY,
  readNextdoorPublishConfig,
} from "@/lib/social-media/publishing/nextdoor";
import { SocialPublishingAdapterError } from "@/lib/social-media/publishing/errors";
import {
  correlationId,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  parseJson,
  requirePermission,
  requireTokMetricSession,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

const configSchema = z.object({
  workspaceId: z.string().trim().min(1),
  connectorId: z.string().trim().min(1),
  urlTemplate: z.string().trim().min(1).max(500),
});

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(
      403,
      "CROSS_ORIGIN_REQUEST_BLOCKED",
      "Nextdoor endpoint changes require a same-origin request.",
    );
  }
}

async function loadConnector(workspaceId: string, connectorId: string) {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      provider: string;
      safeMetadata: unknown;
      disabledAt: Date | null;
    }>
  >(Prisma.sql`
    SELECT
      id,
      provider,
      safe_metadata AS "safeMetadata",
      disabled_at AS "disabledAt"
    FROM social_connectors
    WHERE id = ${connectorId}
      AND workspace_id = ${workspaceId}
    LIMIT 1
  `);
  const connector = rows[0];
  if (!connector) {
    throw new TokMetricError(
      404,
      "SOCIAL_CONNECTOR_NOT_FOUND",
      "The social connector was not found in this workspace.",
    );
  }
  if (connector.provider !== "NEXTDOOR") {
    throw new TokMetricError(
      409,
      "SOCIAL_CONNECTOR_PROVIDER_MISMATCH",
      "The Nextdoor endpoint can only be configured on a NEXTDOOR connector.",
    );
  }
  if (connector.disabledAt) {
    throw new TokMetricError(
      409,
      "SOCIAL_CONNECTOR_DISABLED",
      "The connector is disabled and cannot receive endpoint configuration.",
    );
  }
  return connector;
}

/**
 * Status-only view of the Nextdoor publish endpoint configuration. The URL
 * template itself is never returned to the browser — it is server-side only.
 */
export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireTokMetricSession(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    const connectorId = request.nextUrl.searchParams.get("connectorId")?.trim();
    if (!workspaceId || !connectorId) {
      throw new TokMetricError(
        400,
        "VALIDATION_ERROR",
        "workspaceId and connectorId are required.",
      );
    }
    await requireWorkspaceAccess(workspaceId, session);
    const connector = await loadConnector(workspaceId, connectorId);
    const metadata =
      connector.safeMetadata && typeof connector.safeMetadata === "object"
        ? (connector.safeMetadata as Record<string, unknown>)
        : {};
    const config = readNextdoorPublishConfig(metadata);
    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        configured: Boolean(config?.urlTemplate),
        approved: config?.approved === true,
        approvedBy: config?.approvedBy ?? null,
        approvedAt: config?.approvedAt ?? null,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}

/**
 * Human-operator approval of the per-workspace Nextdoor Publish API endpoint.
 * Stores the validated template server-side on the connector; setting it is
 * the explicit HUMAN_REQUIRED approval that unblocks Nextdoor dispatch.
 */
export async function PUT(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireSameOrigin(request);
    const session = await requireTokMetricSession(request);
    const input = await parseJson(request, configSchema);
    const membership = await requireWorkspaceAccess(input.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(input.workspaceId, "connector");

    await loadConnector(input.workspaceId, input.connectorId);
    let config;
    try {
      config = buildNextdoorPublishConfig({
        urlTemplate: input.urlTemplate,
        approvedBy: session.userId,
      });
    } catch (error) {
      if (error instanceof SocialPublishingAdapterError) {
        const status =
          error.code === "NEXTDOOR_CONFIG_ENCRYPTION_UNAVAILABLE" ? 503 : 400;
        throw new TokMetricError(status, error.code, error.message);
      }
      throw error;
    }

    const patch = JSON.stringify({ [NEXTDOOR_CONFIG_KEY]: config });
    await db.$executeRaw(Prisma.sql`
      UPDATE social_connectors
      SET
        safe_metadata = COALESCE(safe_metadata, '{}'::jsonb) || CAST(${patch} AS jsonb),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.connectorId}
        AND workspace_id = ${input.workspaceId}
        AND disabled_at IS NULL
    `);

    await emitTokMetricAudit({
      workspaceId: input.workspaceId,
      actorId: session.userId,
      action: "SOCIAL_NEXTDOOR_ENDPOINT_APPROVED",
      entityType: "SOCIAL_CONNECTOR",
      entityId: input.connectorId,
      correlationId: cid,
      outcome: "APPROVED",
      sourceChannel: "social-publishing-control-plane",
      metadata: {
        connectorId: input.connectorId,
        approvedBy: session.userId,
        approvedAt: config.approvedAt,
      },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        approved: true,
        approvedBy: config.approvedBy,
        approvedAt: config.approvedAt,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
