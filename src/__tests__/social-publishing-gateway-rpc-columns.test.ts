import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The tokmetric_* tables come from a Prisma migration without @map, so their
// columns are quoted camelCase ("workspaceId", "globalEmergencyLock"). The
// social_* tables are snake_case. PL/pgSQL resolves column names only when a
// function first runs, so a snake_case reference to a tokmetric column passes
// CREATE FUNCTION and the gem_social_health probe, then fails on the first
// real call. These checks keep the tokmetric-reading RPCs on the real names.

const repoRoot = path.resolve(__dirname, "../..");
const rpcSql = readFileSync(
  path.join(repoRoot, "supabase/migrations/20261108050000_social_publishing_gateway_rpcs.sql"),
  "utf8",
);
const tokmetricSql = readFileSync(
  path.join(repoRoot, "prisma/migrations/20260705143000_tokmetric_phase1_foundation/migration.sql"),
  "utf8",
);

function functionBody(name: string): string {
  const start = rpcSql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} is defined`).toBeGreaterThanOrEqual(0);
  const end = rpcSql.indexOf(`REVOKE ALL ON FUNCTION public.${name}(`, start);
  expect(end, `${name} has its REVOKE`).toBeGreaterThan(start);
  return rpcSql.slice(start, end);
}

// Strip comments and string literals so only SQL identifiers remain.
function identifiers(body: string): string[] {
  const code = body.replace(/--[^\n]*/g, "").replace(/'[^']*'/g, "''");
  return code.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [];
}

const ALLOWED = [
  /^p_/,
  /^v_/,
  /^tokmetric_[a-z_]+$/,
  /^gem_social_/,
  /^(jsonb_build_object|row_to_json|jsonb_agg|gen_random_uuid|search_path|variable_conflict|use_column|service_role)$/,
];

describe("gem_social_* RPCs that read tokmetric tables", () => {
  it("the tokmetric tables really are camelCase", () => {
    expect(tokmetricSql).toContain('"globalEmergencyLock" BOOLEAN');
    expect(tokmetricSql).toMatch(/CREATE TABLE "tokmetric_audit_events"[\s\S]*?"correlationId"/);
  });

  for (const name of [
    "gem_social_workspace_locks",
    "gem_social_governance_evidence",
    "gem_social_audit_event",
  ]) {
    it(`${name} uses no snake_case column names`, () => {
      const unexpected = identifiers(functionBody(name)).filter(
        (id) => !ALLOWED.some((pattern) => pattern.test(id)),
      );
      expect(unexpected).toEqual([]);
    });
  }
});
