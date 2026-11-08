/**
 * Truthful read-only state for the Prisma-backed social control plane.
 * Gateway login works in production, but social connector/job persistence has
 * not been migrated to a verified transactional Supabase gateway adapter.
 * Neither state grants publishing permission or certifies a working provider.
 */
import { probeSocialPublishingGatewayAdapter } from "./publishing/gateway-client";

export type SocialBackendState =
  | "BLOCKED_GATEWAY_BACKEND"
  | "DIRECT_DATABASE_UNVERIFIED"
  | "GATEWAY_ADAPTER_VERIFIED";

export function getSocialBackendReadiness(
  gatewaySelected: boolean,
  adapterVerified = false,
) {
  const state: SocialBackendState = gatewaySelected
    ? adapterVerified
      ? "GATEWAY_ADAPTER_VERIFIED"
      : "BLOCKED_GATEWAY_BACKEND"
    : "DIRECT_DATABASE_UNVERIFIED";
  return {
    authenticationBackend: gatewaySelected
      ? ("supabase_gateway" as const)
      : ("prisma" as const),
    state,
    connectorAndQueueBackendVerified: gatewaySelected && adapterVerified,
    livePublishingCertified: false as const,
    externalActionTaken: false as const,
    explanation:
      state === "GATEWAY_ADAPTER_VERIFIED"
        ? "The social publishing gateway adapter is enabled and its health probe passed: the gem_social_* RPCs are deployed and reachable, so connector and queue operations run through the gateway. Live publishing still requires provider authorization, compliance review, approved content and release checks."
        : gatewaySelected
          ? "Social connectors, job queues, and analytics currently use Prisma-backed data paths. The production Supabase gateway has no verified transactional implementation for those operations; configuration alone cannot enable them."
          : "The selected direct database has not been tested by this read-only readiness report. Provider authorization, compliance review, approved content and release checks are still required.",
  };
}

/**
 * Async variant for the readiness route: probes the adapter when the
 * gateway is selected and reports GATEWAY_ADAPTER_VERIFIED only when the
 * probe passes. The synchronous getSocialBackendReadiness stays the
 * conservative default (adapterVerified = false) for synchronous callers
 * such as the settings page, which must never claim verification it has
 * not performed.
 */
export async function getSocialBackendReadinessWithProbe(
  gatewaySelected: boolean,
) {
  const adapterVerified = gatewaySelected
    ? await probeSocialPublishingGatewayAdapter()
    : false;
  return getSocialBackendReadiness(gatewaySelected, adapterVerified);
}
