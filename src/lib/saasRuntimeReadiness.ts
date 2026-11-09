/**
 * Administrative SaaS readiness contract. Represents evidence gathered during
 * this request, not an entitlement check, external provider certification,
 * production migration approval or a license to publish/charge customers.
 */
import type { CommandCenterSnapshot } from "@/lib/commandCenterSnapshot";
import type { SocialMediaProviderReadiness } from "@/lib/social-media/providers";
import type { SocialBackendState } from "@/lib/social-media/backend-readiness";

export type SaaSReadinessState =
  | "VERIFIED_READ_ONLY"
  | "PARTIAL"
  | "MIGRATION_REQUIRED"
  | "CONFIGURATION_REQUIRED"
  | "APPROVAL_REQUIRED"
  | "NOT_ACTIVATED"
  | "UNAVAILABLE";

export type SaaSReadinessArea = "platform" | "tenants" | "services" | "social" | "community" | "marketplace" | "billing";

export type SaaSReadinessItem = Readonly<{
  id: string;
  area: SaaSReadinessArea;
  label: string;
  state: SaaSReadinessState;
  evidence: string;
  nextAction: string;
  href: string;
}>;

export type SaaSGatewayAdminStats = Readonly<{
  totalUsers: number;
  pendingKyc: number;
  openApprovals: number;
  openTickets: number;
}>;

export function isSaaSGatewayAdminStats(value: unknown): value is SaaSGatewayAdminStats {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["totalUsers", "pendingKyc", "openApprovals", "openTickets"].every(
    (key) => typeof row[key] === "number" && Number.isSafeInteger(row[key]) && (row[key] as number) >= 0,
  );
}

export type SaaSReadinessInputs = Readonly<{
  snapshot: CommandCenterSnapshot;
  socialBackendState: SocialBackendState;
  providers: readonly SocialMediaProviderReadiness[];
  gatewaySelected: boolean;
  gatewayAdminStats?: SaaSGatewayAdminStats | null;
}>;

export type SaaSReadinessReport = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  source: "live-read-only-probes";
  statusMeaning: "not-a-launch-certification";
  externalActionTaken: false;
  items: SaaSReadinessItem[];
}>;

