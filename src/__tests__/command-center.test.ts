import { describe, expect, it } from "vitest";
import {
  aiAgents,
  commandCenterSections,
  complianceFrameworks,
  demoDisclosure,
  integrations,
  isCommandCenterSection,
  revenueProducts,
  securityIncidents,
  tenantHealth,
} from "@/lib/commandCenter";
import { commandCenterSnapshotLabels } from "@/lib/commandCenterSnapshot";
import { clientPortalNavGroups } from "@/lib/platformNavigation";

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

  it("keeps demo metrics explicitly disclosed", () => {
    expect(demoDisclosure.toLowerCase()).toContain("demo data");
    expect(demoDisclosure.toLowerCase()).toContain("illustrative");
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

  it("includes the full monetization and operations surface", () => {
    expect(revenueProducts.map((product) => product.name)).toEqual(
      expect.arrayContaining([
        "Analytics SaaS",
        "Managed Cybersecurity",
        "Compliance Management",
        "AI Automation",
        "White Label",
        "API and Training",
      ]),
    );
    expect(securityIncidents.length).toBeGreaterThan(0);
    expect(complianceFrameworks.length).toBeGreaterThanOrEqual(6);
    expect(tenantHealth.length).toBeGreaterThan(0);
    expect(aiAgents.every((agent) => agent.approval.length > 0)).toBe(true);
  });

  it("never defaults unverified integrations to connected", () => {
    const allowedStates = new Set([
      "Not configured",
      "Configuration required",
      "Degraded",
      "Connected",
    ]);

    expect(integrations.every((integration) => allowedStates.has(integration.state))).toBe(true);
    expect(integrations.find((integration) => integration.name === "Stripe")?.state).toBe(
      "Not configured",
    );
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
