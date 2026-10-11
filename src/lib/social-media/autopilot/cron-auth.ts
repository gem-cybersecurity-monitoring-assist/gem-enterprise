import crypto from "node:crypto";
import type { SocialEnvSource } from "./policy";

/**
 * Bearer-auth for Vercel cron routes in the Social Autopilot control plane.
 *
 * The configured secret comes from `CONTENT_ORCHESTRATOR_CRON_SECRET` (route
 * specific) falling back to the shared `CRON_SECRET`. Comparison is
 * timing-safe. A missing secret never authorizes: the caller must fail closed.
 */

export function resolveSocialCronSecret(
  env: SocialEnvSource = process.env,
): string | undefined {
  return (
    env.CONTENT_ORCHESTRATOR_CRON_SECRET?.trim() ||
    env.CRON_SECRET?.trim() ||
    undefined
  );
}

export interface CronAuthHeaders {
  headers: { get(name: string): string | null };
}

export function isAuthorizedSocialCronRequest(
  request: CronAuthHeaders,
  env: SocialEnvSource = process.env,
): boolean {
  const configured = resolveSocialCronSecret(env);
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

export function cronSecretMisconfigured(
  env: SocialEnvSource = process.env,
): boolean {
  return !resolveSocialCronSecret(env);
}
