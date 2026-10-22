import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api/auth-helpers";
import {
  compileAdsBridgePlan,
  gemBusinessReviewAdsDraft,
} from "@/lib/ads-bridge/policy";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json(
    {
      service: "GEM Ads Bridge",
      generatedAt: new Date().toISOString(),
      plan: compileAdsBridgePlan(gemBusinessReviewAdsDraft),
    },
    { status: 200, headers: responseHeaders },
  );
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", externalActionTaken: false },
      { status: 400, headers: responseHeaders },
    );
  }

  try {
    return NextResponse.json(
      {
        service: "GEM Ads Bridge",
        generatedAt: new Date().toISOString(),
        plan: compileAdsBridgePlan(input),
      },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "ADS_BRIDGE_POLICY_REJECTED",
          issues: error.flatten().fieldErrors,
          externalActionTaken: false,
        },
        { status: 422, headers: responseHeaders },
      );
    }
    throw error;
  }
}

