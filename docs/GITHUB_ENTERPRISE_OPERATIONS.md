# GitHub enterprise operations

This workflow provides the no-Azure operational control plane for GEM Enterprise.

## Execution

- Every four hours: checks the public site, OpenAPI endpoint, private portal boundary, private admin boundary, security headers, TLS certificate lifetime, canonical production deployment, backend readiness, evidence-gateway readiness, and fail-closed database controls.
- Every Monday at 03:23 UTC: runs schema and public-claims checks, ESLint, TypeScript, all Vitest tests, the optimized Next.js build, and a high/critical production dependency audit.
- On demand: runs monitoring alone or monitoring plus the complete verification suite.

GitHub can delay scheduled jobs during periods of high load. Monitoring is therefore periodic, not a real-time availability SLA.

## Deployment boundary

Vercel's existing Git integration remains the deployment mechanism for `main`. This workflow does not hold a Vercel token, change production settings, run database migrations, or create Azure resources. A failed check blocks the workflow and creates visible GitHub evidence; it does not make an unapproved production mutation.

## Cost boundary

The repository is public, so standard GitHub-hosted runners are included without Actions-minute charges. The workflow uses standard Ubuntu runners only and does not use larger runners, Codespaces, GitHub Packages, paid security products, or Azure services.

## Automated dependency maintenance

Dependabot checks npm/pnpm dependencies weekly and groups patch-level production and development updates. It opens pull requests for review and never merges or deploys them automatically.
