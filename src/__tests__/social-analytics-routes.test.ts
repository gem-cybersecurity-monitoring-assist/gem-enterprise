import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("social analytics routes", () => {
  it("scopes the read API to the workspace with session RBAC", () => {
    const route = source("src/app/api/social-media/analytics/route.ts");
    expect(route).toContain("requireTokMetricSession");
    expect(route).toContain("requireWorkspaceAccess(input.workspaceId, session)");
    expect(route).toContain('requirePermission(membership, "manage", "analytics")');
    expect(route).toContain("workspaceId: input.workspaceId");
    // Query filters are supported.
    expect(route).toContain("provider");
    expect(route).toContain("contentId");
    // Aggregated series response; no raw provider payloads or secrets.
    expect(route).toContain("series");
    expect(route).toContain("totals");
    expect(route).toContain("engagementRate");
    expect(route).not.toContain("accessToken");
    expect(route).toContain('"Cache-Control"');
    expect(route).toContain("no-store, max-age=0");
  });

  it("protects the sync worker with CRON_SECRET bearer auth", () => {
    const route = source("src/app/api/social-media/analytics/sync/route.ts");
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("CRON_AUTH_NOT_CONFIGURED");
    expect(route).toContain("UNAUTHORIZED");
    expect(route).toContain("export async function GET");
    expect(route).toContain("export async function POST");
    expect(route).toContain("runSocialMetricsSync");
    expect(route).not.toContain("accessToken");
  });

  it("migration enables RLS on all new tables and revokes public access", () => {
    const migration = source(
      "prisma/migrations/20260929121500_social_metric_snapshots/migration.sql",
    );
    for (const table of [
      "social_metric_snapshots",
      "provider_account_metrics",
      "social_metric_sync_runs",
    ]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE "${table}" FROM PUBLIC;`);
    }
    expect(migration).toContain(
      "social_metric_snapshots_workspace_provider_post_date",
    );
    expect(migration).toContain("provider_account_metrics_workspace_connector_date");
    // Sync run records distinguish failure from zero-valued snapshots.
    expect(migration).toContain('"kind" TEXT NOT NULL');
    expect(migration).toContain("'NOT_SUPPORTED'");
  });
});
