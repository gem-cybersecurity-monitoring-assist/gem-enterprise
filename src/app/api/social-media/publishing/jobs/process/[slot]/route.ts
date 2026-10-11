import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processSocialPublishingBatch } from "@/lib/social-media/publishing/worker";
import { parseSlotHour } from "@/lib/social-media/publishing/slots";

function authorized(request: NextRequest) {
  const configured = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization")?.trim();
  if (!configured || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

/**
 * Slot worker tick: /api/social-media/publishing/jobs/process/{HH}.
 *
 * The slot parameter is the UTC hour window this tick owns. The worker claims
 * jobs that are due and unscheduled, or scheduled before the end of the slot
 * window (overdue scheduled jobs are recovered by later ticks). Per-provider
 * batch caps and minimum publish spacing are enforced inside the claim as
 * backpressure. CRON_SECRET bearer auth, same as the unslotted route.
 */
async function run(request: NextRequest, slot: string) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CRON_AUTH_NOT_CONFIGURED",
          message: "Publishing worker authentication is not configured.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  if (!authorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Publishing worker authentication failed.",
        },
      },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const slotHour = parseSlotHour(slot);
  if (slotHour === null) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_SLOT",
          message:
            "The slot parameter must be an hour of day between 00 and 23 (e.g. /process/07).",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const result = await processSocialPublishingBatch(10, { slotHour });
    return NextResponse.json(
      {
        ok: true,
        slot: slotHour,
        processed: result.claimed,
        published: result.published,
        retrying: result.retrying,
        blocked: result.blocked,
        failed: result.failed,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SOCIAL_PUBLISHING_WORKER_FAILED",
          message:
            "The governed publishing worker could not complete this slot batch.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot } = await params;
  return run(request, slot);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot } = await params;
  return run(request, slot);
}
