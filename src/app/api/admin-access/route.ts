import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  AdminAccessConsumptionError,
  consumeAdminAccessToken,
} from "@/lib/admin-access-consumer";
import {
  AdminAccessValidationError,
  validateAdminAccessToken,
} from "@/lib/admin-access-token-validation";

const schema = z
  .object({
    accessToken: z.string().min(32).max(512),
    password: z
      .string()
      .min(16, "Password must be at least 16 characters.")
      .max(256)
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number.")
      .regex(/[^A-Za-z0-9]/, "Include a special character."),
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
    key: "auth:admin-access",
    windowMs: 15 * 60_000,
    max: 5,
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
    const authorization = await validateAdminAccessToken(parsed.data.accessToken);
    if (!authorization.valid || !authorization.requestId) {
      throw new AdminAccessConsumptionError(
        400,
        "INVALID_TOKEN",
        "Invalid or expired setup capability.",
      );
    }

    const result = await consumeAdminAccessToken(
      parsed.data.accessToken,
      parsed.data.password,
      authorization.requestId,
    );

    return json({
      ok: result.ok,
      email: result.email,
      loginPath: result.loginPath,
      message:
        "Administrator password set. The one-time link has been invalidated.",
    });
  } catch (error) {
    if (error instanceof AdminAccessValidationError) {
      const status = [400, 401, 403, 409, 429].includes(error.statusCode)
        ? error.statusCode
        : 503;
      return json(
        {
          error:
            error.code === "INVALID_TOKEN"
              ? "This setup link is invalid or expired."
              : error.message,
          code: error.code,
        },
        status,
      );
    }

    if (error instanceof AdminAccessConsumptionError) {
      const status = [400, 401, 403, 409, 429].includes(error.statusCode)
        ? error.statusCode
        : 503;
      return json(
        {
          error:
            error.code === "INVALID_TOKEN"
              ? "This setup link is invalid or expired."
              : error.message,
          code: error.code,
        },
        status,
      );
    }

    return json({ error: "Administrator setup service unavailable." }, 503);
  }
}