/** No fake zeroes: unknown counts remain unknown. */
export function buildSaaSReadinessItems(input: SaaSReadinessInputs): SaaSReadinessItem[] {
  const { snapshot, socialBackendState, providers, gatewaySelected, gatewayAdminStats } = input;
  const operational = snapshot.operatingLayer;
  const databaseReadable = snapshot.source === "database" && snapshot.metrics !== null;
  const gatewayStatsReadable = gatewaySelected && isSaaSGatewayAdminStats(gatewayAdminStats);
  const backend = gatewaySelected ? "Supabase gateway" : "direct PostgreSQL";
  const configuredProviders = providers.filter((p) => p.configurationReady).length;
  const providerApprovalsPending = providers.filter((p) => p.configurationReady && !p.platformApprovalGranted).length;
  const verifiedGateway = socialBackendState === "GATEWAY_ADAPTER_VERIFIED";
  const operatingState: SaaSReadinessState = operational.source === "database"
    ? "VERIFIED_READ_ONLY"
    : operational.source === "migration_required" ? "MIGRATION_REQUIRED" : "UNAVAILABLE";

  const items: SaaSReadinessItem[] = [
    {
      id: "core-database",
      area: "platform",
      label: "Core operating data",
      state: databaseReadable ? "VERIFIED_READ_ONLY" : gatewayStatsReadable ? "PARTIAL" : "UNAVAILABLE",
      evidence: databaseReadable
        ? `Authenticated aggregate query succeeded on ${backend}. No personal records included.`
        : gatewayStatsReadable
          ? "Authenticated administrator gateway returned verified account, identity-review, approval and support-ticket counters. Complete operating-layer metrics remain unverified."
          : `No readable authenticated aggregate snapshot from ${backend}; operation cannot be certified.`,
      nextAction: databaseReadable ? "Review live aggregate totals and owner access." : gatewayStatsReadable
        ? "Validate full tenant and service counts using the authoritative database before launch certification."
        : "Check connection health, database schema and authorized session.",
      href: "/app/command-center",
    },
    {
      id: "tenant-workspaces",
      area: "tenants",
      label: "Organizations and workspaces",
      state: databaseReadable ? "PARTIAL" : "UNAVAILABLE",
      evidence: databaseReadable
        ? "Core organization counts are available. Cross-tenant authorization and owner onboarding have not been proven by this probe."
        : "Organization and workspace runtime evidence is unavailable.",
      nextAction: "Verify invitations, memberships, two-tenant isolation and owner revocation in an authenticated test.",
      href: "/app/admin/workspace-access",
    },
    {
      id: "service-delivery",
      area: "services",
      label: "Requests and support",
      state: databaseReadable || gatewayStatsReadable ? "PARTIAL" : "UNAVAILABLE",
      evidence: databaseReadable
        ? "Service and support queue aggregates queried successfully; assignment-to-closure flow is not certified."
        : gatewayStatsReadable
          ? "Authenticated gateway returned an open-support-ticket counter only. Service requests, assignment and closure were not verified."
          : "No verified current service-delivery aggregates.",
      nextAction: "Run authenticated request creation, assignment, notifications and closure tests.",
      href: "/app/requests",
    },
    {
      id: "social-backend",
      area: "social",
      label: "Social workflow persistence",
      state: verifiedGateway ? "VERIFIED_READ_ONLY" : "CONFIGURATION_REQUIRED",
      evidence: verifiedGateway
        ? "Gateway adapter inventory and health probe passed. Provider OAuth and live publishing are not certified."
        : socialBackendState === "BLOCKED_GATEWAY_BACKEND"
          ? "Gateway authentication is selected but social queue/connector persistence adapter was not verified."
          : "Direct database path is selected; persistence and provider actions were not verified by this probe.",
      nextAction: verifiedGateway
        ? "Verify provider authorization, exact-content approvals and controlled sandbox lifecycle."
        : "Connect and verify the approved transactional social backend; do not enable live publishing.",
      href: "/app/command-center/social-media",
    },
    {
      id: "social-providers",
      area: "social",
      label: "Social provider setup",
      state: configuredProviders === 0 ? "CONFIGURATION_REQUIRED" : "PARTIAL",
      evidence: `${configuredProviders} of ${providers.length} provider configurations meet declared prerequisites; ${providerApprovalsPending} configured providers still require platform approval. No connected account or publishing action was verified.`,
      nextAction: "Complete missing provider configuration, account authorization and platform review before activation.",
      href: "/app/command-center/integrations",
    },
    {
      id: "operating-schema",
      area: "platform",
      label: "Persistent SaaS operating layer",
      state: operatingState,
      evidence: operational.source === "database"
        ? "SaaS operating tables returned authenticated aggregate metrics, not full workflow assurance."
        : operational.source === "migration_required"
          ? `Database inspection found ${operational.missingTables?.length ?? "unknown"} missing operating tables. No migration was applied.`
          : "Unable to verify operating-layer schema or counts.",
      nextAction: operatingState === "MIGRATION_REQUIRED"
        ? "Review proposed SQL, ownership, retention and rollback; approve and rehearse a separate controlled migration."
        : "Check actual schema, governance and integration coverage before market activation.",
      href: "/app/command-center",
    },
    {
      id: "community-membership",
      area: "community",
      label: "Community membership and moderation",
      state: "NOT_ACTIVATED",
      evidence: "Current community is a disclosed fictional preview; real member identity, moderation and consent lifecycle have not passed acceptance.",
      nextAction: "Implement and verify member onboarding, reporting, moderation, deletion and consent before inviting the public.",
      href: "/community-hub",
    },
    {
      id: "marketplace",
      area: "marketplace",
      label: "Transactional service marketplace",
      state: "NOT_ACTIVATED",
      evidence: "Store is request-only; provider settlements, orders and dispute lifecycle are not live.",
      nextAction: "Build approved offers, quotes, cancellations and dispute resolution; gate all payment flows.",
      href: "/store",
    },
    {
      id: "billing",
      area: "billing",
      label: "Subscriptions and invoicing",
      state: "NOT_ACTIVATED",
      evidence: "No verified live SaaS billing, signed webhooks, reconciliation or refund lifecycle. Operating table presence alone does not activate billing.",
      nextAction: "Approve plans/legal terms, then implement provider webhooks, usage and invoice reconciliation on an isolated sandbox.",
      href: "/app/command-center/saas/areas/market",
    },
  ];

  return items;
}

export function buildSaaSReadinessReport(
  input: SaaSReadinessInputs,
  generatedAt: string = new Date().toISOString(),
): SaaSReadinessReport {
  return {
    schemaVersion: 1,
    generatedAt,
    source: "live-read-only-probes",
    statusMeaning: "not-a-launch-certification",
    externalActionTaken: false,
    items: buildSaaSReadinessItems(input),
  };
}
