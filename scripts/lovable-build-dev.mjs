// Lovable preview build ("build:dev"). Not used by Vercel.
// Prisma ships no engine binaries for NixOS, so fetch the Debian engines once
// and point Prisma at them, then run the canonical build script.
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

const isNix = existsSync("/etc/os-release") && /^ID=nixos$/m.test(readFileSync("/etc/os-release", "utf8"));
const env = { ...process.env, NEXT_DEV_TURBOPACK_ROOT: "/" };

if (isNix) {
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
  env.PRISMA_QUERY_ENGINE_LIBRARY = join(dir, "libquery_engine.so.node");
  env.PRISMA_SCHEMA_ENGINE_BINARY = join(dir, "schema-engine");
  env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = "1";
}

const result = spawnSync("node", ["scripts/vercel-build.mjs"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
