/**
 * Typed client for the social publishing gateway edge function
 * (supabase/functions/gem-social-publishing-gateway).
 *
 * Follows src/lib/supabase-gateway.ts's invokeGateway pattern: one POST to
 * ${baseUrl}/gem-social-publishing-gateway with an action + payload, a 60s
 * timeout, and GatewayRequestError mapping that preserves the RPC's stable
 * code (so SOCIAL_PUBLISHING_CLAIM_LOST etc. survive the hop). The transport
 * (base URL + anon key) is duplicated here because those helpers are
 * module-private in supabase-gateway.ts, which this module leaves untouched.
 *
 * Authentication differs from the other gateway wrappers: the machine secret
 * (SOCIAL_GATEWAY_ADAPTER_SECRET) travels in the Authorization header as a
 * bearer token, and the anon key travels in the `apikey` header. The edge
 * function is deployed with verify_jwt = false (see supabase/config.toml),
 * so the platform does not reject the non-JWT bearer. The secret is never
 * logged and never appears in an error message.
 */
import { GatewayRequestError } from "@/lib/supabase-gateway";

const DEFAULT_GATEWAY_BASE_URL =
  "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1";
const DEFAULT_GATEWAY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsemRqb3FwemJrd3p1YWV4bGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTk1MTQsImV4cCI6MjA5ODg3NTUxNH0.0wfgX_m6SBn_TtD0ZNjkOZ-bk8Frp2Tq1HL9mYFBm4M";
const REQUEST_TIMEOUT_MS = 60_000;
const PROBE_TIMEOUT_MS = 5_000;

/**
 * How many gem_social_* routines the health probe expects. The migration
 * creates 12 phase-1 RPCs plus the health RPC itself, and the connector
 * creation migration adds gem_social_create_connector; a partially applied
 * migration fails the probe.
 */
export const EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT = 14;

export const SOCIAL_PUBLISHING_GATEWAY_ACTIONS = [
  "health",
  "claim_jobs",
  "load_credential",
  "governance_evidence",
  "workspace_locks",
  "pause_state",
  "mark_published",
  "mark_blocked",
  "mark_failed",
  "mark_reauthorization",
  "audit_event",
  "create_job",
  "create_connector",
  "list_jobs",
] as const;

export type SocialPublishingGatewayAction =
  (typeof SOCIAL_PUBLISHING_GATEWAY_ACTIONS)[number];

function gatewayBaseUrl(): string {
  return (
    process.env.GEM_SUPABASE_GATEWAY_BASE_URL?.trim() ||
    DEFAULT_GATEWAY_BASE_URL
  ).replace(/\/$/, "");
}

function gatewayAnonKey(): string {
  return (
    process.env.GEM_SUPABASE_GATEWAY_ANON_KEY?.trim() ||
    DEFAULT_GATEWAY_ANON_KEY
  );
}

function gatewayAdapterSecret(): string {
  const secret = process.env.SOCIAL_GATEWAY_ADAPTER_SECRET?.trim();
  if (!secret) {
    throw new GatewayRequestError(
      503,
      "SOCIAL_GATEWAY_ADAPTER_NOT_CONFIGURED",
      "The social publishing gateway adapter secret is not configured.",
    );
  }
  return secret;
}

interface GatewayErrorBody {
  error?: string;
  code?: string;
}

export async function socialPublishingGateway<T>(
  action: SocialPublishingGatewayAction,
  payload: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const secret = gatewayAdapterSecret();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const key = gatewayAnonKey();
    const response = await fetch(
      `${gatewayBaseUrl()}/gem-social-publishing-gateway`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    const body = (await response.json().catch(() => ({}))) as
      | T
      | GatewayErrorBody;

    if (!response.ok) {
      const errorBody = body as GatewayErrorBody;
      throw new GatewayRequestError(
        response.status,
        errorBody.code || "GATEWAY_REQUEST_FAILED",
        errorBody.error || "Gateway request failed.",
      );
    }

    return body as T;
  } catch (error) {
    if (error instanceof GatewayRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayRequestError(
        504,
        "GATEWAY_TIMEOUT",
        "Social publishing gateway timed out.",
      );
    }
    throw new GatewayRequestError(
      503,
      "GATEWAY_UNAVAILABLE",
      "Social publishing gateway is unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The operator flag that arms the gateway adapter. Off by default; set to
 * "true" in Vercel only after the live verification in the review memo
 * passes. The flag alone lifts nothing — the health probe must pass too.
 */
export function isSocialPublishingGatewayAdapterEnabled(): boolean {
  return process.env.SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED === "true";
}

/**
 * Health probe for the cron gate and the readiness report. Returns true
 * only when the flag is on AND the edge function answers its health action
 * with ok and the full RPC inventory. Fails closed on any doubt: a missing
 * flag, a missing secret, a gateway error, a timeout, or a partial
 * migration all return false. Never throws.
 */
export async function probeSocialPublishingGatewayAdapter(): Promise<boolean> {
  if (!isSocialPublishingGatewayAdapterEnabled()) return false;
  try {
    const result = await socialPublishingGateway<{
      ok: boolean;
      rpcCount?: number;
    }>("health", {}, { timeoutMs: PROBE_TIMEOUT_MS });
    return (
      result.ok === true &&
      typeof result.rpcCount === "number" &&
      result.rpcCount >= EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT
    );
  } catch {
    return false;
  }
}
