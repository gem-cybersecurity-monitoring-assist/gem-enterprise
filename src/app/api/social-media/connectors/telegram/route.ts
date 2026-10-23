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
import {
  sendTelegramTestMessage,
  upsertTelegramConnector,
  verifyTelegramDestination,
} from "@/lib/social-media/providers/telegram/connector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const connectSchema = z.object({
  workspaceId: z.string().trim().min(1),
  botToken: z.string().trim().min(1).max(200),
  chatId: z.string().trim().min(1).max(200),
  sendTestMessage: z.boolean().optional().default(true),
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

/**
 * Connects a Telegram channel: verifies the bot token and the bot's posting
 * rights with the Bot API, stores the token encrypted, and optionally sends a
 * labelled test message. The bot token is never echoed back.
 */
export async function POST(request: NextRequest) {
  const cid = correlationId(request);
  let workspaceId: string | undefined;
  let actorId: string | undefined;
  try {
    requireSameOrigin(request);
    const session = await requireActiveTokMetricSession(request);
    actorId = session.userId;
    const parsed = await parseJson(request, connectSchema);
    // parseJson has validated every field; narrow the inferred optional types.
    const body = {
      workspaceId: parsed.workspaceId!,
      botToken: parsed.botToken!,
      chatId: parsed.chatId!,
      sendTestMessage: parsed.sendTestMessage ?? true,
    };
    workspaceId = body.workspaceId;
    const membership = await requireWorkspaceAccess(body.workspaceId, session);
    requirePermission(membership, "manage", "connectors");
    await enforceEmergencyLocks(body.workspaceId, "connector");

    const destination = await verifyTelegramDestination({ botToken: body.botToken, chatId: body.chatId });
    const connector = await upsertTelegramConnector({
      workspaceId: body.workspaceId,
      botToken: body.botToken,
      destination,
    });

    let testMessageId: number | null = null;
    if (body.sendTestMessage) {
      testMessageId = (await sendTelegramTestMessage({ botToken: body.botToken, chatId: destination.chatId })).messageId;
    }

    await emitTokMetricAudit({
      workspaceId: body.workspaceId,
      actorId: session.userId,
      action: "social.connector.telegram_connected",
      entityType: "connector",
      entityId: connector.id,
      correlationId: cid,
      outcome: "success",
      sourceChannel: "website",
      metadata: {
        chatId: destination.chatId,
        chatType: destination.chatType,
        botUsername: destination.botUsername,
        testMessageSent: testMessageId !== null,
        externalPublishingEnabled: false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        correlationId: cid,
        connector: {
          id: connector.id,
          displayName: connector.displayName,
          externalAccountId: connector.externalAccountId,
          chatType: destination.chatType,
          botUsername: destination.botUsername,
        },
        testMessageId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (workspaceId && actorId) {
      await emitTokMetricAudit({
        workspaceId,
        actorId,
        action: "social.connector.telegram_connect_failed",
        entityType: "connector",
        entityId: "telegram",
        correlationId: cid,
        outcome: "failure",
        sourceChannel: "website",
        metadata: { code: error instanceof TokMetricError ? error.code : "UNEXPECTED" },
      }).catch(() => undefined);
    }
    return tokMetricErrorResponse(error, cid);
  }
}
