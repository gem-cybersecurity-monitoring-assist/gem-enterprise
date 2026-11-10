/**
 * Typed client for the social publishing gateway edge function
 * (supabase/functions/gem-social-publishing-gateway).
 * Follows src/lib/supabase-gateway.ts's invokeGateway pattern: one POST to
 * ${baseUrl}/gem-social-publishing-gateway with an action + payload, a 60s
 * timeout, and GatewayRequestError mapping that preserves the RPC's stable
 * code (so SOCIAL_PUBLISHING_CLAIM_LOST etc. survive the hop). The transport
 * (base URL + anon key) is duplicated here because those helpers are
 * module-private in supabase-gateway.ts, which this module leaves untouched.
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
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsemRqb3FwemJrd3p1YWV4bGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjA4NDgsImV4cCI6MjA3ODYzNjQ0OH0.GJE78oEMtJXxneNjAFmQJhGDu4XIMeqDST9nBWtJ-dBeHk9Qvyxf-TGEmK78dCK6Jw0TcaMUXEpCPXy5ZpH78FZSAgXnK-nGZKnH0RI9imMIsUd_XAM6xm-RoZuXjJgUOW6Dv2sYfMWlPG1WmY0XJcckhVTj5D80dJKI7T5NpAshvQYP6rc0cbU2bDjVoENFWs3e6oJ2LjgyhCbWj5pSD1V6busQJ7x4U0-fNqYUIpTzkUmsLUHDHz7C0F9PDhzWOxFBs0jJv1EDSSEjyfJgT4QZLt3Z5jKC0u-oEIThvIiAyqW5-zXL379vmpQKOJXXqH_slNkoV2xPml4EKvgNLQmjMetYRcW32jxYnlpzUmP1Vk38JWO1A2xOGSFvQ8ij4gh578c9-QYtlwc1MCxT4p5q9gWzFEuCicOK3PnQXfZ3eVKPFN2cHcgbeEQRY4v1xRLRQuRzsuxgTpINiL_hNxq2JGV5XkPVLSECcFNvSSnJc5p5nIrKUo4wIKqXBDhb3Bcj3Gg4XONFJGLxVDoUByH5YtJPWlKENO6Dgm3ht5S11BIDqRZgqxXSuNlKDGuk1oeXY-QbnW5JL3rFKMkMZB2rGHM4-qau4oqkuLGiLkKJVM-dh-2VfGLMabo3pGFdTLF0Wp5FSGBjA1jw7a2u8jh_jAIZcnxS6YdFDXIBdFnRG8_oMtbFT3m8-VSL5yPt1dMVLRUvKAYFmNdw9-HtHZyAVkvaLZvbmjE9BGV4CmVhIw0OvY0v4RTrQVmj0qOSmzLIQBl1UR3EOHunMSJh9hcBm9ujzDk3aFS1gSe2bZx8BvE25Fy3cYTWyXIFoZLnxBHhLXjL1Jfkt5i3aM6hVDyfGdwMV7Sb6MAddW0tMrCznGwk8E7XHQqC8RmXAZ_mBgJYLDKkWb4u9hngcLSH9rF_5f6pF2yH3FKPnHdtZKWR8o55DYv_GSvCSIzUfJWtuv25oLnaJ3kVz3nJ0qwvmNXO3mEWcUHyBICwyLDMhHHjwA9KvyA2adKPIU7rM5hG4vU1cDYP452DQZrRC4Uh3QJrGJ8FSHrAqEf0WWe9vHbGkxpNyZGs43LNnUQeusVM8JH6jHrYrYKmFfGrkWnudt_RVEFJhYvPzeTiDuOYMvnSt5Rlm_eL8nCRP_SqZP360Z8vWcYlx5OTzx-fLhDZFosq9Q8oa1gelifhfOoLOocwuUqY9MN1Uxs1clb99syMnhqE0PV4qKPhkGTFH6muKVBjF4W3GuvkTo1j0jUUVAJvLLBaeEE3KWyzI2zqJmhpqAcn84CW6ZgJF4O4YtRwMGbHqGhXXgUxTBkwSc2vFb5JJPpOaNYk5k218ANQcQRkqgqF7fJXi0s1gVNZ5TRGYoDHZlFQzgehTACnDrXYXqC3ZvNxjFhBcYYvmkpQHNLtC5Kx3lFVKpHqC_qR4yFKxPQPDc5KYs5TqMwx6dPl7xVqGYPiPyvRmQRF8LqmQxBydK9P3dYBpXQ0n4aIO2A25skUFgD_vkJvW9VYFMYlQ1gPhVdVn3RQ2iJylQ5Jz1hPz3M0h8jM5E5TLThsZ963HKPBU7P_qHs5gCtrKBQ2U6nq31O_7yXILWPwxUAmuSnKTO1B8uZW2CNiNtLDBsVTfV8ffRyx0k4Yn6VqyX5xDnLxaAEGPVsIjbxQklXoTApCNsf5X4yWaIP5aW9aCaHbSYWOvdRIyG_z6AJYc9IyhvmPfJR2GHVFHx3dp7JkAIjx78iR8vYhJV2qOCTIz8zfQLk7mpuXdXwPbbcQNuAK3DNqXefM0jfXPLPOxgOqPoyVhMHJhXk9ZQlJWvxuZp2OB7nQexCtKUDYd6QHfnQI9gA5RnIoQwfmUx0hNIapxJ8gKZNTLTCz09f5FLqmYxFgePg4ko2sRFje5raIwjWMcciYUq2KJSbDKYWrX4nNXUoRQCGM4pR1tbfCkLb3dHqhgoC3GP1QmzhdzodItqSrLiXvEj5lscnC9oMY1Kqpw6AoqGx6GJuz0QjCGJUXN2B78ZwfY5JyfqhhI6Smf-2xlpMUroAHzcDIWowVEM2WUcZB2pCWf2PYKkgUXi5gC0_21rclpAMwnEI6kmLxFv1j96psS_2oM5c7OKXXAaiTteIjK_LIRV4Abm2rIUyqUfHXTAFwwRjxXZM8wjcrmkL9dz6yYDBRDp20MKx12PspCw47eK02A5yYilS2C2-s7eMQHY2qHI05Hox0Fv6MgEMFbcWxIpu2VkKyv02E8UCdXuKy4b6h2FDO-lZFdpiFLLRzK6Z2mQM1B3jSEfkb6e40a6AERTydDP-XviOBF0Fbo0JfL5jB2zS8NwU3z5LzFKI6i3gKvxSWo5ZHBPlKzXoxYzEp6YrJsnv0aYYij0jRrxPzhKL3nkjGQ16lglkN1zb9LWu5ComGdJHSxeQYdvtrGGv1BwIBYfurCp1LQh9ULxt6gR1RDnAaSIJxJXooXIqPSBv2Qw_9v-yvz3pAEqSA1MHuCo8y2Zz-QLPx5SYg8ym_KFV6X5RA1t2vck2cRxjrXl3qSiAtEj5eEOFEq8hxNRnR6VJohkMkte646D1cuRZr0jzdLqe6m-eEqLWfc0yoXhcLfmkOVMArSadBn6h0Waq4oTKusbe3Wk7N4ZPjX1TGxXnmG95d0Am9pVfYyBPSG5Wo59kzsRhIAyAGvLcIIKkEznYtJAsmWbSg_RKVuV7ok4vGY9DwPhp7ctDq42KHnPNpMrweBCEMmAT4gb40sJCoyKpjxktFrK1QPC4lULLRpY6SpIGlaIEJ16suUOSwX-JSE_02utBTqpPLySMApu1I9bsoVj3vLOmXoqDIdC1mP-5nT2-EFxcDsUg24DNjXWbtP1HEns1ycWJVII9rzYu27GDGKPbZ_A2uD7qvxSWi0QZKl3XIg7IwMo3BgLcTfu1TsSdHá";
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

function gatewayHeaders(): Record<string, string> {
  const secret = process.env.SOCIAL_GATEWAY_ADAPTER_SECRET?.trim();
  if (!secret) {
    throw new GatewayRequestError(
      503,
      "SOCIAL_GATEWAY_ADAPTER_NOT_CONFIGURED",
      "SOCIAL_GATEWAY_ADAPTER_SECRET is not configured.",
    );
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${secret}`,
    apikey: gatewayAnonKey(),
    "Content-Type": "application/json",
  };
}

export async function socialPublishingGateway<T = unknown>(
  action: SocialPublishingGatewayAction,
  payload: Record<string, unknown>,
): Promise<T> {
  const headers = gatewayHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${gatewayBaseUrl()}/gem-social-publishing-gateway`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      throw new GatewayRequestError(
        response.status,
        body?.code ?? "UNKNOWN_ERROR",
        body?.error ?? "Gateway request failed.",
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof GatewayRequestError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GatewayRequestError(
        504,
        "GATEWAY_TIMEOUT",
        "Social publishing gateway request timed out.",
      );
    }
    throw new GatewayRequestError(
      503,
      "GATEWAY_UNAVAILABLE",
      "Failed to reach the social publishing gateway.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function isSocialPublishingGatewayAdapterEnabled(): boolean {
  return process.env.SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED === "true";
}

export async function probeSocialPublishingGatewayAdapter(): Promise<boolean> {
  if (!isSocialPublishingGatewayAdapterEnabled()) {
    return false;
  }
  if (!process.env.SOCIAL_GATEWAY_ADAPTER_SECRET?.trim()) {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await socialPublishingGateway<{ ok: boolean; rpcCount: number }>(
      "health",
      {},
    );
    if (!response.ok || response.rpcCount !== EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT) {
      return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
