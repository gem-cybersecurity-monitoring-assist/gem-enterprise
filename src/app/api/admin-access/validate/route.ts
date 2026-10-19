import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  AdminAccessValidationError,
  validateAdminAccessToken,
} from "@/lib/admin-access-token-validation";

// This route is intentionally dynamic and no-store because setup capabilities
// are short-lived and must always be checked against the current database state.
// Keep this endpoint deployed with the password-setup page as one release unit.
const schema = z
  .object({
    accessToken: z.string().min(32).max(512),
  })
  .strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  const { ipAddress } = getRequestContext(request);
  const limit = rateLimit(ipAddress, {
    key: "auth:admin-access-validate",
    windowMs: 15 * 60_000,
    max: 12,
  });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    const result = await validateAdminAccessToken(parsed.data.accessToken);
    return json(result);
  } catch (error) {
    if (error instanceof AdminAccessValidationError) {
      const status = [400, 401, 403, 429].includes(error.statusCode)
        ? error.statusCode
        : 503;
      return json(
        {
          error: error.message,
          code: error.code,
        },
        status,
      );
    }

    return json(
      {
        error: "Administrator authorization validation is unavailable.",
        code: "ADMIN_ACCESS_VALIDATION_UNAVAILABLE",
      },
      503,
    );
  }
}
