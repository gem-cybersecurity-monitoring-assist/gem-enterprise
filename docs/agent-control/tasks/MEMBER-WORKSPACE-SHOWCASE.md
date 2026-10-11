# Task Contract — MEMBER-WORKSPACE-SHOWCASE

Owner: Codex / community navigation lane. Issue: #389.
Base: `7175341a328b522fdf181bf4f5ee78d6c3376f41`.
Branch: `codex/community-member-workspace-showcase`.

## Objective and ownership

Make the existing private Sites member workspace discoverable from the enterprise Community navigation. Own only the new `src/components/community/MemberWorkspaceShowcase.tsx`, bounded insertions in `src/app/community/page.tsx`, `src/app/community-hub/layout.tsx`, and `src/app/app/community/page.tsx`, focused showcase tests, and this lane's control-plane entry. The current open workspace PRs #330/#331 do not overlap these files.

## Acceptance

- All three enterprise entry points display one shared panel explaining questions, discussions, ideas/recommendations, member profiles, and assigned AI services.
- Explicit top-level links open the published Site's `/community`, `/community/ai`, and `/community/members` routes in a new tab with safe opener handling.
- Do not embed or fetch private member data, reuse a service credential, bypass sign-in, imply shared identity, or grant workspace/service access from enterprise login.
- Preserve all existing content, preview notices, and route/auth behavior. Scope the existing fictional-data notice to preview pages so the separately linked workspace is distinguishable.

## Exclusions and gates

No Prisma, authentication, provider, billing, access-policy, or production changes. No unrelated workspace lanes or reserved PR files. Local focused checks plus canonical Vercel preview are required before merge review. Full verification must be reported accurately if configuration blocks it. No merge is authorized in this request.

Rollback: revert the focused integration commit. It has no data migration or provider side effect.

## Validation evidence

- Frozen lockfile install with pnpm 10.28.0 succeeded.
- Focused Vitest suite: 6 tests passed across the component and actual three entry points.
- Scoped ESLint and `git diff --check` passed.
- Canonical `pnpm run verify` with pnpm 10.28.0 stops at Prisma validation because `POSTGRES_URL_NON_POOLING` is absent. Later lint/typecheck/full tests/build gates were not reached. Schema-promotion output was reverted; no Prisma changes are included.
- Hosted canonical preview and owner merge authorization remain pending.
