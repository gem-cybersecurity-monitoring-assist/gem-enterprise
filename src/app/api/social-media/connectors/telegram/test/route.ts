import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  correlationId,
  emitTokMetricAudit,
  enforceEmergencyLocks,
  parseJson,
  requireActiveTokMetricSession,
  requirePermission,
  requireWorkspaceAccess,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";
import { loadPublishingConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
import { sendTelegramTestMessage } from "@/lib/social-media/providers/telegram/connector";
import { resolveTelegramDestination } from "@/lib/social-media/providers/telegram/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testSchema = z.object({
  workspaceId: z.string().trim().min(1),
  connectorId: z.string().trim().min(1),
});

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new TokMetricError(403, "CROSS_ORIGIN_REQUEST_BLOCKED", "Connector tests require a same-origin request.");
  }
}

/** Sends a labelled test message through a stored Telegram connector. */
export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  try {
    requireSameOrigin(request);
    const session = await requireActiveTokMetricSession(request);
    const parsed = await parseJson(request, testSchema);
    // parseJson has validated both fields; narrow the inferred optional types.
    const body = { workspaceId: parsed.workspaceId!, connectorId: parsed.connectorId! };
    const membership = await requireWorkspaceAccess(body.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(body.workspaceId, "connector");

    const loaded = await loadPublishingConnectorCredential(body);
    if (loaded.connector.provider !== "TELEGRAM") {
      throw new TokMetricError(400, "TELEGRAM_CONNECTOR_REQUIRED", "This test is only for Telegram connectors.");
    }
    const destination = resolveTelegramDestination(loaded.connector.safeMetadata);
    if (!destination) {
      throw new TokMetricError(409, "TELEGRAM_DESTINATION_MISSING", "This connector has no channel configured. Connect it again.");
    }
    const { messageId } = await sendTelegramTestMessage({
      botToken: loaded.credential.accessToken,
      chatId: destination.chatId,
    });

    await emitTokMetricAudit({
      workspaceId: body.workspaceId,
      actorId: session.userId,
      action: "social.connector.telegram_tested",
      entityType: "connector",
      entityId: body.connectorId,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: { chatId: destination.chatId, messageId },
    });

    return NextResponse.json({ ok: true, correlationId: cid, messageId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
