export const platformEnvironment = {
  id: "gem-enterprise-production",
  domain: "gemcybersecurityassist.com",
  apiBaseUrl: "https://gemcybersecurityassist.com/api/v1",
  repository: "support371/gem-enterprise",
  repositoryOwner: "support371",
  repositoryName: "gem-enterprise",
  defaultBranch: "main",
  runtime: "serverless",
  status: "connected",
} as const;

export const deploymentPlan = {
  id: "gem-enterprise-production-plan",
  repository: platformEnvironment.repository,
  domain: platformEnvironment.domain,
  targetEnvironment: "production",
  buildCommand: "pnpm run build",
  startCommand: "pnpm start",
  healthCheckPath: "/api/v1/production/health",
  status: "ready",
} as const;

export const repositoryConnection = {
  id: "support371-gem-enterprise",
  provider: "github",
  owner: platformEnvironment.repositoryOwner,
  name: platformEnvironment.repositoryName,
  fullName: platformEnvironment.repository,
  url: "https://github.com/support371/gem-enterprise",
  defaultBranch: platformEnvironment.defaultBranch,
  status: "connected",
} as const;
