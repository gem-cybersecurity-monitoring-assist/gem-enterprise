// Lovable sandbox helper. Prisma ships no engine binaries for NixOS, so on
// NixOS fetch the Debian engines once and return env vars pointing at them.
// On every other platform (including Vercel) this is a no-op.
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function isNixOS() {
  return (
    existsSync("/etc/os-release") &&
    /^ID=nixos$/m.test(readFileSync("/etc/os-release", "utf8"))
  );
}

export async function prismaEngineEnv() {
  if (!isNixOS()) return {};
  const pkg = JSON.parse(
    readFileSync("node_modules/@prisma/engines-version/package.json", "utf8"),
  );
  const hash = pkg.prisma?.enginesVersion;
  const dir = join("/tmp", "prisma-engines", hash);
  mkdirSync(dir, { recursive: true });
  const base = `https://binaries.prisma.sh/all_commits/${hash}/debian-openssl-3.0.x`;
  const files = [
    ["libquery_engine.so.node.gz", "libquery_engine.so.node"],
    ["schema-engine.gz", "schema-engine"],
  ];
  for (const [remote, local] of files) {
    const target = join(dir, local);
    if (existsSync(target)) continue;
    const res = await fetch(`${base}/${remote}`);
    if (!res.ok) throw new Error(`Prisma engine download failed: ${remote} ${res.status}`);
    writeFileSync(target, gunzipSync(Buffer.from(await res.arrayBuffer())));
    chmodSync(target, 0o755);
  }
  return {
    PRISMA_QUERY_ENGINE_LIBRARY: join(dir, "libquery_engine.so.node"),
    PRISMA_SCHEMA_ENGINE_BINARY: join(dir, "schema-engine"),
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1",
  };
}

// When run directly (postinstall): generate the Prisma client on NixOS so the
// type check has database types. Never fails the install.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (isNixOS()) {
    try {
      const env = {
        ...process.env,
        ...(await prismaEngineEnv()),
        POSTGRES_PRISMA_URL:
          process.env.POSTGRES_PRISMA_URL || "postgresql://schema:validation@127.0.0.1:5432/x",
        POSTGRES_URL_NON_POOLING:
          process.env.POSTGRES_URL_NON_POOLING || "postgresql://schema:validation@127.0.0.1:5432/x",
      };
      spawnSync("node", ["node_modules/prisma/build/index.js", "generate"], {
        stdio: "inherit",
        env,
      });
    } catch (error) {
      console.warn("Skipping Prisma generate:", error instanceof Error ? error.message : error);
    }
  }
}
