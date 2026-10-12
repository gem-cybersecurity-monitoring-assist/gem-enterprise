import { describe, expect, it } from "vitest";
import { resolveSentinelStorageConfig } from "../lib/security-operations/sentinel-store";

describe("Sentinel's dedicated Supabase database isolation", () => {
  it("preserves existing shared-mode behavior when no dedicated project is chosen",()=>{
    expect(resolveSentinelStorageConfig({})).toEqual({mode:"shared"});
    expect(resolveSentinelStorageConfig({SENTINEL_STORAGE_MODE:"shared"})).toEqual({mode:"shared"});
  });
  it("rejects a dedicated URL without an explicit storage mode",()=>{
    expect(()=>resolveSentinelStorageConfig({SENTINEL_DATABASE_URL:"postgresql://example.invalid/db"})).toThrow();
  });
  it("never silently falls back to the GEM business database in dedicated mode",()=>{
    expect(()=>resolveSentinelStorageConfig({SENTINEL_STORAGE_MODE:"dedicated"})).toThrow();
    expect(()=>resolveSentinelStorageConfig({SENTINEL_STORAGE_MODE:"dedicated",SENTINEL_DATABASE_URL:"oops"})).toThrow();
  });
  it("forbids a literal reuse of the GEM business database URI",()=>{
    const url="postgresql://example.invalid/sentinel";
    expect(()=>resolveSentinelStorageConfig({SENTINEL_STORAGE_MODE:"dedicated",SENTINEL_DATABASE_URL:url,POSTGRES_PRISMA_URL:url})).toThrow();
  });
  it("accepts a separately configured private PostgreSQL connection",()=>{
    expect(resolveSentinelStorageConfig({
      SENTINEL_STORAGE_MODE:"dedicated",
      SENTINEL_DATABASE_URL:"postgresql://sentinel.invalid:5432/postgres",
      POSTGRES_PRISMA_URL:"postgresql://business.invalid:5432/gem",
    })).toEqual({mode:"dedicated",url:"postgresql://sentinel.invalid:5432/postgres"});
  });
});
