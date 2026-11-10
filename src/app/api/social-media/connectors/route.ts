import { requireSocialConnectorSession, requireSocialConnectorWorkspace } from "@/lib/social-media/connector-authority";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  parseJson,
  requirePermission,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import {
  disconnectSocialConnector,
  listSocialConnectors,
} from "@/lib/social-media/oauth/connectors";
import { createSocialBotTokenConnector } from "@/lib/social-media/oauth/store";
import { getPausedSocialProviders } from "@/lib/social-media/oauth/provider-pause";
import { readLiveProbeSignal } from "@/lib/social-media/oauth/probes";

const disconnectSchema = z.object({
  workspaceId: z.string().trim().min(1),
  connectorId: z.string().trim().min(1),
});

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(
      403,
      "CROSS_ORIGIN_REQUEST_BLOCKED",
      "Connector credential changes require a same-origin request.",
    );
  }
}

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const session = await requireSocialConnectorSession(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "workspaceId is required", correlationId: cid },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    await requireSocialConnectorWorkspace(workspaceId, session);
    const connectors = await listSocialConnectors(workspaceId);
    const pausedProviders = await getPausedSocialProviders(workspaceId);
    const paused = new Set(pausedProviders);
    const enriched = connectors.map((connector) => ({
      ...connector,
      providerPaused: paused.has(connector.provider),
      liveProbe: readLiveProbeSignal(connector.safeMetadata),
    }));
    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        connectors: enriched,
        pausedProviders,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}

const createConnectorSchema = z.object({
  workspaceId: z.string().trim().min(1),
  provider: z.literal("TELEGRAM"),
  telegramChatId: z.string().trim().min(1),
  botToken: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
  telegramPublicChannel: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireSameOrigin(request);
    const session = await requireSocialConnectorSession(request);
    const parsed = await parseJson(request, createConnectorSchema);
    const membership = await requireSocialConnectorWorkspace(parsed.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(parsed.workspaceId, "connector");
    const telegramChatId = parsed.telegramChatId;
    const safeMetadata: Record<string, unknown> = { telegramChatId };
    if (parsed.telegramPublicChannel) {
      safeMetadata.telegramPublicChannel = parsed.telegramPublicChannel;
    }
    // The bot token travels as an encrypted credential; the chat id is
    // safe metadata. The token and the secretRef never leave this server
    // and never appear in the response — the returned connector record
    // carries no secret fields by construction.
    const connector = await createSocialBotTokenConnector({
      workspaceId: parsed.workspaceId,
      provider: "TELEGRAM",
      displayName: parsed.displayName ?? "Telegram",
      credential: {
        provider: "TELEGRAM",
        accessToken: parsed.botToken,
        grantedScopes: [],
        externalAccountId: telegramChatId,
      },
      safeMetadata,
    });
    await emitTokMetricAudit({
      workspaceId: parsed.workspaceId,
      actorId: session.userId,
      action: "social.connector.authorized",
      entityType: "connector",
      entityId: connector.id,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        provider: "TELEGRAM",
        telegramChatId,
        externalPublishingEnabled: false,
      },
    });
    const pausedProviders = await getPausedSocialProviders(parsed.workspaceId);
    const enriched = {
      ...connector,
      providerPaused: new Set(pausedProviders).has(connector.provider),
      liveProbe: readLiveProbeSignal(connector.safeMetadata),
    };
    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        connector: enriched,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}

export async function DELETE(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireSameOrigin(request);
    const session = await requireSocialConnectorSession(request);
    const parsed = await parseJson(request, disconnectSchema);
    const body = {
      workspaceId: parsed.workspaceId!,
      connectorId: parsed.connectorId!,
    };
    const membership = await requireSocialConnectorWorkspace(body.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(body.workspaceId, "connector");
    const result = await disconnectSocialConnector(body);
    await emitTokMetricAudit({
      workspaceId: body.workspaceId,
      actorId: session.userId,
      action: "social.connector.disconnected",
      entityType: "connector",
      entityId: body.connectorId,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        credentialDeleted: true,
        externalRevocationAttempted: result.externalRevocationAttempted,
        externalRevocationOutcome: result.externalRevocationOutcome,
        externalRevocationAt: result.externalRevocationAt,
        externalRevocationError: result.externalRevocationError || null,
        externalPublishingEnabled: false,
      },
    });
    return NextResponse.json(
      { ok: true, correlationId: cid, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
