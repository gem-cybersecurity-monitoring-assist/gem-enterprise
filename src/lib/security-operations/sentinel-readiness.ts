/**
 * Public-schema posture only. Passing this check does not mean sensors, account
 * authorization, backups or incident response are operational.
 */
export const SENTINEL_TABLES = [
  "sentinel_collectors",
  "sentinel_nonces",
  "sentinel_security_events",
  "sentinel_tenants",
  "sentinel_operation_audit",
] as const;

export type SentinelSchemaRow = {
  table_name: string;
  rls_enabled: boolean;
  anon_can_select: boolean;
  authenticated_can_select: boolean;
  anon_can_insert: boolean;
  authenticated_can_insert: boolean;
};

export function assessSentinelDatabaseReadiness(rows: readonly SentinelSchemaRow[]) {
  const byName = new Map(rows.map(row => [row.table_name, row]));
  const missing = SENTINEL_TABLES.filter(name => !byName.has(name));
  const insecure = SENTINEL_TABLES.filter(name => {
    const r = byName.get(name);
    return !!r && (!r.rls_enabled || r.anon_can_select ||
      r.authenticated_can_select || r.anon_can_insert ||
      r.authenticated_can_insert);
  });
  return {
    schemaReady: missing.length === 0 && insecure.length === 0,
    tablesFound: SENTINEL_TABLES.length - missing.length,
    expectedTables: SENTINEL_TABLES.length,
    missingTables: missing,
    insecureTables: insecure,
  };
}
