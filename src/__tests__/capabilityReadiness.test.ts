import { describe, expect, it } from "vitest";
import {
  capabilityStateLabel,
  capabilityStateTone,
  isCapabilityUsable,
  resolveCapabilityState,
  type CapabilityInput,
  type CapabilityState,
} from "@/lib/capabilityReadiness";

function input(overrides: Partial<CapabilityInput> = {}): CapabilityInput {
  // Baseline: a fully ready capability. Tests override individual gates.
  return {
    routeExists: true,
    access: "member",
    entitled: true,
    providerNeeded: false,
    providerConfigured: false,
    providerHealthy: null,
    setupNeeded: false,
    setupComplete: false,
    backendReady: true,
    complianceBlocked: false,
    kycRequired: false,
    kycSatisfied: false,
    restricted: false,
    emergencyLock: false,
    ...overrides,
  };
}

describe("resolveCapabilityState", () => {
  it("resolves LIVE when every gate passes", () => {
    const result = resolveCapabilityState(input());
    expect(result.state).toBe("LIVE");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("resolves LIVE with a configured, healthy provider", () => {
    const result = resolveCapabilityState(
      input({ providerNeeded: true, providerConfigured: true, providerHealthy: true }),
    );
    expect(result.state).toBe("LIVE");
  });

  it("resolves UNAVAILABLE when the route does not exist", () => {
    const result = resolveCapabilityState(input({ routeExists: false }));
    expect(result.state).toBe("UNAVAILABLE");
  });

  it("missing route beats every other condition", () => {
    const result = resolveCapabilityState(
      input({
        routeExists: false,
        emergencyLock: true,
        access: "none",
        entitled: false,
        providerNeeded: true,
        setupNeeded: true,
        backendReady: false,
        complianceBlocked: true,
        restricted: true,
      }),
    );
    expect(result.state).toBe("UNAVAILABLE");
  });

  it("resolves RESTRICTED on emergency lock", () => {
    const result = resolveCapabilityState(input({ emergencyLock: true }));
    expect(result.state).toBe("RESTRICTED");
  });

  it("emergency lock beats NOT_ENTITLED", () => {
    const result = resolveCapabilityState(input({ emergencyLock: true, entitled: false }));
    expect(result.state).toBe("RESTRICTED");
  });

  it("resolves AUTHORIZATION_REQUIRED when access is none", () => {
    const result = resolveCapabilityState(input({ access: "none" }));
    expect(result.state).toBe("AUTHORIZATION_REQUIRED");
  });

  it("AUTHORIZATION_REQUIRED beats PROVIDER_NOT_CONFIGURED", () => {
    const result = resolveCapabilityState(
      input({ access: "none", providerNeeded: true, providerConfigured: false }),
    );
    expect(result.state).toBe("AUTHORIZATION_REQUIRED");
  });

  it("AUTHORIZATION_REQUIRED beats NOT_ENTITLED", () => {
    const result = resolveCapabilityState(input({ access: "none", entitled: false }));
    expect(result.state).toBe("AUTHORIZATION_REQUIRED");
  });

  it("resolves RESTRICTED on the restricted flag", () => {
    const result = resolveCapabilityState(input({ restricted: true }));
    expect(result.state).toBe("RESTRICTED");
  });

  it("restricted beats NOT_ENTITLED", () => {
    const result = resolveCapabilityState(input({ restricted: true, entitled: false }));
    expect(result.state).toBe("RESTRICTED");
  });

  it("resolves RESTRICTED when compliance blocked", () => {
    const result = resolveCapabilityState(input({ complianceBlocked: true }));
    expect(result.state).toBe("RESTRICTED");
  });

  it("resolves RESTRICTED when KYC is required but not satisfied", () => {
    const result = resolveCapabilityState(
      input({ kycRequired: true, kycSatisfied: false }),
    );
    expect(result.state).toBe("RESTRICTED");
  });

  it("KYC restriction does not fire when KYC is not required", () => {
    const result = resolveCapabilityState(
      input({ kycRequired: false, kycSatisfied: false }),
    );
    expect(result.state).toBe("LIVE");
  });

  it("KYC restriction does not fire when KYC is satisfied", () => {
    const result = resolveCapabilityState(
      input({ kycRequired: true, kycSatisfied: true }),
    );
    expect(result.state).toBe("LIVE");
  });

  it("compliance blocked beats SETUP_REQUIRED", () => {
    const result = resolveCapabilityState(
      input({ complianceBlocked: true, setupNeeded: true, setupComplete: false }),
    );
    expect(result.state).toBe("RESTRICTED");
  });

  it("resolves NOT_ENTITLED when not entitled", () => {
    const result = resolveCapabilityState(input({ entitled: false }));
    expect(result.state).toBe("NOT_ENTITLED");
  });

  it("NOT_ENTITLED beats PROVIDER_NOT_CONFIGURED", () => {
    const result = resolveCapabilityState(
      input({ entitled: false, providerNeeded: true, providerConfigured: false }),
    );
    expect(result.state).toBe("NOT_ENTITLED");
  });

  it("resolves PROVIDER_NOT_CONFIGURED when a needed provider is not configured", () => {
    const result = resolveCapabilityState(
      input({ providerNeeded: true, providerConfigured: false }),
    );
    expect(result.state).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("PROVIDER_NOT_CONFIGURED beats SETUP_REQUIRED", () => {
    const result = resolveCapabilityState(
      input({
        providerNeeded: true,
        providerConfigured: false,
        setupNeeded: true,
        setupComplete: false,
      }),
    );
    expect(result.state).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("resolves SETUP_REQUIRED when setup is needed but incomplete", () => {
    const result = resolveCapabilityState(
      input({ setupNeeded: true, setupComplete: false }),
    );
    expect(result.state).toBe("SETUP_REQUIRED");
  });

  it("setup complete passes the setup gate", () => {
    const result = resolveCapabilityState(
      input({ setupNeeded: true, setupComplete: true }),
    );
    expect(result.state).toBe("LIVE");
  });

  it("resolves DEGRADED when a configured provider is unhealthy", () => {
    const result = resolveCapabilityState(
      input({ providerNeeded: true, providerConfigured: true, providerHealthy: false }),
    );
    expect(result.state).toBe("DEGRADED");
  });

  it("DEGRADED does not fire when no provider is needed", () => {
    const result = resolveCapabilityState(input({ providerHealthy: false }));
    expect(result.state).toBe("LIVE");
  });

  it("DEGRADED beats SURFACE_AVAILABLE when the backend is not ready", () => {
    const result = resolveCapabilityState(
      input({
        providerNeeded: true,
        providerConfigured: true,
        providerHealthy: false,
        backendReady: false,
      }),
    );
    expect(result.state).toBe("DEGRADED");
  });

  it("resolves SURFACE_AVAILABLE when the backend is not ready", () => {
    const result = resolveCapabilityState(input({ backendReady: false }));
    expect(result.state).toBe("SURFACE_AVAILABLE");
  });

  it("a route existing is never presented as LIVE when the backend is not ready", () => {
    const result = resolveCapabilityState(input({ routeExists: true, backendReady: false }));
    expect(result.state).not.toBe("LIVE");
    expect(result.state).toBe("SURFACE_AVAILABLE");
  });

  it("pushes a reason string for each decisive check", () => {
    for (const state of [
      resolveCapabilityState(input({ routeExists: false })),
      resolveCapabilityState(input({ emergencyLock: true })),
      resolveCapabilityState(input({ access: "none" })),
      resolveCapabilityState(input({ restricted: true })),
      resolveCapabilityState(input({ complianceBlocked: true })),
      resolveCapabilityState(input({ entitled: false })),
      resolveCapabilityState(input({ providerNeeded: true })),
      resolveCapabilityState(input({ setupNeeded: true })),
      resolveCapabilityState(
        input({ providerNeeded: true, providerConfigured: true, providerHealthy: false }),
      ),
      resolveCapabilityState(input({ backendReady: false })),
      resolveCapabilityState(input()),
    ]) {
      expect(state.reasons.length).toBeGreaterThan(0);
      expect(state.reasons.every((r) => typeof r === "string" && r.length > 0)).toBe(true);
    }
  });
});

describe("capabilityStateLabel", () => {
  it("maps every state to a human label", () => {
    const labels: Record<CapabilityState, string> = {
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
    for (const [state, label] of Object.entries(labels)) {
      expect(capabilityStateLabel(state as CapabilityState)).toBe(label);
    }
  });
});

describe("capabilityStateTone", () => {
  it("maps every state to a tone", () => {
    const tones: Record<CapabilityState, string> = {
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
    for (const [state, tone] of Object.entries(tones)) {
      expect(capabilityStateTone(state as CapabilityState)).toBe(tone);
    }
  });
});

describe("isCapabilityUsable", () => {
  it("is usable only for LIVE and DEGRADED", () => {
    expect(isCapabilityUsable("LIVE")).toBe(true);
    expect(isCapabilityUsable("DEGRADED")).toBe(true);
  });

  it("is not usable for any other state", () => {
    const rest: CapabilityState[] = [
      "SURFACE_AVAILABLE",
      "SETUP_REQUIRED",
      "PROVIDER_NOT_CONFIGURED",
      "AUTHORIZATION_REQUIRED",
      "NOT_ENTITLED",
      "RESTRICTED",
      "UNAVAILABLE",
    ];
    for (const state of rest) {
      expect(isCapabilityUsable(state)).toBe(false);
    }
  });
});
