import { NextRequest, NextResponse } from "next/server";
import { Prisma, type EntityType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { emitAuditLog } from "@/lib/audit";
import {
  getRequestContext,
  requireSession,
} from "@/lib/api/auth-helpers";
import {
  getLatestVerificationApplication,
  saveVerificationApplication,
  toVerificationApplicationView,
  VerificationServiceError,
} from "@/lib/kyc/service";

const draftSchema = z
  .object({
    entityType: z.enum(["individual", "business", "trust", "family_office"]),
    legalName: z.string().trim().min(2).max(120),
    country: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).optional(),
    organizationName: z.string().trim().max(160).optional(),
    serviceInterest: z.string().trim().min(2).max(240),
    syntheticPilot: z.literal(true).optional(),
  })
  .strict();

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof VerificationServiceError) {
    return json(
      { error: error.message, code: error.code, details: error.details },
      error.statusCode,
    );
  }
  console.error("[verify/applications]", error);
  return json({ error: "Internal server error" }, 500);
}

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const application = await getLatestVerificationApplication(gate.session.userId);
    return json({
      ok: true,
      application: application
        ? toVerificationApplicationView(application)
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  if (
    parsed.data.syntheticPilot &&
    !parsed.data.legalName.toLowerCase().startsWith("gem verify synthetic")
  ) {
    return json(
      {
        error:
          'Synthetic pilot applications must use a legal name beginning with "GEM Verify Synthetic".',
        code: "SYNTHETIC_PILOT_NAMING_REQUIRED",
      },
      400,
    );
  }

  try {
    if (parsed.data.syntheticPilot) {
      const existing = await getLatestVerificationApplication(gate.session.userId);
      const existingState = existing
        ? toVerificationApplicationView(existing).workflowState
        : null;
      if (existingState && existingState !== "closed") {
        return json(
          {
            error:
              "Close the existing verification application before creating a synthetic pilot case.",
            code: "SYNTHETIC_PILOT_REQUIRES_NEW_APPLICATION",
          },
          409,
        );
      }
    }

    const result = await saveVerificationApplication(gate.session.userId, {
      entityType: parsed.data.entityType as EntityType,
      legalName: parsed.data.legalName,
      country: parsed.data.country,
      phone: parsed.data.phone,
      organizationName: parsed.data.organizationName,
      serviceInterest: parsed.data.serviceInterest,
    });
    let application = result.application;

    if (parsed.data.syntheticPilot) {
      if (!result.created) {
        return json(
          {
            error: "Synthetic pilot applications must be created as a new case.",
            code: "SYNTHETIC_PILOT_REQUIRES_NEW_APPLICATION",
          },
          409,
        );
      }

      const markedAt = new Date().toISOString();
      const merged = {
        ...asRecord(result.application.formData),
        _verificationPilot: {
          synthetic: true,
          scenario: "gem-verify-phase-1b",
          version: 1,
          markedAt,
        },
      } as Prisma.InputJsonValue;

      await db.kYCApplication.update({
        where: { id: result.application.id },
        data: { data: merged, formData: merged },
      });
      application =
        (await getLatestVerificationApplication(gate.session.userId)) ??
        result.application;
    }

    const { ipAddress, userAgent } = getRequestContext(request);

    await emitAuditLog({
      userId: gate.session.userId,
      action: result.created ? "case_created" : "admin_action",
      resource: "verification_application",
      resourceId: result.application.id,
      metadata: {
        stage: result.created ? "draft_created" : "applicant_information_updated",
        entityType: parsed.data.entityType,
        syntheticPilot: parsed.data.syntheticPilot === true,
      },
      ipAddress,
      userAgent,
    });

    return json(
      {
        ok: true,
        created: result.created,
        application: toVerificationApplicationView(application),
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
