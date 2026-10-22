/**
 * capabilityReadiness.ts
 *
 * Capability readiness model for the GEM Enterprise unified client operating
 * platform (Mandate section 4).
 *
 * Core rule: a route existing must NEVER be presented as a capability being
 * LIVE. Every module surface resolves through `resolveCapabilityState` and
 * displays its true readiness.
 *
 * Pure functions only: no DB, no network, no secrets.
 */

export type CapabilityState =
  | "LIVE"
  | "SURFACE_AVAILABLE"
  | "SETUP_REQUIRED"
  | "PROVIDER_NOT_CONFIGURED"
  | "AUTHORIZATION_REQUIRED"
  | "NOT_ENTITLED"
  | "RESTRICTED"
  | "DEGRADED"
  | "UNAVAILABLE";

export type WorkspaceAccessLevel = "none" | "member" | "owner" | "staff" | "admin";

export interface CapabilityInput {
  routeExists: boolean;
  access: WorkspaceAccessLevel;
  entitled: boolean;
  providerNeeded: boolean;
  providerConfigured: boolean;
  providerHealthy?: boolean | null;
  setupNeeded: boolean;
  setupComplete: boolean;
  backendReady: boolean;
  complianceBlocked: boolean;
  kycRequired: boolean;
  kycSatisfied: boolean;
  restricted: boolean;
  emergencyLock: boolean;
}

export interface CapabilityResolution {
  state: CapabilityState;
  reasons: string[];
}

function resolve(input: CapabilityInput): CapabilityResolution {
  const reason = (r: string): string[] => [r];

  // 1. A route existing must never be presented as LIVE — but a missing route
  //    is simply not available.
  if (!input.routeExists) {
    return { state: "UNAVAILABLE", reasons: reason("route does not exist") };
  }

  // 2. Emergency lock outranks everything else on an existing route.
  if (input.emergencyLock) {
    return { state: "RESTRICTED", reasons: reason("emergency lock engaged") };
  }

  // 3. No workspace access at all.
  if (input.access === "none") {
    return { state: "AUTHORIZATION_REQUIRED", reasons: reason("no workspace access") };
  }

  // 4. Explicitly restricted surface.
  if (input.restricted) {
    return { state: "RESTRICTED", reasons: reason("surface restricted") };
  }

  // 5. Compliance gates.
  if (input.complianceBlocked) {
    return { state: "RESTRICTED", reasons: reason("compliance blocked") };
  }
  if (input.kycRequired && !input.kycSatisfied) {
    return { state: "RESTRICTED", reasons: reason("KYC required but not satisfied") };
  }

  // 6. Entitlement.
  if (!input.entitled) {
    return { state: "NOT_ENTITLED", reasons: reason("not entitled") };
  }

  // 7. Provider configuration.
  if (input.providerNeeded && !input.providerConfigured) {
    return {
      state: "PROVIDER_NOT_CONFIGURED",
      reasons: reason("provider needed but not configured"),
    };
  }

  // 8. Setup completion.
  if (input.setupNeeded && !input.setupComplete) {
    return { state: "SETUP_REQUIRED", reasons: reason("setup needed but not complete") };
  }

  // 9. Configured provider reported unhealthy — still usable, but degraded.
  if (input.providerNeeded && input.providerConfigured && input.providerHealthy === false) {
    return {
      state: "DEGRADED",
      reasons: reason("provider configured but unhealthy"),
    };
  }

  // 10. Route exists and gates pass, but backend not ready — the surface
  //     (e.g. navigation link) may be shown, the capability itself is not live.
  if (!input.backendReady) {
    return { state: "SURFACE_AVAILABLE", reasons: reason("backend not ready") };
  }

  // 11. All gates pass.
  return { state: "LIVE", reasons: reason("all readiness gates passed") };
}

export function resolveCapabilityState(input: CapabilityInput): CapabilityResolution {
  return resolve(input);
}

const STATE_LABELS: Record<CapabilityState, string> = {
  LIVE: "Live",
  SURFACE_AVAILABLE: "Surface available",
  SETUP_REQUIRED: "Setup required",
  PROVIDER_NOT_CONFIGURED: "Provider not configured",
  AUTHORIZATION_REQUIRED: "Authorization required",
  NOT_ENTITLED: "Not entitled",
  RESTRICTED: "Restricted",
  DEGRADED: "Degraded",
  UNAVAILABLE: "Unavailable",
};

export function capabilityStateLabel(state: CapabilityState): string {
  return STATE_LABELS[state];
}

const STATE_TONES: Record<CapabilityState, "emerald" | "cyan" | "amber" | "rose" | "violet" | "slate"> = {
  LIVE: "emerald",
  SURFACE_AVAILABLE: "cyan",
  SETUP_REQUIRED: "amber",
  PROVIDER_NOT_CONFIGURED: "amber",
  AUTHORIZATION_REQUIRED: "violet",
  NOT_ENTITLED: "slate",
  RESTRICTED: "rose",
  DEGRADED: "amber",
  UNAVAILABLE: "slate",
};

export function capabilityStateTone(
  state: CapabilityState,
): "emerald" | "cyan" | "amber" | "rose" | "violet" | "slate" {
  return STATE_TONES[state];
}

export function isCapabilityUsable(state: CapabilityState): boolean {
  return state === "LIVE" || state === "DEGRADED";
}
