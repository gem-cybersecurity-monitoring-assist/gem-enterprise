/**
 * commandCenterHonesty.test.ts (WS-G)
 *
 * Honesty tests for the WS-B command-center demo-data remediation
 * (src/lib/commandCenter.ts): every operational dataset is explicitly
 * not_configured, arrays are empty, and the demo disclosure says so.
 * Pure-module tests only: no DB, no network, no secrets.
 */
import { describe, expect, it } from "vitest";
import {
  actionQueue,
  aiAgents,
  approvalQueue,
  commandCenterConnectionState,
  commandCenterNotConnectedSections,
  complianceFrameworks,
  complianceTasks,
  demoDisclosure,
  executiveMetrics,
  integrations,
  isCommandCenterDatasetConfigured,
  revenueProducts,
  revenueTrend,
  securityIncidents,
  securityMetrics,
  serviceMix,
  tenantHealth,
  usageMeters,
  type CommandCenterDatasetKey,
} from "@/lib/commandCenter";

const ALL_DATASET_KEYS: CommandCenterDatasetKey[] = [
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

describe("commandCenterConnectionState", () => {
  it("marks every CommandCenterDatasetKey as not_configured", () => {
    for (const key of ALL_DATASET_KEYS) {
      expect(commandCenterConnectionState[key]).toBe("not_configured");
    }
  });

  it("covers exactly the known dataset keys — nothing added, nothing missing", () => {
    expect(Object.keys(commandCenterConnectionState).sort()).toEqual(
      [...ALL_DATASET_KEYS].sort(),
    );
  });

  it("isCommandCenterDatasetConfigured returns false for every dataset", () => {
    for (const key of ALL_DATASET_KEYS) {
      expect(isCommandCenterDatasetConfigured(key)).toBe(false);
    }
  });
});

describe("operational datasets are empty (no fabricated records)", () => {
  it("metric arrays are empty", () => {
    expect(executiveMetrics).toEqual([]);
    expect(securityMetrics).toEqual([]);
  });

  it("revenue arrays are empty", () => {
    expect(revenueTrend).toEqual([]);
    expect(revenueProducts).toEqual([]);
    expect(serviceMix).toEqual([]);
    expect(usageMeters).toEqual([]);
  });

  it("incident/action arrays are empty", () => {
    expect(securityIncidents).toEqual([]);
    expect(actionQueue).toEqual([]);
  });

  it("compliance arrays are empty", () => {
    expect(complianceFrameworks).toEqual([]);
    expect(complianceTasks).toEqual([]);
  });

  it("tenant, agent, and approval arrays are empty", () => {
    expect(tenantHealth).toEqual([]);
    expect(aiAgents).toEqual([]);
    expect(approvalQueue).toEqual([]);
  });
});

describe("integrations catalog honesty", () => {
  it("every integration entry is explicitly marked Not configured", () => {
    expect(integrations.length).toBeGreaterThan(0);
    for (const entry of integrations) {
      expect(entry.state).toBe("Not configured");
    }
  });

  it("no invented health-check timestamps are claimed", () => {
    for (const entry of integrations) {
      expect(entry.lastCheck).toBe("Never");
    }
  });
});

describe("demoDisclosure", () => {
  it("exists and is non-empty", () => {
    expect(typeof demoDisclosure).toBe("string");
    expect(demoDisclosure.length).toBeGreaterThan(0);
  });

  it("says setup is required before values exist", () => {
    expect(demoDisclosure.toLowerCase()).toContain("setup is required");
  });

  it("says empty datasets are not connected and not live evidence", () => {
    const lower = demoDisclosure.toLowerCase();
    expect(lower).toContain("not connected");
    expect(lower).toContain("illustrative");
  });
});

describe("commandCenterNotConnectedSections", () => {
  it("flags the sections that previously rendered fabricated datasets", () => {
    expect(commandCenterNotConnectedSections).toContain("executive");
    expect(commandCenterNotConnectedSections).toContain("security");
    expect(commandCenterNotConnectedSections).toContain("compliance");
    expect(commandCenterNotConnectedSections).toContain("revenue");
    expect(commandCenterNotConnectedSections).toContain("clients");
    expect(commandCenterNotConnectedSections).toContain("agents");
    expect(commandCenterNotConnectedSections).toContain("integrations");
  });
});
