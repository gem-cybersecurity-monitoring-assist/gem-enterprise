import { spawnSync } from "node:child_process";

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

// Windows: Node ships node.exe (no node.cmd), and since CVE-2024-27980 Node
// refuses to spawn .cmd shims without a shell. Run node via process.execPath
// and pnpm via its JS entry point (npm_execpath) so no shell is needed.
function resolveCommand(command, args, env) {
  if (process.platform !== "win32") return [command, args];
  if (command === "node") return [process.execPath, args];
  const execPath = env.npm_execpath || "";
  if (command === "pnpm" && /pnpm[^\\/]*\.c?js$/i.test(execPath)) return [process.execPath, [execPath, ...args]];
  if (command === "pnpm" && /pnpm[^\\/]*\.exe$/i.test(execPath)) return [execPath, args];
  throw new Error(
    `Cannot resolve "${command}" on Windows without a shell. Run this build through "corepack pnpm run build" so npm_execpath points at pnpm.`,
  );
}

function run(command, args, env) {
  const [executable, finalArgs] = resolveCommand(command, args, env);
  const result = spawnSync(executable, finalArgs, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

const env = { ...process.env };
const pooledUrl = firstDefined(
  env.POSTGRES_PRISMA_URL,
  env.DATABASE_URL,
  env.POSTGRES_URL,
  env.NEON_DATABASE_URL,
);
const directUrl = firstDefined(
  env.POSTGRES_URL_NON_POOLING,
  env.DATABASE_URL_UNPOOLED,
  env.POSTGRES_URL_NO_SSL,
  pooledUrl,
);
if (pooledUrl) env.POSTGRES_PRISMA_URL = pooledUrl;
if (directUrl) env.POSTGRES_URL_NON_POOLING = directUrl;

if (env.AUTO_DB_PUSH === "true" || env.AUTO_DB_SEED === "true") {
  throw new Error(
    "Automatic database bootstrap is disabled for production-safe GEM builds. Prisma db push cannot apply SQL-only CHECK, RLS, trigger, and grant/revoke controls. Apply reviewed migrations through the controlled production migration path, verify the security invariants, and keep AUTO_DB_PUSH/AUTO_DB_SEED=false.",
  );
}

console.log("Promoting auth session-version Prisma field...");
run("node", ["scripts/apply-auth-session-prisma.mjs"], env);
console.log("Promoting separated-intake Prisma models...");
run("node", ["scripts/apply-intake-prisma-models.mjs"], env);
console.log("Promoting scoped service-request Prisma fields...");
run("node", ["scripts/apply-service-request-prisma.mjs"], env);
console.log("Promoting customer-success Prisma models...");
run("node", ["scripts/apply-customer-success-prisma.mjs"], env);
console.log("Promoting communication-governance Prisma models...");
run("node", ["scripts/apply-communication-governance-prisma.mjs"], env);

const schemaValidationUrl = "postgresql://schema:validation@127.0.0.1:5432/schema_validation";
const schemaValidationEnv = {
  ...env,
  POSTGRES_PRISMA_URL: pooledUrl || schemaValidationUrl,
  POSTGRES_URL_NON_POOLING: directUrl || pooledUrl || schemaValidationUrl,
};

console.log("Validating Prisma schema...");
run("pnpm", ["exec", "prisma", "validate"], schemaValidationEnv);
console.log("Generating Prisma client...");
run("pnpm", ["exec", "prisma", "generate"], schemaValidationEnv);

const shouldVerifyPreview =
  env.VERCEL_ENV === "preview" ||
  (env.VERCEL_ENV !== "production" &&
    env.RUN_PREVIEW_VERIFICATION === "true");
if (shouldVerifyPreview) {
  console.log("Running preview verification: lint, typecheck, and unit tests...");
  const verificationEnv = {
    ...env,
    NODE_ENV: "test",
    JWT_SECRET: "preview-verification-secret-min-32-characters",
    POSTGRES_PRISMA_URL: "postgresql://ci:ci@localhost:5432/gem_ci",
    POSTGRES_URL_NON_POOLING: "postgresql://ci:ci@localhost:5432/gem_ci",
    SMTP_HOST: "",
    SMTP_PORT: "587",
    SMTP_USER: "",
    SMTP_PASS: "",
    CRON_SECRET: "preview-verification-cron-secret",
    AUDIT_ENABLED: "true",
  };
  run("pnpm", ["run", "verify:preview"], verificationEnv);
}

console.log("Building Next.js application...");
run("pnpm", ["exec", "next", "build"], env);
