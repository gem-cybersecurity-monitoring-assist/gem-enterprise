import { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Keep the GEM Enterprise identity / business database separate from Sentinel's
 * potentially standalone Supabase PostgreSQL database. No connection fallback
 * is allowed once dedicated mode has been selected.
 *
 * Do not use this client for identity, payments, or non-Sentinel models.
 * Both databases use the checked-in Prisma model definitions, but a standalone
 * Sentinel database needs only the explicitly scoped Sentinel tables.
 */
const globals = globalThis as unknown as { gemSentinelPrisma?: PrismaClient };

export function resolveSentinelStorageConfig(env: NodeJS.ProcessEnv = process.env):
  { mode: "shared" } | { mode: "dedicated"; url: string } {
  const mode = env.SENTINEL_STORAGE_MODE?.trim() || "shared";
  const url = env.SENTINEL_DATABASE_URL?.trim() || "";
  if (mode === "shared") {
    if (url) throw new Error("SENTINEL_DATABASE_URL requires SENTINEL_STORAGE_MODE=dedicated");
    return {mode:"shared"};
  }
  if (mode !== "dedicated") throw new Error("Unsupported Sentinel storage mode");
  if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
    throw new Error("Dedicated Sentinel storage requires its private PostgreSQL connection URI");
  }
  const canonical = [
    env.POSTGRES_PRISMA_URL,
    env.DATABASE_URL,
    env.POSTGRES_URL,
    env.NEON_DATABASE_URL,
  ].filter(Boolean).map(value=>value?.trim());
  if (canonical.includes(url)) {
    throw new Error("Dedicated Sentinel connection must not reuse the GEM business database URI");
  }
  return {mode:"dedicated",url};
}

export function getSentinelDb(): PrismaClient {
  const config = resolveSentinelStorageConfig();
  if (config.mode === "shared") return db;
  if (!globals.gemSentinelPrisma) {
    globals.gemSentinelPrisma = new PrismaClient({
      datasources:{db:{url:config.url}},
      log:["error"],
    });
  }
  return globals.gemSentinelPrisma;
}
