import { GatewayRequestError } from "@/lib/supabase-gateway";
import { EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT, socialPublishingGateway } from "./gateway-client";

const ORIGINAL_FUNCTION_BASE = "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1";

export type GatewayDiagnostic = {
  state: "HEALTHY" | "SETUP_REQUIRED" | "AUTHENTICATION_FAILED" | "INCOMPLETE_RPC_INVENTORY" | "UNAVAILABLE";
  code: string;
  message: string;
  checkedAt: string;
  rpcCount: number | null;
  expectedRpcCount: number;
  adapterEnabled: boolean;
  livePublishingEnabled: boolean;
  publishingPermissionChanged: false;
};

// Owner diagnostic only: no caller-controlled action, URL, payload or credential.
// This does not replace or relax probeSocialPublishingGatewayAdapter's flag gate.
export async function diagnoseSocialPublishingGateway(): Promise<GatewayDiagnostic> {
  const result = (state: GatewayDiagnostic["state"], code: string, message: string, rpcCount: number | null = null): GatewayDiagnostic => ({
    state, code, message, rpcCount, checkedAt: new Date().toISOString(),
    expectedRpcCount: EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT,
    adapterEnabled: process.env.SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED === "true",
    livePublishingEnabled: process.env.SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED === "true",
    publishingPermissionChanged: false,
  });
  const base = (process.env.GEM_SUPABASE_GATEWAY_BASE_URL?.trim() || ORIGINAL_FUNCTION_BASE).replace(/\/$/, "");
  if (base !== ORIGINAL_FUNCTION_BASE) {
    return result("SETUP_REQUIRED", "GATEWAY_TARGET_MISMATCH", "The gateway target does not match the original GEM Supabase project. Review server configuration.");
  }
  try {
    const health = await socialPublishingGateway<unknown>("health", {}, { timeoutMs: 5_000 });
    if (!health || typeof health !== "object" || Array.isArray(health)) {
      return result("UNAVAILABLE", "GATEWAY_INVALID_HEALTH_RESPONSE", "The gateway did not return a valid health response.");
    }
    const value = health as { ok?: unknown; rpcCount?: unknown };
    const count = typeof value.rpcCount === "number" && Number.isSafeInteger(value.rpcCount) && value.rpcCount >= 0 ? value.rpcCount : null;
    if (value.ok !== true || count === null) {
      return result("UNAVAILABLE", "GATEWAY_INVALID_HEALTH_RESPONSE", "The gateway did not return a valid health response.");
    }
    if (count < EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT) {
      return result("INCOMPLETE_RPC_INVENTORY", "GATEWAY_RPC_INVENTORY_INCOMPLETE", "The gateway is reachable but its required publishing database functions are incomplete.", count);
    }
    return result("HEALTHY", "GATEWAY_HEALTH_VERIFIED", "Gateway authentication passed and the required database function inventory is present. Publishing controls are unchanged.", count);
  } catch (error) {
    if (error instanceof GatewayRequestError) {
      if (error.code === "SOCIAL_GATEWAY_ADAPTER_NOT_CONFIGURED") {
        return result("SETUP_REQUIRED", "VERCEL_ADAPTER_SECRET_MISSING", "The Vercel runtime is missing SOCIAL_GATEWAY_ADAPTER_SECRET. Set the matching value in the approved server secret stores.");
      }
      if (error.code === "SOCIAL_PUBLISHING_GATEWAY_NOT_CONFIGURED") {
        return result("SETUP_REQUIRED", "SUPABASE_GATEWAY_CONFIGURATION_MISSING", "The Supabase function requires administrator setup. Install the matching adapter secret in the original project.");
      }
      if (error.statusCode === 401 || error.statusCode === 403) {
        return result("AUTHENTICATION_FAILED", "GATEWAY_AUTHENTICATION_FAILED", "The gateway rejected runtime authentication. Confirm the shared secret matches in Vercel Production and Supabase.");
      }
      if (error.code === "SOCIAL_PUBLISHING_STORE_NOT_PROVISIONED") {
        return result("INCOMPLETE_RPC_INVENTORY", "GATEWAY_RPC_INVENTORY_INCOMPLETE", "The gateway reports missing publishing database functions. Review the approved migration inventory.");
      }
    }
    return result("UNAVAILABLE", "GATEWAY_HEALTH_UNAVAILABLE", "The gateway health check could not complete. Review the service status and try again.");
  }
}
