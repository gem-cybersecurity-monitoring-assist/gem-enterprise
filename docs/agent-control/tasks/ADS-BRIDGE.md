# ADS-BRIDGE

## Objective

Build a zero-spend, admin-only GEM Ads Bridge that preserves the approved GEM
Business Review campaign package and prepares bounded paid-preview and organic
handoff manifests without provider writes.

## Source

- Issue: #366
- Base SHA: `b147dc01b51ce889a082641d12a2d6abce5ff45c`
- Branch: `codex/zero-spend-ads-bridge`

## Owned files

- `src/lib/ads-bridge/**`
- `src/app/api/admin/ads-bridge/**`
- `src/app/api/v1/ads-bridge/**`
- `src/app/app/admin/ads-bridge/**`
- `src/__tests__/ads-bridge.test.ts`
- `public/images/gem-enterprise-logo.svg`
- `docs/ads-bridge.md`
- `openapi/gem-ads-bridge.openapi.yaml`
- `.env.example` variable-name-only documentation
- this task record
- the Ads Bridge entry in `docs/agent-control/ACTIVE-WORK.md`
- one discoverability link in `src/app/app/admin/campaigns/page.tsx`

## Forbidden overlap

- Social Autopilot policy, scheduler, service, routes, and UI
- TokMetric providers and publishing
- Prisma/schema/migrations
- provider credentials or production configuration
- billing, payment methods, or paid campaign activation

## Acceptance criteria

- Admin-only API and page
- Deterministic approved campaign package
- Strict paused and zero-budget enforcement
- No external provider write
- Approval-gated organic package
- Focused success, validation, authorization-contract, and fail-closed tests
- Full repository verification evidence

## Rollback

Revert the focused branch/PR. No database migration, provider mutation, or
production configuration change is involved.

## Verification evidence

- Focused Ads Bridge suite: PASS, 8/8 tests.
- Changed-file ESLint: PASS with zero warnings.
- OpenAPI YAML parse: PASS.
- `git diff --check`: PASS.
- Full Vitest suite: PARTIAL, 777 passed and 3 pre-existing Social Autopilot /
  social governance source-contract tests failed.
- Repository typecheck: BLOCKED by pre-existing Social Autopilot `ProcessEnv`
  test typing and Supabase `ImportMetaEnv` declarations; no Ads Bridge file was
  reported.
- Production build: application compilation passed, then stopped at the same
  pre-existing typecheck errors.
- `pnpm run verify`: BLOCKED because the local environment does not provide
  `POSTGRES_URL_NON_POOLING`. Its generated Prisma changes were removed and are
  not part of this task.
