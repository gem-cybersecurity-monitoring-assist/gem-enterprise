/**
 * POST /api/intake/submit
 *
 * Legacy unified service-enquiry endpoint. Enterprise, Community, and product
 * qualification requests must use their dedicated durable intake APIs.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emitAuditLog } from "@/lib/audit";
import { createEvidenceItem } from "@/lib/evidence";
import { getRequestContext, badRequest, serverError } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";

const intakeSchema = z.object({
  domain: z.enum(["cyber", "financial", "realty", "legal", "general"]),
  serviceType: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(64).optional(),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(10_000),
  urgency: z.enum(["low", "normal", "urgent", "emergency"]).optional(),
  estimatedValue: z.number().nonnegative().max(1e12).optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Consent is required" }),
  }),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "Privacy acceptance is required" }),
  }),
  jurisdiction: z.string().trim().max(120).optional(),
  channelSource: z.enum(["web_form", "chat", "phone", "email"]),
});

type IntakeBody = z.infer<typeof intakeSchema>;
type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskScore {
  level: RiskLevel;
  score: number;
  factors: string[];
}

const separatedServiceTypes = new Set([
  "hub_access_request",
  "enterprise_application",
  "community_application",
  "product_request",
]);

function scoreRisk(body: IntakeBody): RiskScore {
  let score = 0;
  const factors: string[] = [];
  const domainWeights: Record<IntakeBody["domain"], number> = {
    cyber: 20,
    financial: 25,
    legal: 30,
    realty: 15,
    general: 5,
  };

  score += domainWeights[body.domain];
  if (body.domain !== "general") factors.push(`Regulated domain: ${body.domain}`);

  const lowered = body.message.toLowerCase();
  if (
    lowered.includes("social security") ||
    lowered.includes("passport") ||
    lowered.includes("bank account") ||
    lowered.includes("ssn ")
  ) {
    score += 20;
    factors.push("PII indicators in message");
  }

  if (body.urgency === "emergency") {
    score += 25;
    factors.push("Self-reported emergency");
  } else if (body.urgency === "urgent") {
    score += 10;
    factors.push("Self-reported urgent");
  }

  if (body.estimatedValue && body.estimatedValue > 100_000) {
    score += 15;
    factors.push(`High-value transaction: $${body.estimatedValue.toLocaleString("en-US")}`);
  }

  const level: RiskLevel =
    score >= 70 ? "critical" : score >= 45 ? "high" : score >= 20 ? "medium" : "low";
  return { level, score: Math.min(score, 100), factors };
}

export async function POST(req: NextRequest) {
  const requestId = `INT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const { ipAddress, userAgent } = getRequestContext(req);
  const limit = rateLimit(ipAddress, {
    key: "intake:submit",
    windowMs: 60 * 60_000,
    max: 12,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  if (data.serviceType && separatedServiceTypes.has(data.serviceType)) {
    return NextResponse.json(
      {
        error: "This mixed intake path has been retired for the requested workflow.",
        code: "SEPARATED_INTAKE_REQUIRED",
        routes: {
          enterprise: "/enterprise/apply",
          community: "/community/apply",
          product: "/store",
        },
      },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const session = await getSession();
  const auditUserId = session?.userId;

  try {
    const riskScore = scoreRisk(data);
    const requiresEscalation =
      riskScore.level === "critical" ||
      riskScore.level === "high" ||
      data.urgency === "emergency";
    const assignedQueue = requiresEscalation
      ? `escalation:${data.domain}`
      : `standard:${data.domain}`;
    const priority: "low" | "medium" | "high" | "critical" =
      riskScore.level === "critical"
        ? "critical"
        : riskScore.level === "high"
          ? "high"
          : riskScore.level === "medium"
            ? "medium"
            : "low";

    let caseId: string;
    let serviceRequestId: string | null = null;
    if (session) {
      const created = await db.serviceRequest.create({
        data: {
          userId: session.userId,
          type: data.serviceType ?? data.domain,
          subject: data.subject,
          description: `From: ${data.name} <${data.email}>${
            data.phone ? ` (${data.phone})` : ""
          }\nDomain: ${data.domain}\nUrgency: ${data.urgency ?? "normal"}\n\n${data.message}`,
          status: requiresEscalation ? "in_progress" : "open",
          priority,
        },
        select: { id: true },
      });
      serviceRequestId = created.id;
      caseId = `GEM-${created.id.slice(-8).toUpperCase()}`;
    } else {
      caseId = `GEM-${requestId.slice(-8)}`;
    }

    await emitAuditLog({
      userId: session?.userId,
      action: "case_created",
      resource: "service_request",
      resourceId: serviceRequestId ?? requestId,
      metadata: {
        caseId,
        domain: data.domain,
        serviceType: data.serviceType ?? "general",
        urgency: data.urgency ?? "normal",
        riskLevel: riskScore.level,
        riskScore: riskScore.score,
        riskFactors: riskScore.factors,
        requiresEscalation,
        assignedQueue,
        channelSource: data.channelSource,
        authenticated: Boolean(session),
        contactEmail: data.email,
      },
      ipAddress,
      userAgent,
    });

    await createEvidenceItem({
      userId: session?.userId,
      class: "governance",
      action: "intake_consent_receipt",
      data: {
        caseId,
        requestId,
        domain: data.domain,
        consentGiven: data.consentGiven,
        privacyAccepted: data.privacyAccepted,
        jurisdiction: data.jurisdiction ?? "unspecified",
        contactEmail: data.email,
        ipAddress,
        userAgent,
      },
      retentionYears: 7,
    });

    await createEvidenceItem({
      userId: session?.userId,
      class: "interaction",
      action: "intake_submission",
      data: {
        caseId,
        requestId,
        domain: data.domain,
        urgency: data.urgency ?? "normal",
        riskLevel: riskScore.level,
        riskScore: riskScore.score,
        requiresEscalation,
        assignedQueue,
      },
      retentionYears: 5,
    });

    return NextResponse.json(
      {
        ok: true,
        caseId,
        requestId,
        serviceRequestId,
        riskLevel: riskScore.level,
        requiresEscalation,
        assignedQueue,
        message:
          "Your service enquiry has been recorded for human review. This confirmation does not create an approval, price, SLA, or service commitment.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[POST /api/intake/submit]", error);
    await emitAuditLog({
      userId: auditUserId,
      action: "admin_action",
      resource: "intake_submission",
      resourceId: requestId,
      metadata: {
        outcome: "failure",
        error: error instanceof Error ? error.message : String(error),
      },
      ipAddress,
      userAgent,
    }).catch(() => {});
    return serverError(
      "Intake submission failed. Please try again or contact support directly.",
    );
  }
}
