import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (payload?.event === "endpoint.url_validation") {
    if (!secret) return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
    const plainToken = payload?.payload?.plainToken;
    if (typeof plainToken !== "string") return NextResponse.json({ error: "Missing validation token" }, { status: 400 });
    return NextResponse.json({ plainToken, encryptedToken: createHmac("sha256", secret).update(plainToken).digest("hex") });
  }
  const timestamp = req.headers.get("x-zm-request-timestamp") ?? "";
  const signature = req.headers.get("x-zm-signature") ?? "";
  if (!secret || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return NextResponse.json({ error: "Webhook authentication failed" }, { status: 401 });
  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const event = payload?.event;
  const meetingId = String(payload?.payload?.object?.id ?? "");
  const participant = payload?.payload?.object?.participant ?? {};
  if (!meetingId || !["meeting.participant_joined", "meeting.participant_left"].includes(event)) return NextResponse.json({ received: true });
  const email = typeof participant.email === "string" ? participant.email.toLowerCase() : "";
  const participantId = String(participant.id ?? "");
  if (email) {
    const invitee = await db.meetingInvitee.findFirst({ where: { email, meeting: { zoomMeetingId: meetingId } } });
    if (invitee) {
      const joined = event === "meeting.participant_joined";
      await db.meetingInvitee.update({ where: { id: invitee.id }, data: { status: joined ? "JOINED" : "LEFT", zoomParticipantId: participantId || invitee.zoomParticipantId, joinedAt: joined ? new Date() : invitee.joinedAt, leftAt: joined ? null : new Date() } });
    }
  }
  return NextResponse.json({ received: true });
}
