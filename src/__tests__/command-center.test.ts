import { describe, expect, it } from "vitest";
import {
  actionQueue,
  aiAgents,
  approvalQueue,
  commandCenterConnectionState,
  commandCenterNotConnectedSections,
  commandCenterSections,
  complianceFrameworks,
  complianceTasks,
  demoDisclosure,
  executiveMetrics,
  integrations,
  isCommandCenterDatasetConfigured,
  isCommandCenterSection,
  revenueProducts,
  revenueTrend,
  securityIncidents,
  securityMetrics,
  serviceMix,
  tenantHealth,
  usageMeters,
  type CommandCenterDatasetKey,
} from "@/lib/commandCenter";
import { commandCenterSnapshotLabels } from "@/lib/commandCenterSnapshot";
import { clientPortalNavGroups } from "@/lib/platformNavigation";

const datasetKeys: CommandCenterDatasetKey[] = [
  "executiveMetrics",
  "revenueTrend",
  "serviceMix",
  "actionQueue",
  "securityIncidents",
  "securityMetrics",
  "complianceFrameworks",
  "complianceTasks",
  "revenueProducts",
  "usageMeters",
  "tenantHealth",
  "aiAgents",
  "approvalQueue",
  "integrations",
];

// `integrations` intentionally keeps its catalog entries (every entry marked
// "Not configured"); every other illustrative dataset must be an empty array.
const emptyDatasetKeys: CommandCenterDatasetKey[] = datasetKeys.filter(
  (key) => key !== "integrations",
);

const datasets: Record<CommandCenterDatasetKey, unknown[]> = {
  executiveMetrics,
  revenueTrend,
  serviceMix,
  actionQueue,
  securityIncidents,
  securityMetrics,
  complianceFrameworks,
  complianceTasks,
  revenueProducts,
  usageMeters,
  tenantHealth,
  aiAgents,
  approvalQueue,
  integrations,
};

describe("GEM enterprise command center", () => {
  it("exposes every supported operating section", () => {
    expect(Object.keys(commandCenterSections)).toEqual([
      "overview",
      "executive",
      "development",
      "marketing",
      "sales",
      "monitoring",
      "security",
      "compliance",
      "revenue",
      "clients",
      "teams",
      "support",
      "agents",
      "integrations",
    ]);

    expect(isCommandCenterSection("security")).toBe(true);
    expect(isCommandCenterSection("overview")).toBe(false);
    expect(isCommandCenterSection("unknown")).toBe(false);
  });

  it("keeps the not-connected disclosure explicit", () => {
    const disclosure = demoDisclosure.toLowerCase();
    expect(disclosure).toContain("demo data");
    expect(disclosure).toContain("illustrative");
    expect(disclosure).toContain("not connected");
    expect(disclosure).toContain("setup is required");
    expect(disclosure).toContain("empty never means zero activity");
  });

  it("defines a non-sensitive live aggregate contract", () => {
    expect(commandCenterSnapshotLabels.map((metric) => metric.key)).toEqual([
      "activeUsers",
      "organizations",
      "activeProducts",
      "activeEntitlements",
      "openSupportTickets",
      "openServiceRequests",
      "auditEventsLast24Hours",
    ]);
  });

  it("renders every illustrative dataset empty and not configured", () => {
    for (const key of emptyDatasetKeys) {
      expect(datasets[key]).toEqual([]);
    }
    for (const key of datasetKeys) {
      expect(commandCenterConnectionState[key]).toBe("not_configured");
      expect(isCommandCenterDatasetConfigured(key)).toBe(false);
    }

    expect(Object.keys(commandCenterConnectionState).sort()).toEqual(
      [...datasetKeys].sort(),
    );
  });

  it("contains no fabricated incidents, tenants, or figures in any dataset", () => {
    const serialized = JSON.stringify(Object.values(datasets));
    const inventedValues = [
      "Northstar Health",
      "Apex Realty Group",
      "Harbor Financial",
      "Cobalt Logistics",
      "Evergreen Legal",
      "INC-2088",
      "ACT-1042",
      "APR-441",
      "$148.2K",
      "$50.4K",
      "Analytics SaaS",
      "Managed Cybersecurity",
      "386h",
      "7 min ago",
      "3 min ago",
      "1 min ago",
    ];
    for (const value of inventedValues) {
      expect(serialized).not.toContain(value);
    }
  });

  it("marks every integration not configured with no invented health checks", () => {
    expect(integrations.length).toBeGreaterThan(0);
    expect(integrations.every((integration) => integration.state === "Not configured")).toBe(true);
    expect(
      integrations.every((integration) => integration.lastCheck === "Never"),
    ).toBe(true);
    expect(integrations.find((integration) => integration.name === "Stripe")?.state).toBe(
      "Not configured",
    );
    // Catalog structure is retained; only the liveness claims were removed.
    expect(
      integrations.every(
        (integration) =>
          integration.name.length > 0 &&
          integration.category.length > 0 &&
          integration.owner.length > 0,
      ),
    ).toBe(true);
  });

  it("marks previously illustrative sections as not connected", () => {
    expect(commandCenterNotConnectedSections).toEqual(
      expect.arrayContaining([
        "executive",
        "security",
        "compliance",
        "revenue",
        "clients",
        "agents",
        "integrations",
      ]),
    );
    expect(commandCenterNotConnectedSections).not.toContain("overview");
    expect(commandCenterNotConnectedSections).not.toContain("development");
    expect(commandCenterNotConnectedSections).not.toContain("monitoring");
  });

  it("adds the command center to the authenticated enterprise navigation", () => {
    const commandCenterGroup = clientPortalNavGroups.find(
      (group) => group.label === "Command Center",
    );

    expect(commandCenterGroup).toBeDefined();
    expect(commandCenterGroup?.items.map((item) => item.href)).toEqual(
      expect.arrayContaining([
        "/app/command-center",
        "/app/command-center/development",
        "/app/command-center/tokmetric",
        "/app/command-center/monitoring",
        "/app/command-center/agents",
        "/app/command-center/integrations",
      ]),
    );
  });
});
