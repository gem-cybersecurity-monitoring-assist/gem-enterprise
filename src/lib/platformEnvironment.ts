export const platformEnvironment = {
  id: "gem-enterprise-production",
  domain: "gemcybersecurityassist.com",
  apiBaseUrl: "https://gemcybersecurityassist.com/api/v1",
  repository: "support371/gem-enterprise",
  repositoryOwner: "support371",
  repositoryName: "gem-enterprise",
  defaultBranch: "main",
  runtime: "serverless",
  status: "configured",
} as const;

export const deploymentPlan = {
  id: "gem-enterprise-production-plan",
  repository: platformEnvironment.repository,
  domain: platformEnvironment.domain,
  targetEnvironment: "production",
  buildCommand: "pnpm run build",
  startCommand: "pnpm start",
  healthCheckPath: "/api/v1/production/health",
  status: "unverified",
} as const;

export const repositoryConnection = {
  id: "support371-gem-enterprise",
  provider: "github",
  owner: platformEnvironment.repositoryOwner,
  name: platformEnvironment.repositoryName,
  fullName: platformEnvironment.repository,
  url: "https://github.com/support371/gem-enterprise",
  defaultBranch: platformEnvironment.defaultBranch,
  status: "configured",
} as const;

// Configuration describes intended wiring; it does not establish provider health.
export function platformConfigurationEvidence() {
  return {
    checkedAt: new Date().toISOString(),
    source: "server_configuration",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    deploymentEnvironment: process.env.VERCEL_ENV || "local",
    operationallyVerified: false,
  };
}
