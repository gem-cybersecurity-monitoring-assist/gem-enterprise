import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(process.cwd(), "scripts/vercel-ignore.mjs");

function run(env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      VERCEL: "",
      CI: "",
      VERCEL_PROJECT_ID: "",
      VERCEL_PROJECT_PRODUCTION_URL: "",
      VERCEL_URL: "",
      VERCEL_BRANCH_URL: "",
      VERCEL_TARGET_ENV: "",
      VERCEL_ENV: "",
      VERCEL_GIT_COMMIT_REF: "",
      GEM_DEPLOYMENT_PROFILE: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("canonical Vercel project guard", () => {
  it("continues only for the canonical project ID", () => {
    const result = run({
      VERCEL_PROJECT_ID: "prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z",
      VERCEL: "1",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("canonical project ID");
  });

  it("continues when a canonical deployment marker is present", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_PROJECT_PRODUCTION_URL: "support371-gem-enterprise.vercel.app",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("canonical project marker detected");
  });

  it("ignores an explicitly non-canonical project", () => {
    const result = run({
      VERCEL_PROJECT_ID: "prj_legacy_duplicate",
      VERCEL: "1",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("non-canonical project ID");
  });

  it("ignores a known duplicate deployment marker", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_URL: "gem-enterprise-git-feature-example.vercel.app",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("known duplicate marker detected");
  });

  it("fails closed when Vercel identity is unavailable", () => {
    const result = run({ VERCEL: "1" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("identity could not be verified");
  });

  it("does not block local development", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("local non-Vercel environment");
  });
});
