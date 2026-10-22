// Local dev server ("pnpm dev"). Cross-platform replacement for the POSIX-only
// `NEXT_DEV_TURBOPACK_ROOT=/ next dev`, which fails in PowerShell and CMD.
// Sets the Turbopack root to the filesystem root of the project ("/" on
// macOS/Linux, the drive root such as "C:\" on Windows) so Turbopack can follow
// node_modules symlinks outside the project, then runs Next.js via
// process.execPath so no shell or .cmd shim is needed.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const env = {
  ...process.env,
  NEXT_DEV_TURBOPACK_ROOT: process.env.NEXT_DEV_TURBOPACK_ROOT || path.parse(process.cwd()).root,
};

const result = spawnSync(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { stdio: "inherit", env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
