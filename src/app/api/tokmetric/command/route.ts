import { NextRequest, NextResponse } from "next/server";
import { getGatewaySessionToken } from "@/lib/auth";
import { GatewayRequestError } from "@/lib/supabase-gateway";
import {
  invokeTokMetricCommandGateway,
  type TokMetricCommandOperation,
} from "@/lib/tokmetric/command-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATIONS = new Set<TokMetricCommandOperation>([
  "snapshot",
  "create_draft",
  "create_version",
  "run_review",
  "request_approval",
  "decide_approval",
  "publish_preflight",
]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function requireToken() {
  const token = await getGatewaySessionToken();
  if (!token) {
    throw new GatewayRequestError(
      401,
      "GEM_SESSION_REQUIRED",
      "Authentication required.",
    );
  }
  return token;
}

async function run(
  operation: TokMetricCommandOperation,
  payload: Record<string, unknown> = {},
) {
  try {
    const token = await requireToken();
    const result = await invokeTokMetricCommandGateway(
      token,
      operation,
      payload,
    );
    const created = operation === "create_draft" || operation === "request_approval";
    return json(result, created ? 201 : 200);
  } catch (error) {
    if (error instanceof GatewayRequestError) {
      return json(
        { error: error.message, code: error.code },
        error.statusCode,
      );
    }
    console.error("[tokmetric command route] internal error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return json(
      {
        error: "TokMetric command service is unavailable.",
        code: "TOKMETRIC_COMMAND_UNAVAILABLE",
      },
      503,
    );
  }
}

export async function GET() {
  return run("snapshot");
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      400,
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(
      { error: "TokMetric request is invalid.", code: "INVALID_REQUEST" },
      400,
    );
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.operation !== "string") {
    return json(
      {
        error: "TokMetric command operation is required.",
        code: "INVALID_OPERATION",
      },
      400,
    );
  }
  const operation = payload.operation as TokMetricCommandOperation;
  if (!OPERATIONS.has(operation)) {
    return json(
      {
        error: "TokMetric command operation is invalid.",
        code: "INVALID_OPERATION",
      },
      400,
    );
  }
  const commandPayload = { ...payload };
  delete commandPayload.operation;
  return run(operation, commandPayload);
}
