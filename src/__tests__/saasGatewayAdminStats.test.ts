import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/components/command-center/SaaSOperationalSnapshot.tsx", "utf8");
const statsRoute = readFileSync("src/app/api/admin/stats/route.ts", "utf8");

describe("Gateway-compatible SaaS admin statistics", () => {
  it("attempts the full snapshot first then uses the existing authenticated admin API", () => {
    const fullAt = component.indexOf('fetch("/api/command-center/snapshot"');
    const fallbackAt = component.indexOf('fetch("/api/admin/stats"');
    expect(fullAt).toBeGreaterThan(0);
    expect(fallbackAt).toBeGreaterThan(fullAt);
    expect(component).toContain('credentials: "same-origin"');
    expect(component).toContain('cache: "no-store"');
  });

  it("prevents auth failures from being bypassed by a fallback", () => {
    expect(component).toContain('response.status === 401 || response.status === 403');
    expect(component.indexOf('response.status === 401 || response.status === 403'))
      .toBeLessThan(component.indexOf('fetch("/api/admin/stats"'));
    expect(statsRoute).toContain("await requireAdmin()");
    expect(statsRoute).toContain("if (!gate.ok) return gate.response");
  });

  it("supports Supabase gateway and direct Prisma through the existing backend", () => {
    expect(statsRoute).toContain('adminReadGateway("stats", gatewayToken)');
    expect(statsRoute).toContain('db.user.count');
    expect(statsRoute).toContain('"Cache-Control": "no-store"');
    expect(component).toContain('kind: "admin-stats"');
  });

  it("fails closed for unverified, incomplete, invalid or negative counters", () => {
    expect(component).toContain("Number.isSafeInteger");
    expect(component).toContain(">= 0");
    expect(component).toContain("No sample figures are substituted");
    expect(component).toContain("This is not the complete operating-layer snapshot");
    expect(component).toContain("organization, subscription, integration and incident counts remain unverified here");
    expect(component).not.toContain("Math.random()");
  });
});
