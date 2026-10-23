import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhook } from "@/lib/github-app";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verification = verifyGitHubWebhook({
    rawBody,
    signature: request.headers.get("x-hub-signature-256"),
    deliveryId: request.headers.get("x-github-delivery"),
    event: request.headers.get("x-github-event"),
  });

  if ("error" in verification) {
    return NextResponse.json(
      {
        accepted: false,
        error: verification.error,
        externalActionTaken: false,
      },
      { status: verification.status },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        accepted: false,
        error: "Malformed GitHub webhook JSON.",
        externalActionTaken: false,
      },
      { status: 400 },
    );
  }

  const repository =
    typeof payload === "object" && payload !== null && "repository" in payload
      ? (payload as { repository?: { full_name?: unknown } }).repository
          ?.full_name
      : undefined;

  if (repository && repository !== "support371/gem-enterprise") {
    return NextResponse.json(
      {
        accepted: false,
        error: "Webhook repository is not authorized.",
        externalActionTaken: false,
      },
      { status: 403 },
    );
  }

  console.info("[github-app] verified webhook received", {
    deliveryId: verification.deliveryId,
    event: verification.event,
    repository: repository ?? null,
  });

  return NextResponse.json(
    {
      accepted: true,
      deliveryId: verification.deliveryId,
      event: verification.event,
      repository: repository ?? null,
      processingMode: "verified_read_only",
      externalActionTaken: false,
    },
    { status: 202 },
  );
}
