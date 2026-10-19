import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards docs/security/gem-supabase-readonly-audit.sql: it is run by the owner against
// production, so it must stay read-only and catalog-only.
const raw = readFileSync(join(process.cwd(), "docs/security/gem-supabase-readonly-audit.sql"), "utf8");
const code = raw.replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''");
const statements = code
  .split(";")
  .map((s) => s.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const CTES = new Set(["api_roles", "rels", "grid", "findings", "t"]);
const SET_RETURNING = new Set(["unnest", "aclexplode"]);

describe("Supabase read-only audit pack", () => {
  it("starts by making the transaction read-only", () => {
    expect(statements[0]).toBe("SET LOCAL transaction_read_only = on");
  });

  it("contains only SELECT/WITH statements after the guard", () => {
    for (const statement of statements.slice(1)) expect(statement).toMatch(/^(SELECT|WITH)\b/);
    expect(statements.length).toBe(11);
  });

  it("contains no write, DDL, DCL or procedural keywords outside string literals", () => {
    const forbidden =
      /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|ALTER|GRANT|REVOKE|CREATE|DROP|TRUNCATE|COPY|VACUUM|ANALYZE|REINDEX|CLUSTER|REFRESH|LOCK|CALL|DO|EXECUTE|PREPARE|COMMENT|IMPORT|RESET|DISCARD|LISTEN|NOTIFY|BEGIN|COMMIT|ROLLBACK|SAVEPOINT)\b/i;
    expect(code.match(forbidden)?.[0] ?? null).toBeNull();
  });

  it("reads only system catalogs, never application tables or secrets", () => {
    const targets = [...code.matchAll(/\b(?:FROM|JOIN)\s+(?:LATERAL\s+)?([A-Za-z_][\w.]*)/gi)].map((m) => m[1].toLowerCase());
    const unexpected = targets.filter((t) => !t.startsWith("pg_") && !CTES.has(t) && !SET_RETURNING.has(t));
    expect(unexpected).toEqual([]);
    expect(code).not.toMatch(/current_setting|pg_read_file|pg_read_binary_file|pg_ls_dir|dblink|lo_\w+|vault|decrypted|auth\.users|passwordHash/i);
  });
});
