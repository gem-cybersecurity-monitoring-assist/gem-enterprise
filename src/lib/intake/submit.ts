import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ZodTypeAny } from "zod";
import { getSession } from "@/lib/auth";
import { emitAuditLog } from "@/lib/audit";
import { createEvidenceItem } from "@/lib/evidence";
import { getRequestContext } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  createIntakeSubmission,
  IntakeStoreUnavailableError,
} from "@/lib/intake/repository";
import { queueForKind, type IntakeKind } from "@/lib/intake/types";
import { getStoreProduct } from "@/lib/storeCatalog";

const CONSENT_VERSION = "public-intake-consent-2026-07-13";
const PRIVACY_VERSION = "privacy-policy-2026-09-13";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function privacyHash(value: string | null): string | null {
  const secret = process.env.INTAKE_HASH_SECRET;
  if (!secret || !value) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

function routeLimit(kind: IntakeKind) {
  if (kind === "ENTERPRISE") return 5;
  if (kind === "COMMUNITY") return 4;
  return 8;
}

export async function handlePublicIntake(
  request: NextRequest,
  options: { kind: IntakeKind; schema: ZodTypeAny },
) {
  const { ipAddress, userAgent } = getRequestContext(request);
  const limit = rateLimit(ipAddress, {
    key: `intake:${options.kind.toLowerCase()}`,
    windowMs: 60 * 60_000,
    max: routeLimit(options.kind),
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = options.schema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        fields: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const data = parsed.data as Record<string, unknown> & {
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    title?: string;
    jurisdiction: string;
    subject: string;
    message: string;
    consentGiven: true;
    privacyAccepted: true;
    honeypot?: string;
    startedAt: number;
    productSlug?: string;
    productName?: string;
    productSku?: string;
    productCategory?: string;
  };

  const elapsed = Date.now() - data.startedAt;
  if (data.honeypot || elapsed < 1_200 || elapsed > 24 * 60 * 60_000) {
    return json({ error: "Submission could not be accepted." }, 400);
  }

  const canonicalProduct =
    options.kind === "PRODUCT_REQUEST" && data.productSlug
      ? getStoreProduct(data.productSlug)
      : undefined;
  if (options.kind === "PRODUCT_REQUEST" && !canonicalProduct) {
    return json(
      {
        error: "The requested catalogue item is not available for qualification.",
        code: "INVALID_PRODUCT_REFERENCE",
      },
      400,
    );
  }

  const session = await getSession();
  const {
    name,
    email,
    phone,
    organization,
    title,
    jurisdiction,
    subject,
    message,
    consentGiven: _consentGiven,
    privacyAccepted: _privacyAccepted,
    honeypot: _honeypot,
    startedAt: _startedAt,
    productSlug: _productSlug,
    productName: _productName,
    productSku: _productSku,
    productCategory: _productCategory,
    ...payload
  } = data;

  try {
    const submission = await createIntakeSubmission({
      kind: options.kind,
      queue: queueForKind(options.kind),
      userId: session?.userId ?? null,
      product:
        options.kind === "PRODUCT_REQUEST" && canonicalProduct
          ? {
              slug: canonicalProduct.slug,
              name: canonicalProduct.name,
              category: canonicalProduct.category,
            }
          : null,
      name,
      email,
      phone,
      organization,
      title,
      jurisdiction,
      subject,
      message,
      payload,
      consentVersion: CONSENT_VERSION,
      privacyVersion: PRIVACY_VERSION,
      source: "web",
      ipHash: privacyHash(ipAddress),
      userAgentHash: privacyHash(userAgent),
    });

    const evidenceResults = await Promise.allSettled([
      emitAuditLog({
        userId: session?.userId,
        action: "case_created",
        resource: "intake_submission",
        resourceId: submission.id,
        metadata: {
          publicId: submission.publicId,
          kind: submission.kind,
          queue: submission.queue,
          status: submission.status,
          authenticated: Boolean(session),
          productSlug: submission.productSlug,
        },
        ipAddress,
        userAgent,
      }),
      createEvidenceItem({
        userId: session?.userId,
        class: "governance",
        action: "public_intake_consent_receipt",
        data: {
          publicId: submission.publicId,
          kind: submission.kind,
          consentVersion: CONSENT_VERSION,
          privacyVersion: PRIVACY_VERSION,
          consentGiven: true,
          privacyAccepted: true,
          jurisdiction,
          contactEmail: email,
        },
        retentionYears: 7,
      }),
    ]);

    for (const [index, result] of evidenceResults.entries()) {
      if (result.status === "rejected") {
        console.error(
          `[POST public intake ${options.kind}] post-commit evidence ${index} failed`,
          result.reason,
        );
      }
    }

    return json(
      {
        ok: true,
        reference: submission.publicId,
        kind: submission.kind,
        status: submission.status,
        message:
          "Your request has been recorded for human review. This confirmation does not create an account, contract, approval, entitlement, price, or service commitment.",
      },
      201,
    );
  } catch (error) {
    if (error instanceof IntakeStoreUnavailableError) {
      return json(
        {
          error: "The durable intake service is not active yet.",
          code: "INTAKE_STORAGE_NOT_READY",
        },
        503,
      );
    }

    console.error(`[POST public intake ${options.kind}]`, error);
    return json({ error: "The request could not be recorded. Please try again later." }, 500);
  }
}
