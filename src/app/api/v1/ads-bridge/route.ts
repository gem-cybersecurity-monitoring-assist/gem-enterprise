import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  compileAdsBridgePlan,
  gemBusinessReviewAdsDraft,
} from "@/lib/ads-bridge/policy";
import {
  AdsBridgeAuthError,
  requireAdsBridgeAuth,
} from "@/lib/ads-bridge/auth";

export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("get_default") }).strict(),
  z.object({ action: z.literal("validate"), draft: z.unknown() }).strict(),
]);

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(status: number, code: string, message: string, issues?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, issues: issues ?? null },
      externalActionTaken: false,
    },
    { status, headers: responseHeaders },
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdsBridgeAuth(request);
    const parsed = requestSchema.parse(await request.json());
    const input = parsed.action === "get_default"
      ? gemBusinessReviewAdsDraft
      : parsed.draft;

    return NextResponse.json(
      {
        ok: true,
        service: "GEM Ads Bridge",
        principal: auth.principal,
        generatedAt: new Date().toISOString(),
        plan: compileAdsBridgePlan(input),
      },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof AdsBridgeAuthError) {
      return errorResponse(error.status, error.code, error.message);
    }
    if (error instanceof ZodError) {
      return errorResponse(
        422,
        "ADS_BRIDGE_POLICY_REJECTED",
        "The request did not satisfy the zero-spend Ads Bridge contract.",
        error.flatten(),
      );
    }
    if (error instanceof SyntaxError) {
      return errorResponse(400, "INVALID_JSON", "A valid JSON body is required.");
    }
    return errorResponse(500, "ADS_BRIDGE_INTERNAL_ERROR", "The Ads Bridge request could not be evaluated.");
  }
}

