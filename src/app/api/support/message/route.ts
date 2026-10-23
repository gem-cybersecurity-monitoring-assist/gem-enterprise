import { NextRequest, NextResponse } from "next/server";
import { getGatewaySessionToken, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emitAuditLog } from "@/lib/audit";
import { supportSessionStoreFor } from "@/lib/support/support-session-store";
import { generateSupportResponse } from "@/lib/support/generate-response";
import { escalateSession } from "@/lib/support/escalate-session";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { GatewayRequestError, workspaceGateway } from "@/lib/supabase-gateway";
import {
  assertSafeSupportInput,
  requireSameOriginSupportRequest,
  SupportSecurityError,
} from "@/lib/support/security";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string().min(1).max(128),
  aiRunId: z.string().min(1).max(128).optional(),
  message: z.string().trim().min(1).max(2000),
});

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_WINDOW_MESSAGES = 12;

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginSupportRequest(request);
  } catch (error) {
    if (error instanceof SupportSecurityError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    throw error;
  }

  const auth = await getSession();
  if (!auth) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid request" }, 400);
  }

  const { sessionId, aiRunId, message } = parsed.data;
  try {
    assertSafeSupportInput(message);
  } catch (error) {
    if (error instanceof SupportSecurityError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    throw error;
  }
  try {
    const supportStore = await supportSessionStoreFor(auth);
    const session = await supportStore.getSession(sessionId);

    if (!session || session.userId !== auth.userId) {
      return json({ error: "Session not found" }, 404);
    }

    if (!session.consentAccepted) {
      return json({ error: "Consent required" }, 403);
    }

    if (
      session.status === "closed" ||
      session.status === "escalated" ||
      session.status === "ticket_created"
    ) {
      return json({ error: "This session is no longer accepting AI messages." }, 409);
    }

    const rateWindowStart = Date.now() - RATE_WINDOW_MS;
    const recentUserMessages = session.messages.filter(
      (entry) =>
        entry.role === "user" &&
        Number.isFinite(Date.parse(entry.timestamp)) &&
        Date.parse(entry.timestamp) >= rateWindowStart,
    ).length;
    if (recentUserMessages >= RATE_WINDOW_MESSAGES) {
      return json(
        { error: "Please pause briefly before sending another support message.", code: "SUPPORT_RATE_LIMITED" },
        429,
        { "Retry-After": "300" },
      );
    }

    const policy = evaluatePolicy(message);

    if (aiRunId) {
      if (auth.authSource === "supabase_gateway") {
        const token = await getGatewaySessionToken();
        if (!token) return json({ error: "Gateway session required" }, 401);
        await workspaceGateway("ai_message_event", token, {
          sessionId: aiRunId,
          messageLength: message.length,
          restricted: policy.shouldEscalate,
        });
      } else {
        const consent = await db.consentRecord.findFirst({
          where: { aiRunId, userId: auth.userId },
          select: { id: true },
        });
        if (!consent) return json({ error: "AI session not found" }, 404);
      }
    }

    const result = await generateSupportResponse(sessionId, message, supportStore);
    if (!result) {
      return json({ error: "Session not found" }, 404);
    }

    let handoff: Awaited<ReturnType<typeof escalateSession>> = null;
    if (result.orchestration.shouldEscalate) {
      handoff = await escalateSession(
        sessionId,
        result.orchestration.escalationReason ?? "policy_triggered",
        supportStore,
        auth.email,
      );
    }

    if (aiRunId && auth.authSource !== "supabase_gateway") {
      await db.aiRun.update({
        where: { id: aiRunId },
        data: {
          messageCount: { increment: 1 },
          escalationTriggered: result.orchestration.shouldEscalate,
          escalationReason: result.orchestration.escalationReason,
          outputStatus: result.orchestration.shouldEscalate ? "escalated" : "responded",
        },
      });
    }

    if (auth.authSource !== "supabase_gateway") {
      await emitAuditLog({
        action: result.orchestration.shouldEscalate ? "restricted_class_detected" : "ai_message_sent",
        resource: "support_session",
        resourceId: sessionId,
        metadata: {
          messageLength: message.length,
          responseSource: result.orchestration.responseSource,
          providerStatus: result.orchestration.providerStatus,
          handoffChannel: handoff?.handoffChannel,
        },
      });
    }

    return json({
      messageId: result.assistantMessage.id,
      reply: result.orchestration.reply,
      action: result.orchestration.action,
      shouldEscalate: result.orchestration.shouldEscalate,
      queue: result.orchestration.queue,
      knowledgeLinks: result.orchestration.knowledgeLinks ?? [],
      suggestedReplies: result.orchestration.suggestedReplies ?? [],
      responseSource: result.orchestration.responseSource,
      providerStatus: result.orchestration.providerStatus,
      handoff: handoff
        ? {
            success: handoff.success,
            queue: handoff.queue,
            channel: handoff.handoffChannel,
            ticketId: handoff.ticketId,
            externalIssueKey: handoff.atlassianIssueKey,
          }
        : null,
    });
  } catch (err) {
    console.error("[support/message]", err);
    if (err instanceof GatewayRequestError) {
      return json({ error: err.message, code: err.code }, err.statusCode);
    }
    return json({ error: "Failed to process message" }, 500);
  }
}
