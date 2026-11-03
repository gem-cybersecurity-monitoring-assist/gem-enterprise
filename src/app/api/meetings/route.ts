import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import nodemailer from "nodemailer";
import { createZoomMeeting, isZoomConfigured } from "@/lib/zoom";
const ADMIN_ROLES = ["admin", "super_admin", "internal"];
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(session.role);
  const meetings = await db.meetingRequest.findMany({
    where: isAdmin && session.organizationId ? { requester: { organizationId: session.organizationId } } : { OR: [{ requesterId: session.userId }, { hostId: session.userId }, { invitees: { some: { userId: session.userId } } }] },
    orderBy: { proposedAt: "asc" },
    include: { requester: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }, invitees: { select: { id: true, userId: true, email: true, status: true, joinedAt: true, leftAt: true } } },
  });
  return NextResponse.json({ meetings });
}
const CreateSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  proposedAt: z.string().datetime(),
  duration: z.number().int().min(15).max(240).default(30),
  attendeeIds: z.array(z.string().min(1)).min(1).max(100),
});
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) return NextResponse.json({ error: "Only GEM administrators can invite teams." }, { status: 403 });
  if (!session.organizationId) return NextResponse.json({ error: "Your admin account must be assigned to an organization before team invitations can be sent." }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const proposedAt = new Date(parsed.data.proposedAt);
  if (proposedAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Choose a future meeting time." }, { status: 400 });
  const recipients = await db.user.findMany({
    where: { id: { in: [...new Set(parsed.data.attendeeIds)] }, organizationId: session.organizationId, isActive: true, status: "active" },
    select: { id: true, email: true },
  });
  if (recipients.length !== new Set(parsed.data.attendeeIds).size) return NextResponse.json({ error: "One or more selected recipients are not active members of your organization." }, { status: 400 });
  let zoom: Awaited<ReturnType<typeof createZoomMeeting>> = null;
  if (isZoomConfigured()) {
    try { zoom = await createZoomMeeting({ topic: parsed.data.topic, description: parsed.data.description, startTime: proposedAt, duration: parsed.data.duration }); }
    catch (error) { console.error("[meetings] Zoom provisioning failed", error); return NextResponse.json({ error: "Zoom could not create the meeting. No invitations were sent; check the Zoom integration settings." }, { status: 502 }); }
  }
  const meeting = await db.meetingRequest.create({
    data: {
      requesterId: session.userId, hostId: session.userId, topic: parsed.data.topic, description: parsed.data.description,
      proposedAt, duration: parsed.data.duration, status: zoom ? "CONFIRMED" : "REQUESTED",
      meetingUrl: zoom?.join_url ?? null, zoomMeetingId: zoom ? String(zoom.id) : null, zoomJoinUrl: zoom?.join_url ?? null, zoomStartUrl: zoom?.start_url ?? null,
      invitees: { create: recipients.map(recipient => ({ userId: recipient.id, email: recipient.email })) },
    },
    include: { invitees: true },
  });
  let emailSent = false;
  if (process.env.SMTP_HOST && recipients.length) {
    try {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? "noreply@gemcybersecurityassist.com", to: recipients.map(r => r.email).join(","),
        subject: `GEM Meeting Invitation: ${meeting.topic}`,
        text: [`You are invited to a GEM team meeting: ${meeting.topic}`, `When: ${proposedAt.toISOString()} (UTC)`, `Duration: ${meeting.duration} minutes`, parsed.data.description ? `Agenda: ${parsed.data.description}` : "", zoom?.join_url ? `Join Zoom: ${zoom.join_url}` : "The meeting is scheduled in GEM. The Zoom connection is not configured yet; the administrator will share the join link when available."].filter(Boolean).join("\n\n"),
      });
      emailSent = true;
    } catch (error) { console.error("[meetings] invitation email failed", error); }
  }
  return NextResponse.json({ meeting, integration: { zoom: Boolean(zoom), email: emailSent }, message: zoom ? "Zoom meeting created." : "Meeting scheduled in GEM. Connect Zoom to generate a live join link." }, { status: 201 });
}
