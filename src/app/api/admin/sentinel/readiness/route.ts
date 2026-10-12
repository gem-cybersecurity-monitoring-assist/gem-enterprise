import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/api/auth-helpers";
import { getSentinelDb, resolveSentinelStorageConfig } from "@/lib/security-operations/sentinel-store";
import { assessSentinelDatabaseReadiness, type SentinelSchemaRow } from "@/lib/security-operations/sentinel-readiness";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function reply(data:unknown,status=200) {
  return NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store, max-age=0"}});
}

export async function GET() {
  const gate=await requirePlatformOwner();
  if (!gate.ok) return gate.response;
  try {
    const config=resolveSentinelStorageConfig();
    if (config.mode!=="dedicated") {
      return reply({databaseStatus:"NOT_CONFIGURED",storageMode:"shared",
        message:"The dedicated Sentinel database is not configured for this application environment. Existing GEM data settings were not changed."},409);
    }
    // Only read PostgreSQL system metadata; never return URLs or connection secrets.
    const rows=await getSentinelDb().$queryRaw<SentinelSchemaRow[]>`
      SELECT c.relname::text AS table_name,
        c.relrowsecurity AS rls_enabled,
        has_table_privilege('anon',c.oid,'SELECT') AS anon_can_select,
        has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select,
        has_table_privilege('anon',c.oid,'INSERT') AS anon_can_insert,
        has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_can_insert
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND c.relname IN (
          'sentinel_collectors','sentinel_nonces','sentinel_security_events',
          'sentinel_tenants','sentinel_operation_audit'
        )
      ORDER BY c.relname
    `;
    const assessed=assessSentinelDatabaseReadiness(rows);
    if (!assessed.schemaReady) {
      return reply({databaseStatus:"SCHEMA_INCOMPLETE_OR_UNSAFE",storageMode:"dedicated",
        ...assessed,liveProtectionVerified:false},503);
    }
    return reply({databaseStatus:"SCHEMA_READY_FOR_LAB",storageMode:"dedicated",
      ...assessed,liveProtectionVerified:false,
      message:"Private database connection and schema verified. Sensor installation, consent and end-to-end event delivery are not yet verified."});
  } catch {
    // Don't disclose database host, username, URLs or raw connection errors to the UI.
    return reply({databaseStatus:"DATABASE_UNAVAILABLE",liveProtectionVerified:false,
      message:"The application cannot verify the dedicated Sentinel database connection."},503);
  }
}
