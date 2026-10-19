import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export class AdsBridgeAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function timingSafeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAdsBridgeAuth(request: NextRequest) {
  const configured = process.env.ADS_BRIDGE_AUTH_TOKEN?.trim();
  if (!configured || configured.length < 32) {
    throw new AdsBridgeAuthError(
      503,
      "ADS_BRIDGE_AUTH_NOT_CONFIGURED",
      "Ads Bridge server-to-server authentication is not configured.",
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token || !timingSafeEqual(token, configured)) {
    throw new AdsBridgeAuthError(
      401,
      "ADS_BRIDGE_AUTH_INVALID",
      "A valid Ads Bridge bearer token is required.",
    );
  }

  return { principal: "gem-ads-bridge-client", mode: "server_to_server" as const };
}

