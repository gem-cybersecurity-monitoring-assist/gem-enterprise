# GEM Enterprise Copilot instructions

## Runtime and verification
- Use Node.js 24.x and pnpm 10.28.0.
- Install dependencies with `pnpm install --frozen-lockfile`.
- Before declaring an application change complete, run `pnpm run verify` when the execution environment supports it.
- For routing, authentication, authorization, user-facing flows, or API behavior, also run `pnpm run test:e2e` when a browser-capable runner is available.
- Never report a hosted CI gate as passed when its runner did not allocate a workflow step.
- When GitHub-hosted Actions is `INFRA_BLOCKED`, preserve the workflows and follow `docs/CI-PROVIDER-INDEPENDENCE.md`: exact-head authoritative Vercel Preview, repository preview verification/build evidence, deployment smoke verification, and runtime-log review.

## Security boundaries
- Preserve fail-closed authentication and authorization behavior.
- Never bypass role or tenant/client authorization to make a test pass.
- Never hardcode secrets, credentials, tokens, production connection strings, or deployment-protection bypass values.
- Treat cross-client and cross-tenant isolation as a security boundary.
- Security fixes require regression tests.
- Do not disable tests, linting, typechecking, CodeQL, browser E2E, or security gates to work around provider, billing, runner, or infrastructure failures.

## Change control
- Prefer the smallest scoped change that satisfies the task.
- Do not modify `.github/workflows/**`, `.github/actions/**`, `.github/copilot-instructions.md`, or release-governance files unless the task explicitly authorizes governance changes.
- Do not write directly to `main`; deliver repository changes through a pull request.
- Human merge authorization remains separate from technical readiness.
- Document material assumptions, exact-head evidence, and infrastructure blockers in the pull request.
