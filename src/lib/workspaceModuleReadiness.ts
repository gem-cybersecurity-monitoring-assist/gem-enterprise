/**
 * workspaceModuleReadiness.ts (WS-C)
 *
 * Maps each clientWorkspaceCatalog module id to a CapabilityInput for
 * @/lib/capabilityReadiness. Pure functions only: no DB, no network, no
 * secrets. Callers fetch the real workspace signals (connectors, entitlements,
 * KYC status, controls) and hand them in via WorkspaceModuleReadinessContext.
 *
 * Honesty rules:
 * - A route existing is never presented as LIVE (WS-A resolver guarantees it).
 * - Provider-backed modules stay fail-closed: no usable connector record means
 *   PROVIDER_NOT_CONFIGURED, never an assumed balance/holding/incident state.
 * - When the session cannot see direct database state (managed gateway mode),
 *   DB-dependent gates resolve to SURFACE_AVAILABLE with an explicit reason
 *   instead of guessing.
 */

import {
  resolveCapabilityState,
  type CapabilityInput,
  type CapabilityResolution,
  type WorkspaceAccessLevel,
} from "@/lib/capabilityReadiness";
import { clientWorkspaceModules } from "@/lib/clientWorkspaceCatalog";

export interface WorkspaceConnectorSignal {
  provider: string;
  state: string;
  /** Service mappings supplied by a trusted backend, never by a browser. */
  moduleIds?: readonly string[];
}

export interface WorkspaceModuleReadinessContext {
  access: WorkspaceAccessLevel;
  entitlements: string[];
  connectors: WorkspaceConnectorSignal[];
  kycStatus: string | null;
  emergencyLock: boolean;
  controls: {
    publishingDisabled: boolean;
    advertisingDisabled: boolean;
    connectorDisabled: boolean;
  };
  activeProjectCount: number;
  /** False when the session cannot observe direct database state (managed gateway mode). */
  dataSourceKnown: boolean;
}

type ContextPredicate = (ctx: WorkspaceModuleReadinessContext) => boolean;

interface ModuleCapabilityRule {
  providerNeeded?: boolean;
  kycRequired?: boolean;
  setupNeeded?: boolean | ContextPredicate;
  setupComplete?: ContextPredicate;
  routeExists?: boolean;
  restricted?: ContextPredicate;
}

/** Connector records that count as "a provider is configured" (may still be unhealthy). */
const CONFIGURED_CONNECTOR_STATES = new Set([
  "CONNECTED",
  "DEGRADED",
  "TOKEN_EXPIRED",
  "REAUTHORIZATION_REQUIRED",
  "AUTHORIZATION_PENDING",
]);

function hasConnectedConnector(ctx: WorkspaceModuleReadinessContext): boolean {
  return ctx.connectors.some((connector) => connector.state === "CONNECTED");
}

const SOCIAL_PROVIDERS = new Set(["META", "FACEBOOK_PAGE", "INSTAGRAM_PROFESSIONAL", "X", "LINKEDIN", "LINKEDIN_COMPANY", "YOUTUBE", "NEXTDOOR", "TIKTOK", "TIKTOK_CONTENT_POSTING_API", "TIKTOK_BUSINESS_API"]);

function moduleConnectors(moduleId: string, ctx: WorkspaceModuleReadinessContext) {
  return ctx.connectors.filter((connector) =>
    connector.moduleIds?.includes(moduleId) ||
    (moduleId === "social_media" && SOCIAL_PROVIDERS.has(connector.provider.toUpperCase())),
  );
}

