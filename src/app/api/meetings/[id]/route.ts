import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import nodemailer from "nodemailer";

const UpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
  meetingUrl: z.string().url().optional(),
});

const ADMIN_ROLES = ["admin", "super_admin", "internal"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const meeting = await db.meetingRequest.findUnique({
    where: { id },
    include: { requester: { select: { email: true, organizationId: true } } },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(session.role);
  const isHost = meeting.hostId === session.userId;
  const isRequester = meeting.requesterId === session.userId;
  const isInMeetingOrganization =
    Boolean(session.organizationId) &&
    meeting.requester.organizationId === session.organizationId;

  if (isAdmin && !isInMeetingOrganization) {
    return NextResponse.json({ error: "Meeting is outside your organization." }, { status: 403 });
  }
  if (!isAdmin && !isHost && !isRequester) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.status !== "CANCELLED" && !isAdmin && !isHost) {
    return NextResponse.json(
      { error: "Only the host or an administrator can change the meeting status." },
      { status: 403 },
    );
  }

  const updated = await db.meetingRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.meetingUrl ? { meetingUrl: parsed.data.meetingUrl } : {}),
    },
  });

  if (parsed.data.status === "CONFIRMED" && process.env.SMTP_HOST && meeting.requester.email) {
    try {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? "noreply@gemcybersecurityassist.com",
        to: meeting.requester.email,
        subject: `Meeting Confirmed: ${meeting.topic}`,
        text: `Your meeting "${meeting.topic}" has been confirmed for ${new Date(meeting.proposedAt).toISOString()}.${parsed.data.meetingUrl ? `\n\nJoin link: ${parsed.data.meetingUrl}` : ""}`,
      });
    } catch (error) {
      console.error("[meetings] confirmation email failed", error);
    }
  }

  return NextResponse.json({ meeting: updated });
}
