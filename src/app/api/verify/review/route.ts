import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emitAuditLog } from "@/lib/audit";
import {
  getRequestContext,
  requireStaff,
} from "@/lib/api/auth-helpers";
import {
  getAllowedReviewActions,
  type VerificationReviewAction,
} from "@/lib/kyc/workflow";
import {
  listVerificationReviewQueue,
  performVerificationReviewAction,
  toVerificationApplicationView,
  VerificationServiceError,
} from "@/lib/kyc/service";

const actionSchema = z
  .object({
    applicationId: z.string().min(1),
    action: z.enum([
      "assign",
      "start_review",
      "request_information",
      "approve",
      "reject",
      "close",
    ]),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

const auditActionByReviewAction = {
  assign: "admin_action",
  start_review: "kyc_flag",
  request_information: "kyc_flag",
  approve: "kyc_approve",
  reject: "kyc_reject",
  close: "case_closed",
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;

  try {
    const applications = await listVerificationReviewQueue(
      gate.session.userId,
      gate.session.role,
    );
    return json({
      ok: true,
      viewerRole: gate.session.role,
      permissions: getAllowedReviewActions(gate.session.role),
      applications: applications.map((application) =>
        toVerificationApplicationView(application, { includeInternal: true }),
      ),
    });
  } catch (error) {
    console.error("[verify/review GET]", error);
    return json({ error: "Internal server error" }, 500);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    const application = await performVerificationReviewAction({
      actorId: gate.session.userId,
      role: gate.session.role,
      applicationId: parsed.data.applicationId,
      action: parsed.data.action as VerificationReviewAction,
      notes: parsed.data.notes,
    });
    const { ipAddress, userAgent } = getRequestContext(request);

    await emitAuditLog({
      userId: gate.session.userId,
      action: auditActionByReviewAction[parsed.data.action],
      resource: "verification_application",
      resourceId: parsed.data.applicationId,
      metadata: {
        reviewAction: parsed.data.action,
        noteProvided: Boolean(parsed.data.notes),
        targetUserId: application.userId,
      },
      ipAddress,
      userAgent,
    });

    return json({
      ok: true,
      application: toVerificationApplicationView(application, {
        includeInternal: true,
      }),
    });
  } catch (error) {
    if (error instanceof VerificationServiceError) {
      return json(
        { error: error.message, code: error.code, details: error.details },
        error.statusCode,
      );
    }
    console.error("[verify/review POST]", error);
    return json({ error: "Internal server error" }, 500);
  }
}
