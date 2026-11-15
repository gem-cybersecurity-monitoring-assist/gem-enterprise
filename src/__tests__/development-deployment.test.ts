import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/vercel-ignore.mjs");
const policy = pathToFileURL(path.resolve("scripts/development-deployment-policy.mjs")).href;
const config = JSON.parse(readFileSync("vercel.development.json", "utf8"));
const baseEnv = {
  VERCEL: "1", CI: "", VERCEL_PROJECT_ID: "prj_BcEaEo1E25IOw30KcGQBfwIoVCQ9",
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "deploy/gem-enterprise-development",
  GEM_DEPLOYMENT_PROFILE: "development", VERCEL_URL: "", VERCEL_BRANCH_URL: "",
  VERCEL_PROJECT_PRODUCTION_URL: "", VERCEL_TARGET_ENV: "",
};

function run(env: Record<string, string> = {}, selected = config) {
  const cwd = mkdtempSync(path.join(tmpdir(), "gem-deployment-"));
  try {
    writeFileSync(path.join(cwd, "vercel.json"), JSON.stringify(selected));
    return spawnSync(process.execPath, [script], {
      cwd, env: { ...process.env, ...config.env, ...baseEnv, ...env }, encoding: "utf8",
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}

describe("isolated development deployment", () => {
  it("allows only the exact opted-in preview branch with its selected safe config", () => {
    expect(run().status).toBe(1);
  });
  it.each([
    { VERCEL_PROJECT_ID: "prj_unknown" },
    { VERCEL_PROJECT_ID: "prj_legacy_duplicate" },
    { VERCEL_PROJECT_ID: "" },
    { VERCEL_PROJECT_ID: "prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z" },
    { GEM_DEPLOYMENT_PROFILE: "" },
    { VERCEL_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_GIT_COMMIT_REF: "" },
    { SOCIAL_AUTOPILOT_ENABLED: "true" },
    { SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED: "true" },
    { GEM_SUPABASE_GATEWAY_BASE_URL: "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1" },
    { GEM_SUPABASE_GATEWAY_BASE_URL: "" },
    { GEM_INTAKE_GATEWAY_URL: "" },
    { NEXT_PUBLIC_APP_URL: "https://www.gemcybersecurityassist.com" },
  ])("fails closed for wrong identity, target, branch, opt-in or live gates: %j", (env) => {
    expect(run(env).status).toBe(0);
  });
  it("rejects the canonical build command even inside the allowed development project", () => {
    expect(run({}, { ...config, buildCommand: "pnpm run build" }).status).toBe(0);
  });
  it("rejects a cron definition rather than relying only on an environment override", () => {
    expect(run({}, { ...config, crons: [{ path: "/api/cron", schedule: "0 0 * * *" }] }).status).toBe(0);
  });
  it("rejects production callback or database references in the selected config", () => {
    expect(run({}, { ...config, env: { ...config.env, META_OAUTH_REDIRECT_URI: "https://www.gemcybersecurityassist.com/callback" } }).status).toBe(0);
  });
  it.each(Object.keys(config.env).filter((key) => /PUBLISHING|AUTO_APPROVAL|AUTOPILOT_ENABLED|AUTO_DB|SEED_DEMO/.test(key)))("rejects enabled or missing %s", (key) => {
    expect(run({}, { ...config, env: { ...config.env, [key]: "true" } }).status).toBe(0);
  });
});

const direct = "postgresql://postgres:unit-test-only@db.dusqdnebwkoycdtjkhyy.supabase.co:5432/postgres?sslmode=require&sslaccept=strict";
const pooler = "postgresql://postgres.dusqdnebwkoycdtjkhyy:unit-test-only@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&sslaccept=strict";
function credentials(env: Record<string, string>) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", `import { developmentCredentialError } from ${JSON.stringify(policy)}; console.log(developmentCredentialError(process.env) ?? "OK");`], {
    env: { NODE_ENV: "test", POSTGRES_PRISMA_URL: pooler, POSTGRES_URL_NON_POOLING: direct, JWT_SECRET: "unit-test-only-signing-secret-not-a-real-key", ...env }, encoding: "utf8",
  }).stdout.trim();
}
describe("development credential target validation", () => {
  it("accepts exact development direct/pooler targets with strict TLS", () => expect(credentials({})).toBe("OK"));
  it("accepts only the explicit dedicated runtime role on the same development database", () => {
    expect(credentials({ POSTGRES_PRISMA_URL: pooler.replace("postgres.", "gem_dev_runtime."), POSTGRES_URL_NON_POOLING: direct.replace("//postgres:", "//gem_dev_runtime:") })).toBe("OK");
  });
  it.each([
    { POSTGRES_PRISMA_URL: "" }, { POSTGRES_URL_NON_POOLING: "" }, { JWT_SECRET: "" },
    { POSTGRES_PRISMA_URL: direct.replace("dusqdnebwkoycdtjkhyy", "slzdjoqpzbkwzuaexlkj") },
    { POSTGRES_PRISMA_URL: pooler.replace("postgres.dusqdnebwkoycdtjkhyy", "postgres.otherproject") },
    { POSTGRES_PRISMA_URL: pooler.replace("postgres.", "unapproved_role.") },
    { POSTGRES_URL_NON_POOLING: direct.replace("//postgres:", "//unapproved_role:") },
    { POSTGRES_PRISMA_URL: pooler.replace("pooler.supabase.com", "pooler.supabase.com.example.org") },
    { POSTGRES_PRISMA_URL: direct.replace("sslaccept=strict", "sslaccept=accept_invalid_certs") },
    { POSTGRES_PRISMA_URL: direct + "&sslmode=disable&sslaccept=accept_invalid_certs" },
    { POSTGRES_PRISMA_URL: direct + "&sslmode=require" },
    { POSTGRES_PRISMA_URL: "not-a-url-unit-test-only" },
  ])("rejects missing, mixed, non-TLS or invalid private configuration without printing it: %j", (env) => {
    const result = credentials(env);
    expect(result).not.toBe("OK");
    expect(result).not.toContain("unit-test-only");
    expect(result).not.toContain("postgresql://");
  });
});
