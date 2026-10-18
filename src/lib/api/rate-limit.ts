/**
 * Best-effort in-memory rate limiter.
 *
 * Caveats:
 * - State lives in the Node process. On Vercel each region/instance has its
 *   own counter, so this is a *soft* limit, not a hard cap. It still raises
 *   the bar against credential-stuffing and contact-form spam at no cost.
 * - For hard guarantees, swap the store implementation for Upstash Redis.
 */

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
}

/**
 * Increment the counter for `id` inside namespace `key` and return whether
 * the caller is still under the limit.
 */
export function rateLimit(id: string, config: RateLimitConfig): RateLimitResult {
  const composite = `${config.key}:${id}`;
  const now = Date.now();
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
export function rateLimitedResponse(retryAfterSeconds: number) {
  return Response.json(
    {
      error: "Too many requests",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
