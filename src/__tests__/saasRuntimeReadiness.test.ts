import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { CommandCenterSnapshot } from "@/lib/commandCenterSnapshot";
import { getSocialMediaProviderReadiness } from "@/lib/social-media/providers";
import { buildSaaSReadinessReport, type SaaSReadinessInputs } from "@/lib/saasRuntimeReadiness";

const providers = getSocialMediaProviderReadiness({} as NodeJS.ProcessEnv);
const validMetrics = {
  activeUsers: 2, organizations: 1, activeProducts: 0, activeEntitlements: 0,
  openSupportTickets: 1, openServiceRequests: 1, auditEventsLast24Hours: 0,
};
const baseSnapshot: CommandCenterSnapshot = {
  source: "database",
  generatedAt: "2026-11-09T00:00:00.000Z",
  metrics: validMetrics,
  operatingLayer: {
    source: "migration_required",
    metrics: null,
    missingTables: ["enterprise_subscriptions", "enterprise_agents"],
  },
};
const input: SaaSReadinessInputs = {
  snapshot: baseSnapshot,
  gatewaySelected: true,
  socialBackendState: "BLOCKED_GATEWAY_BACKEND",
  providers,
};

describe("SaaS backend readiness evidence", () => {
  it("never certifies SaaS launch, payment, community or provider writes", () => {
    const report = buildSaaSReadinessReport(input, "2026-11-09T00:00:00.000Z");
    expect(report.schemaVersion).toBe(1);
    expect(report.externalActionTaken).toBe(false);
    expect(report.statusMeaning).toBe("not-a-launch-certification");
    expect(report.items).toHaveLength(9);
    expect(report.items.every((item) => !item.state.includes("LIVE"))).toBe(true);
    for (const id of ["billing", "marketplace", "community-membership"]) {
      expect(report.items.find((item) => item.id === id)?.state).toBe("NOT_ACTIVATED");
    }
  });

  it("only marks explicitly observed read-only database queries as verified", () => {
    const report = buildSaaSReadinessReport(input);
    expect(report.items.find((item) => item.id === "core-database")?.state).toBe("VERIFIED_READ_ONLY");
    expect(report.items.find((item) => item.id === "tenant-workspaces")?.state).toBe("PARTIAL");
    expect(report.items.find((item) => item.id === "service-delivery")?.state).toBe("PARTIAL");
    expect(report.items.find((item) => item.id === "operating-schema")?.state).toBe("MIGRATION_REQUIRED");
    expect(report.items.find((item) => item.id === "social-backend")?.state).toBe("CONFIGURATION_REQUIRED");
  });

  it("fails closed when the database and operating layer are unavailable", () => {
    const report = buildSaaSReadinessReport({
      ...input,
      snapshot: {
        source: "unavailable", generatedAt: "2026-11-09T00:00:00.000Z",
        metrics: null, operatingLayer: { source: "unavailable", metrics: null },
      },
    });
    expect(report.items.find((item) => item.id === "core-database")?.state).toBe("UNAVAILABLE");
    expect(report.items.find((item) => item.id === "tenant-workspaces")?.state).toBe("UNAVAILABLE");
    expect(report.items.find((item) => item.id === "operating-schema")?.state).toBe("UNAVAILABLE");
  });

  it("requires verified social backend adapter and never infers publishing authorization", () => {
    const report = buildSaaSReadinessReport({ ...input, socialBackendState: "GATEWAY_ADAPTER_VERIFIED" });
    const social = report.items.find((item) => item.id === "social-backend");
    expect(social?.state).toBe("VERIFIED_READ_ONLY");
    expect(social?.evidence).toContain("not certified");
    expect(report.items.find((item) => item.id === "social-providers")?.state).toBe("CONFIGURATION_REQUIRED");
  });

  it("protects the server endpoint and preserves private no-store responses", () => {
    const route = readFileSync("src/app/api/command-center/saas-readiness/route.ts", "utf8");
    const page = readFileSync("src/app/app/command-center/saas/readiness/page.tsx", "utf8");
    expect(route).toContain("await requireAdmin()");
    expect(route.indexOf("await requireAdmin()")).toBeLessThan(route.indexOf("buildCommandCenterSnapshot()"));
    expect(route).toContain("if (!gate.ok) return gate.response");
    expect(route).toContain("private, no-store, max-age=0");
    expect(route).toContain("getSocialBackendReadinessWithProbe");
    expect(route).not.toContain("$executeRaw");
    expect(page).toContain("await requireAdmin()");
    expect(page).toContain('robots: { index: false');
  });

  it("renders actionable diagnostics with filters on the existing protected SaaS home", () => {
    const board = readFileSync("src/components/command-center/SaaSBackendReadinessBoard.tsx", "utf8");
    const home = readFileSync("src/app/app/command-center/saas/page.tsx", "utf8");
    expect(board).toContain('fetch("/api/command-center/saas-readiness"');
    expect(board).toContain('credentials: "same-origin"');
    expect(board).toContain('cache: "no-store"');
    expect(board).toContain("Show only items requiring attention");
    expect(home).toContain('href="/app/command-center/saas/readiness"');
  });
});
