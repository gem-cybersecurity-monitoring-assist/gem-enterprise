import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processSocialPublishingBatch } from "@/lib/social-media/publishing/worker";

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

async function run(request: NextRequest) {
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

  try {
    const result = await processSocialPublishingBatch(10);
    return NextResponse.json(
      {
        ok: true,
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
          message: "The governed publishing worker could not complete this batch.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}


export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
