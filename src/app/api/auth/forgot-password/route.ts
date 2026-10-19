import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { emitAuditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { isMailDeliveryConfigured, sendMail } from "@/lib/mail/send";
import { createPasswordResetToken } from "@/lib/passwordReset";

const DEFAULT_APP_URL = "https://www.gemcybersecurityassist.com";
const COMMAND_CENTER_RECOVERY_URL = "https://admin.gemcybersecurityassist.com";
const MIN_RECOVERY_RESPONSE_MS = process.env.NODE_ENV === "test" ? 0 : 2_000;

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
});

const EMAIL_REQUESTED_RESPONSE = {
  success: true,
  delivery: "requested",
  message:
    "If an active GEM Enterprise account exists for that email, a secure reset link has been requested. Check the inbox and spam folder.",
};

const RATE_LIMIT_SAFE_RESPONSE = {
  success: true,
  delivery: "rate_limited",
  message:
    "If email delivery is active and an account is eligible, a secure reset link will be sent. Please wait before requesting another link.",
};

const EMAIL_NOT_CONFIGURED_RESPONSE = {
  success: false,
  delivery: "not_configured",
  error:
    "No reset email was sent because canonical email delivery is not active. Platform owners can recover access securely through Command Center Settings.",
  recoveryUrl: COMMAND_CENTER_RECOVERY_URL,
};

function emailBucket(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;
  const parsed = new URL(configured);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    parsed.hostname !== "www.gemcybersecurityassist.com"
  ) {
    throw new Error("Password recovery must use the canonical GEM domain in production.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function waitForMinimumRecoveryDuration(startedAt: number) {
  const remaining = MIN_RECOVERY_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestContext(request);
  const ipLimit = rateLimit(ipAddress, {
    key: "auth:forgot-password:ip",
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!ipLimit.ok) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const addressLimit = rateLimit(emailBucket(email), {
    key: "auth:forgot-password:email",
    windowMs: 60 * 60_000,
    max: 3,
  });
  if (!addressLimit.ok) {
    return NextResponse.json(RATE_LIMIT_SAFE_RESPONSE, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!isMailDeliveryConfigured()) {
    return NextResponse.json(EMAIL_NOT_CONFIGURED_RESPONSE, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const responseStartedAt = Date.now();
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
      status: true,
    },
  });

  let delivery = "not_applicable";
  if (user?.isActive && user.status === "active") {
    try {
      const token = await createPasswordResetToken({
        userId: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
      });
      const resetUrl = new URL("/reset-password", appBaseUrl());
      resetUrl.hash = new URLSearchParams({ token }).toString();
      const result = await sendMail({
        to: user.email,
        subject: "Reset your GEM Enterprise password",
        text: `A password reset was requested for your GEM Enterprise account. Open this canonical GEM link within 15 minutes: ${resetUrl.toString()}\n\nIf you did not request this, ignore this message.`,
        html: `<p>A password reset was requested for your GEM Enterprise account.</p><p><a href="${resetUrl.toString()}">Reset your password</a>. This canonical GEM link expires in 15 minutes.</p><p>If you did not request this, ignore this message.</p>`,
      });
      delivery = result.sent
        ? "sent"
        : "reason" in result
          ? result.reason
          : "skipped";
    } catch (error) {
      delivery = "failed";
      console.error("[auth] canonical password reset email delivery failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  await emitAuditLog({
    userId: user?.id,
    action: "password_change",
    resource: "auth",
    resourceId: user?.id,
    metadata: {
      flow: "forgot_password_request",
      accountEligible: Boolean(user?.isActive && user.status === "active"),
      delivery,
      canonicalOrigin: DEFAULT_APP_URL,
      gatewayRecoveryDisabled: true,
      responseTimingFloorMs: MIN_RECOVERY_RESPONSE_MS,
    },
    ipAddress,
    userAgent,
  });

  await waitForMinimumRecoveryDuration(responseStartedAt);
  return NextResponse.json(EMAIL_REQUESTED_RESPONSE, {
    headers: { "Cache-Control": "no-store" },
  });
}