const MODULE_RULES: Record<string, ModuleCapabilityRule> = {
  // Finance surfaces are provider-backed and fail closed without a usable connector.
  finance: { providerNeeded: true },
  portfolio: { providerNeeded: true },
  savings: { providerNeeded: true },
  digital_finance: { providerNeeded: true, kycRequired: true },

  // Social publishing runs through provider connectors.
  social_media: { providerNeeded: true },

  // Compliance workflows require a satisfied KYC application.
  compliance: { kycRequired: true },

  // Digital operations depend on workspace controls: locked publishing or
  // disabled connectors mean setup is still required.
  digital_services: {
    setupNeeded: (ctx) => ctx.controls.publishingDisabled || ctx.controls.connectorDisabled,
    setupComplete: () => false,
  },

  // Threat monitoring needs an explicit enrollment; no workspace-level
  // enrollment record exists, so it stays setup-required until recorded.
  threat_monitoring: { setupNeeded: true, setupComplete: () => false },

  // Integrations resolve to the client connections surface; activation
  // completes when at least one provider connection is live.
  integrations: { setupNeeded: true, setupComplete: hasConnectedConnector },

  // Governed AI/automation enrollment is not recorded per workspace, so the
  // module stays setup-required (fail-closed) until an enrollment record
  // exists. The module links to the client autopilot policy surface, never
  // the admin-only command-center routes.
  automations: { setupNeeded: true, setupComplete: () => false },
};

const DEFAULT_RULE: ModuleCapabilityRule = {};

/**
 * Build the CapabilityInput for a catalog module. Follows the task contract:
 * default entitled=true unless an entitlementSlug is set (catalog or override)
 * and missing from the workspace entitlements.
 */
export function resolveWorkspaceModuleReadiness(
  moduleId: string,
  ctx: WorkspaceModuleReadinessContext,
): CapabilityInput {
  const catalogModule = clientWorkspaceModules.find((module) => module.id === moduleId);
  const rule = MODULE_RULES[moduleId] ?? DEFAULT_RULE;

  const entitlementSlug = catalogModule?.entitlementSlug;
  const entitled = entitlementSlug ? ctx.entitlements.includes(entitlementSlug) : true;
  const providerNeeded = rule.providerNeeded ?? catalogModule?.providerNeeded ?? false;
  const kycRequired = rule.kycRequired ?? false;
  const connectors = moduleConnectors(moduleId, ctx);
  const providerConfigured = providerNeeded && connectors.some((connector) => CONFIGURED_CONNECTOR_STATES.has(connector.state));
  const providerHealthy = providerNeeded
    ? providerConfigured
      ? connectors.some((connector) => connector.state === "CONNECTED")
      : null
    : null;
  const setupNeeded =
    typeof rule.setupNeeded === "function" ? rule.setupNeeded(ctx) : (rule.setupNeeded ?? false);
  const setupComplete = rule.setupComplete ? rule.setupComplete(ctx) : true;

  return {
    routeExists: rule.routeExists ?? true,
    access: ctx.access,
    entitled,
    providerNeeded,
    providerConfigured,
    providerHealthy,
    setupNeeded,
    setupComplete,
    // A route existing is never presented as LIVE; backend liveness is never
    // asserted from catalog data, so backendReady stays false.
    backendReady: false,
    complianceBlocked: false,
    kycRequired,
    kycSatisfied: (ctx.kycStatus ?? "").toLowerCase() === "approved",
    restricted: rule.restricted ? rule.restricted(ctx) : false,
    emergencyLock: ctx.emergencyLock,
  };
}

/** Convenience: resolve the CapabilityInput and run it through the WS-A resolver. */
export function resolveWorkspaceModuleState(
  moduleId: string,
  ctx: WorkspaceModuleReadinessContext,
): CapabilityResolution {
  const catalogModule = clientWorkspaceModules.find((module) => module.id === moduleId);
  const rule = MODULE_RULES[moduleId] ?? DEFAULT_RULE;
  const dbDependent =
    (rule.providerNeeded ?? catalogModule?.providerNeeded ?? false) ||
    (rule.kycRequired ?? false) ||
    Boolean(catalogModule?.entitlementSlug);

  // When the session cannot observe direct database state, never guess at
  // provider/entitlement/KYC gates: the route surface is available, but the
  // capability state is explicitly unknowable here.
  if (!ctx.dataSourceKnown && dbDependent) {
    if (ctx.emergencyLock) {
      return { state: "RESTRICTED", reasons: ["emergency lock engaged"] };
    }
    return {
      state: "SURFACE_AVAILABLE",
      reasons: ["readiness signals not visible in this session"],
    };
  }

  return resolveCapabilityState(resolveWorkspaceModuleReadiness(moduleId, ctx));
}

export type { CapabilityInput, CapabilityResolution, WorkspaceAccessLevel };
