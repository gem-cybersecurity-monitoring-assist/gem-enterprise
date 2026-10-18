import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const localBaseUrl = `http://127.0.0.1:${port}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl;
const isCI = Boolean(process.env.CI);

const testServerEnv = {
  JWT_SECRET:
    process.env.JWT_SECRET ?? "TEST_ONLY_LOCAL_E2E_JWT_SECRET_DO_NOT_REUSE_1234567890",
  POSTGRES_PRISMA_URL:
    process.env.POSTGRES_PRISMA_URL ?? "postgresql://e2e:e2e@127.0.0.1:5432/gem_e2e",
  POSTGRES_URL_NON_POOLING:
    process.env.POSTGRES_URL_NON_POOLING ?? "postgresql://e2e:e2e@127.0.0.1:5432/gem_e2e",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? localBaseUrl,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "GEM Enterprise",
  NEXT_PUBLIC_AI_DISCLOSURE_TEXT:
    process.env.NEXT_PUBLIC_AI_DISCLOSURE_TEXT ??
    "GEM Concierge is an AI assistant. Responses are informational and require human review for sensitive decisions.",
  AUDIT_ENABLED: process.env.AUDIT_ENABLED ?? "true",
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: process.env.SMTP_PORT ?? "587",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  CRON_SECRET: process.env.CRON_SECRET ?? "TEST_ONLY_LOCAL_E2E_CRON_SECRET_DO_NOT_REUSE",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: isCI
          ? `pnpm run build && pnpm exec next start -H 127.0.0.1 -p ${port}`
          : `pnpm exec next dev -H 127.0.0.1 -p ${port}`,
        url: localBaseUrl,
        reuseExistingServer: !isCI,
        timeout: isCI ? 240_000 : 120_000,
        env: testServerEnv,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
