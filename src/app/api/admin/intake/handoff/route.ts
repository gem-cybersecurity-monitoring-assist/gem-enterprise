import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { getIntakeSubmission } from "@/lib/intake/repository";
import { handoffEnterpriseInquiry } from "@/lib/enterpriseInquiryHandoff";
import { db } from "@/lib/db";
import { hasDirectDatabaseConfiguration } from "@/lib/supabase-gateway";
const input = z.object({ id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/), confirmation: z.literal("CAPTURE_INQUIRY_FOR_REVIEW") }).strict();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Cross-site request rejected" }, 403);
  const key = process.env.GEM_ENTERPRISE_INQUIRY_HMAC_KEY || "";
  const sitesToken = process.env.GEM_LEAD_SITES_SERVICE_TOKEN || "";
  if (key.length < 32 || !sitesToken || !hasDirectDatabaseConfiguration()) return json({ error: "Inquiry handoff is not configured", code: "HANDOFF_NOT_CONFIGURED" }, 503);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 2_000) return json({ error: "Request too large" }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = input.safeParse(body);
  if (!parsed.success) return json({ error: "Select an inquiry and confirm review capture" }, 400);
  try {
    const stored = await getIntakeSubmission(parsed.data.id);
    if (!stored) return json({ error: "Inquiry not found" }, 404);
    await db.auditLog.create({ data: { userId: gate.session.userId, action: "admin_action", resource: "intake", resourceId: stored.submission.id, metadata: { event: "intake.lead_handoff_requested", requestKey: `enterprise-inquiry-${stored.submission.id}`, scope: "capture_for_review" } } });
    const receipt = await handoffEnterpriseInquiry(stored.submission, { key, sitesToken });
    await db.auditLog.create({ data: { userId: gate.session.userId, action: "admin_action", resource: "intake", resourceId: stored.submission.id,
      metadata: { event: "intake.lead_handoff", leadId: receipt.leadId, requestKey: receipt.requestKey, replayed: receipt.replayed, status: receipt.status, scope: "capture_for_review" } } });
    return json({ captured: true, receipt });
  } catch (error) {
    const code = error instanceof Error && ["INQUIRY_NOT_ELIGIBLE", "HANDOFF_REQUIRES_REVIEW"].includes(error.message) ? error.message : "HANDOFF_UNAVAILABLE";
    return json({ error: "The handoff could not be verified. Retry the same inquiry safely or review its consent and existing contact record.", code }, code === "INQUIRY_NOT_ELIGIBLE" ? 422 : code === "HANDOFF_REQUIRES_REVIEW" ? 409 : 503);
  }
}
