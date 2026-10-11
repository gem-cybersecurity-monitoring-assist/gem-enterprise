/**
 * Best-effort in-memory rate limiter.
 *
 * Caveats:
 * - State lives in the Node process. On Vercel each region/instance has its
 *   own counter, so this is a *soft* limit, not a hard cap. It still raises
 *   the bar against credential-stuffing and contact-form spam at no cost.
 * - For hard guarantees, swap the store implementation for Upstash Redis.
 */

import { createHash } from "node:crypto";

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  // We use var here to ensure the bucket storage persists across hot reloads
  // in development and remains a singleton instance in production.
  var __gem_rate_limit_buckets: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> =
  globalThis.__gem_rate_limit_buckets ?? new Map<string, Bucket>();
if (!globalThis.__gem_rate_limit_buckets) {
  globalThis.__gem_rate_limit_buckets = buckets;
}

export interface RateLimitConfig {
  /** Bucket namespace, e.g. "auth:login" */
  key: string;
  /** Window length in milliseconds */
  windowMs: number;
  /** Maximum requests allowed inside the window */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  unavailable?: boolean;
}

/**
 * Increment the counter for `id` inside namespace `key` and return whether
 * the caller is still under the limit.
 */
export async function rateLimit(id: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const endpoint = process.env.GEM_RATE_LIMIT_REDIS_URL?.trim();
  const token = process.env.GEM_RATE_LIMIT_REDIS_TOKEN?.trim();
  const required = process.env.GEM_RATE_LIMIT_SHARED_REQUIRED === "true";
  if (endpoint || token || required) {
    try {
      if (!endpoint || !token) throw new Error("Shared limiter is not configured");
      const url = new URL(endpoint);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid limiter endpoint");
      const key = `gem:rate:${createHash("sha256").update(`${config.key}:${id}`).digest("hex")}`;
      const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}";
      const response = await fetch(url, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(3000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["EVAL", script, "1", key, String(config.windowMs)]),
      });
      if (!response.ok) throw new Error("Shared limiter unavailable");
      const body = await response.json();
      const [count, ttl] = Array.isArray(body.result) ? body.result : [];
      if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(ttl) || ttl < 0) throw new Error("Invalid shared limiter response");
      return { ok: count <= config.max, remaining: Math.max(0, config.max - count), resetAt: Date.now() + ttl,
        retryAfterSeconds: count <= config.max ? 0 : Math.max(1, Math.ceil(ttl / 1000)) };
    } catch {
      // A configured or required shared limiter must never silently fall back.
      return { ok: false, remaining: 0, resetAt: Date.now() + 60_000, retryAfterSeconds: 60, unavailable: true };
    }
  }
  const composite = `${config.key}:${id}`;
  const now = Date.now();
  // Keep fallback development state bounded rather than retaining expired keys.
  if (buckets.size >= 10_000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size >= 10_000 && !buckets.has(composite)) {
      return { ok: false, remaining: 0, resetAt: now + 60_000, retryAfterSeconds: 60, unavailable: true };
    }
  }
  const existing = buckets.get(composite);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + config.windowMs };
    buckets.set(composite, bucket);
    return {
      ok: true,
      remaining: Math.max(0, config.max - 1),
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, config.max - existing.count);
  const ok = existing.count <= config.max;
  const retryAfterSeconds = ok ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return { ok, remaining, resetAt: existing.resetAt, retryAfterSeconds };
}

/**
 * Quick helper that builds a 429 response with the standard Retry-After header.
 */
export function rateLimitedResponse(retryAfterSeconds: number, unavailable = false) {
  return Response.json(
    {
      error: unavailable ? "Request protection is temporarily unavailable" : "Too many requests",
      retryAfterSeconds,
    },
    {
      status: unavailable ? 503 : 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
