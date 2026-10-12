import { describe, expect, it } from "vitest";
import { assessSentinelDatabaseReadiness, SENTINEL_TABLES, type SentinelSchemaRow } from "../lib/security-operations/sentinel-readiness";
const secure = (table_name:string): SentinelSchemaRow => ({
  table_name, rls_enabled:true,
  anon_can_select:false,authenticated_can_select:false,
  anon_can_insert:false,authenticated_can_insert:false,
});
describe("Sentinel private database readiness",()=>{
  it("requires every expected table and denies unauthenticated table access",()=>{
    const check=assessSentinelDatabaseReadiness(SENTINEL_TABLES.map(secure));
    expect(check).toEqual({schemaReady:true,expectedTables:5,tablesFound:5,missingTables:[],insecureTables:[]});
  });
  it("rejects incomplete schema",()=>{
    const rows=SENTINEL_TABLES.slice(1).map(secure);
    expect(assessSentinelDatabaseReadiness(rows)).toMatchObject({schemaReady:false,tablesFound:4,missingTables:["sentinel_collectors"]});
  });
  it("rejects any table with RLS disabled",()=>{
    const rows=SENTINEL_TABLES.map(secure);
    rows[3].rls_enabled=false;
    expect(assessSentinelDatabaseReadiness(rows).insecureTables).toContain("sentinel_tenants");
  });
  it("rejects browser readable and writable tables",()=>{
    const rows=SENTINEL_TABLES.map(secure);
    rows[0].authenticated_can_select=true;
    rows[1].anon_can_insert=true;
    const result=assessSentinelDatabaseReadiness(rows);
    expect(result.schemaReady).toBe(false);
    expect(result.insecureTables).toEqual(["sentinel_collectors","sentinel_nonces"]);
  });
});
