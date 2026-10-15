import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emitAuditLog } from "@/lib/audit";
import { getRequestContext, badRequest } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { submitContactGateway } from "@/lib/contact-gateway";
import { sendMail } from "@/lib/mail/send";
import {
  GatewayRequestError,
  shouldUseSupabaseGateway,
} from "@/lib/supabase-gateway";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5_000),
  subject: z.string().trim().max(200).optional(),
  website: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestContext(req);

  const limit = rateLimit(ipAddress, {
    key: "contact:submit",
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "Validation failed",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { name, email, message, subject, website } = parsed.data;

  // Honeypot submissions receive a generic success response but are not stored.
  if (website && website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const normalizedSubject = subject?.trim() || `Contact from ${name}`;

  if (shouldUseSupabaseGateway()) {
    try {
      const result = await submitContactGateway({
        name,
        email,
        message,
        subject: normalizedSubject,
        website,
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        {
          ok: true,
          submissionId: result.submissionId ?? null,
          ticketId: result.ticketId ?? null,
          persistence: result.persistence ?? "supabase_gateway",
          notificationDelivery: result.notificationDelivery ?? "not_configured",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (error instanceof GatewayRequestError) {
        const status = [400, 429].includes(error.statusCode)
          ? error.statusCode
          : 503;
        return NextResponse.json(
          {
            ok: false,
            error:
              status === 429
                ? "Too many contact requests. Please try again later."
                : "Your message could not be stored. Please use the published support email.",
            code: error.code,
          },
          { status, headers: { "Cache-Control": "no-store" } },
        );
      }
      console.error("[contact] gateway persistence unavailable", error);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your message could not be stored. Please use the published support email.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const session = await getSession();
  const baseNotes = [
    "Website contact enquiry",
    `From: ${name} <${email}>`,
    `Authenticated: ${session ? `yes (${session.email})` : "no"}`,
    "",
    message,
  ].join("\n");

  try {
    // Persist every genuine public enquiry before reporting success. SupportBooking
    // is intentionally used here because it accepts unauthenticated contacts and is
    // already part of the production schema. Email is only a notification channel;
    // it is not the system of record.
    const submission = await db.supportBooking.create({
      data: {
        userId: session?.userId,
        name,
        email,
        subject: normalizedSubject,
        status: "pending",
        notes: `${baseNotes}\n\nNotification delivery: pending`,
      },
      select: { id: true },
    });

    let ticketId: string | null = null;
    if (session) {
      try {
        const ticket = await db.supportTicket.create({
          data: {
            userId: session.userId,
            subject: normalizedSubject,
            description: `From: ${name} <${email}>\n\n${message}`,
            status: "open",
            priority: "medium",
          },
          select: { id: true },
        });
        ticketId = ticket.id;
      } catch (error) {
        console.error(
          "[contact] failed to create authenticated support ticket",
          error,
        );
      }
    }

    let delivery = "not_configured";
    const recipient =
      process.env.ADMIN_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      process.env.GEM_OWNER_EMAIL;

    if (recipient) {
      try {
        const result = await sendMail({
          to: recipient,
          replyTo: email,
          subject: `[GEM Contact] ${normalizedSubject}`,
          text: `Submission ID: ${submission.id}\nName: ${name}\nEmail: ${email}\nAuth: ${session ? `yes (${session.email})` : "no"}\nIP: ${ipAddress}\n\n${message}`,
        });
        delivery = result.sent
          ? "sent"
          : "reason" in result
            ? result.reason
            : "skipped";
      } catch (error) {
        delivery = "failed";
        console.error("[contact] failed to send notification email", error);
      }
    }

    try {
      await db.supportBooking.update({
        where: { id: submission.id },
        data: {
          notes: `${baseNotes}\n\nNotification delivery: ${delivery}`,
        },
      });
    } catch (error) {
      console.error("[contact] failed to record notification status", error);
    }

    await emitAuditLog({
      userId: session?.userId,
      action: "admin_action",
      resource: "contact_message",
      resourceId: submission.id,
      metadata: {
        authenticated: Boolean(session),
        email,
        name,
        subject: normalizedSubject,
        submissionId: submission.id,
        ticketId,
        notificationDelivery: delivery,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      ticketId,
    });
  } catch (error) {
    console.error("[contact] failed to persist public enquiry", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Your message could not be stored. Please use the published support email.",
      },
      { status: 503 },
    );
  }
}
