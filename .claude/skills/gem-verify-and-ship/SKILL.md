---
name: gem-verify-and-ship
description: Install, verify, test and ship changes in GEM Enterprise. Use to set up a fresh environment, to run checks before a pull request, or when a check fails because of missing environment variables.
---

# Verify and ship

## Environment

- Node.js 24.x, `pnpm@10.28.0` only (`corepack enable`). Never npm or yarn.
- Install: `pnpm install --frozen-lockfile`.
- Prisma and the build need these placeholders when no real configuration exists. They are the same non-secret values CI uses in `.github/workflows/ci.yml`:

```bash
export NODE_ENV=test
export JWT_SECRET=ci-test-secret-min-32-characters-long-placeholder
export POSTGRES_PRISMA_URL=postgresql://ci:ci@localhost:5432/gem_ci
export POSTGRES_URL_NON_POOLING=postgresql://ci:ci@localhost:5432/gem_ci
export CRON_SECRET=ci-cron-secret
```

Without the two database variables, `pnpm run db:generate` fails with Prisma error P1012. That is configuration, not a code failure.

## Checks

| Command | What it runs |
|---|---|
| `pnpm run db:generate` | Schema promote, validate, Prisma client |
| `pnpm run lint` | ESLint, zero warnings allowed |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm run claims:check` | Public-claims register |
| `pnpm run verify` | All of the above plus the production build |

Run `pnpm run verify` before opening a pull request. For quick loops, run the focused test file: `pnpm vitest run src/__tests__/<file>.test.ts`.

## Shipping

1. Branch from current `main`; one feature per pull request.
2. Fill in `.github/pull_request_template.md`: what was built, what is disabled, owner activation steps.
3. CI ("Lint, Typecheck, Test, Build" and the credential scan) and the canonical Vercel preview must pass.
4. Vercel's Git integration deploys `main` to production. Never deploy by another route.
5. Report results exactly: a check that did not run is "not run", never "passed".
