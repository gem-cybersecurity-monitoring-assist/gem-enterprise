import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitAuditLog } from "@/lib/audit";
import { getRequestContext, badRequest } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { sendMail } from "@/lib/mail/send";
import {
  NEWSLETTER_CONSENT_VERSION,
  NEWSLETTER_SOURCE,
  buildNewsletterConfirmationUrl,
  createNewsletterToken,
  hashNewsletterIp,
  hashNewsletterToken,
  newsletterSubscribeSchema,
} from "@/lib/newsletter/subscription";

type SubscriberRow = {
  id: string;
  status: "pending" | "active" | "unsubscribed";
};

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestContext(req);
  const limit = rateLimit(ipAddress, {
    key: "newsletter:subscribe",
    windowMs: 60 * 60_000,
    max: 5,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = newsletterSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "Validation failed",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { email, consent, website } = parsed.data;

  // Honeypot submissions receive a generic success without persistence.
  if (website?.trim()) {
    return NextResponse.json(
      { ok: true, state: "confirmation_required" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!consent) return badRequest("Consent is required");

  const confirmationToken = createNewsletterToken();
  const unsubscribeToken = createNewsletterToken();
  const confirmationTokenHash = hashNewsletterToken(confirmationToken);
  const unsubscribeTokenHash = hashNewsletterToken(unsubscribeToken);
  const ipHash = hashNewsletterIp(ipAddress);

  try {
    const rows = await db.$queryRaw<SubscriberRow[]>`
      INSERT INTO "newsletter_subscribers" (
        "email",
        "status",
        "source",
        "consent_text_version",
        "consent_at",
        "confirmation_token_hash",
        "unsubscribe_token_hash",
        "ip_hash",
        "user_agent"
      ) VALUES (
        ${email},
        'pending',
        ${NEWSLETTER_SOURCE},
        ${NEWSLETTER_CONSENT_VERSION},
        NOW(),
        ${confirmationTokenHash},
        ${unsubscribeTokenHash},
        ${ipHash},
        ${userAgent}
      )
      ON CONFLICT ("email") DO UPDATE SET
        "source" = EXCLUDED."source",
        "consent_text_version" = EXCLUDED."consent_text_version",
        "consent_at" = EXCLUDED."consent_at",
        "ip_hash" = EXCLUDED."ip_hash",
        "user_agent" = EXCLUDED."user_agent",
        "updated_at" = NOW(),
        "status" = CASE
          WHEN "newsletter_subscribers"."status" = 'active' THEN 'active'
          ELSE 'pending'
        END,
        "confirmation_token_hash" = CASE
          WHEN "newsletter_subscribers"."status" = 'active' THEN NULL
          ELSE EXCLUDED."confirmation_token_hash"
        END,
        "unsubscribe_token_hash" = CASE
          WHEN "newsletter_subscribers"."status" = 'active'
            THEN "newsletter_subscribers"."unsubscribe_token_hash"
          ELSE EXCLUDED."unsubscribe_token_hash"
        END,
        "unsubscribed_at" = CASE
          WHEN "newsletter_subscribers"."status" = 'active'
            THEN "newsletter_subscribers"."unsubscribed_at"
          ELSE NULL
        END
      RETURNING "id", "status"
    `;

    const subscriber = rows[0];
    if (!subscriber) {
      throw new Error("Newsletter subscriber record was not returned");
    }

    if (subscriber.status === "active") {
      return NextResponse.json(
        { ok: true, state: "already_subscribed" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const confirmationUrl = buildNewsletterConfirmationUrl(confirmationToken);
    const delivery = await sendMail({
      to: email,
      subject: "Confirm your GEM Security Intelligence Updates subscription",
      text: [
        "Confirm your subscription to GEM Security Intelligence Updates.",
        "",
        confirmationUrl,
        "",
        "You will not be added to the active mailing list until you confirm.",
        "GEM does not use purchased or scraped mailing lists.",
        "",
        "Privacy: https://www.gemcybersecurityassist.com/privacy",
      ].join("\n"),
      html: `<p>Confirm your subscription to <strong>GEM Security Intelligence Updates</strong>.</p><p><a href="${confirmationUrl}">Confirm subscription</a></p><p>You will not be added to the active mailing list until you confirm. GEM does not use purchased or scraped mailing lists.</p><p><a href="https://www.gemcybersecurityassist.com/privacy">Privacy Policy</a></p>`,
    });

    await emitAuditLog({
      action: "admin_action",
      resource: "newsletter_subscription",
      resourceId: subscriber.id,
      metadata: {
        consentVersion: NEWSLETTER_CONSENT_VERSION,
        delivery: delivery.sent ? "sent" : "skipped",
        source: NEWSLETTER_SOURCE,
        state: "pending_confirmation",
      },
      ipAddress,
      userAgent,
    });

    if (!delivery.sent) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Confirmation email delivery is not available. Please try again later.",
          code: "NEWSLETTER_CONFIRMATION_EMAIL_UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, state: "confirmation_required" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[newsletter] subscription failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Your subscription request could not be stored. Please try again later.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
