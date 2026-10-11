/**
 * Truthful read-only state for the Prisma-backed social control plane.
 * Gateway login works in production, but social connector/job persistence has
 * not been migrated to a verified transactional Supabase gateway adapter.
 * Neither state grants publishing permission or certifies a working provider.
 */
export type SocialBackendState = "BLOCKED_GATEWAY_BACKEND" | "DIRECT_DATABASE_UNVERIFIED";

export function getSocialBackendReadiness(gatewaySelected: boolean) {
  return {
    authenticationBackend: gatewaySelected ? "supabase_gateway" as const : "prisma" as const,
    state: gatewaySelected
      ? "BLOCKED_GATEWAY_BACKEND" as const
      : "DIRECT_DATABASE_UNVERIFIED" as const,
    connectorAndQueueBackendVerified: false as const,
    livePublishingCertified: false as const,
    externalActionTaken: false as const,
    explanation: gatewaySelected
      ? "Social connectors, job queues, and analytics currently use Prisma-backed data paths. The production Supabase gateway has no verified transactional implementation for those operations; configuration alone cannot enable them."
      : "The selected direct database has not been tested by this read-only readiness report. Provider authorization, compliance review, approved content and release checks are still required.",
  };
}
