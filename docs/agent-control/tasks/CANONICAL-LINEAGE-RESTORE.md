# CANONICAL-LINEAGE-RESTORE

## TASK ID
CANONICAL-LINEAGE-RESTORE

## TITLE
Restore the `9f1da4f` canonical lineage on `main` (revert of Lovable merge `a72f063`)

## OWNER
Claude Code / lineage-restore lane. Owner decision recorded 2026-10-19: "Full main restore PR".

## SOURCE PR/ISSUE
`docs/GEM_MIGRATION_INTEGRITY_20261017.md` §5 step 3; `docs/GEM_EXECUTION_RECORD.md` rows 10, 15, 16 and "Canonical-lineage / `a72f063` revert decision".

## CURRENT MAIN SHA
`dccc65810036db830de5c356dce2a8d6f83004f1`

## SOURCE HEAD SHA
Canonical lineage: `9f1da4f0921ff44b9f895dd911075aba972514ad` (first parent of `a72f063`).

## WORKING BRANCH
`restore/canonical-lineage`

## OBJECTIVE
Return the 86 commits that `a72f063` discarded (social provider lifecycle, TikTok and Telegram provider lanes, provider pause controls, social metrics, unified client workspace OS, and the four Prisma migrations) while keeping every change merged to `main` after `a72f063`.

## NON-GOALS
- No production database writes. Applying migrations is a separate owner-executed step (see HUMAN GATES).
- No provider credential changes, env var changes or production activation.
- No new features. Lead Inbox and any other new work land in separate PRs after this one.

## KNOWN CURRENT STATE
- Production runs post-Lovable `main`. Its schema comes from Supabase migrations; it has no `_prisma_migrations` table.
- The four migrations removed by `a72f063` were never applied in production. `social_connectors` allows only META, X, LINKEDIN, YOUTUBE, NEXTDOOR.

## KNOWN DEFECT / MISSING CAPABILITY
`main` lacks the Telegram and TikTok social provider lanes, provider pause controls, social metrics and workspace OS models that exist on the canonical lineage.

## OWNED FILES
The full tree delta of `git revert -m 1 a72f063` on current `main`, plus conflict resolutions and this task record.

## FORBIDDEN FILES
None beyond the revert delta. No edits to production configuration.

## IMPLEMENTATION REQUIREMENTS
Resolution rules applied:
1. `.github/workflows/*`: keep `main` (#443 full-SHA pins; codeql-action v4.39.0 is newer than the lineage pin).
2. `package.json` / `pnpm-lock.yaml`: dependencies byte-equal to `9f1da4f`; the lockfile is the `9f1da4f` lockfile. It meets or exceeds every #442 Dependabot floor (next 16.3.8, nodemailer 10.1.0, sharp 0.35.5, postcss 8.5.23/8.5.29, nanoid 3.3.20, source-map-js 1.2.2). Lovable's `dev` and `build:dev` scripts are kept.
3. `prisma/schema.prisma`: union of both sides' `User` relations (communication-governance and customer-success from `main`; capability-readiness and lifecycle-funnel from the lineage). All five `db:schema:check:*` scripts pass; no duplicate fields or models.
4. Two social tests take the lineage's stricter assertions; the restored routes and worker satisfy them.
5. `roadmap.md` kept from `main`.
6. Lovable's 11-file net change (`b147dc01..77d3796`) re-applied. Duplicate `SocialEnvSource` declarations it introduced were removed; `src/integrations/supabase/types.ts` keeps the lineage's PostgrestVersion `14.5`.
7. `prisma/migrations` are byte-identical to `9f1da4f` (checksums preserved).

## SECURITY BOUNDARIES
Verified present after the revert, line for line: #445 (proxy dotted-path bypass, bootstrap-status disclosure) and #448 (recovery-readiness disclosure). Every post-`a72f063` commit was audited; the only lines absent are ones superseded by later `main` commits or the stricter test assertions above.

## TEST PLAN
### CONFIGURATION-INDEPENDENT TESTS
`pnpm install --frozen-lockfile && pnpm run verify:preview` in CI (Build Verification) and the Vercel preview build. These could not run in the authoring session (npm registry unreachable there); exact-head CI evidence is required.

### CONFIGURATION-DEPENDENT TESTS
After the HUMAN GATES migration step: `/app/social-media/accounts` loads; `GET /api/social-media/connectors` returns 200; pause and health endpoints no longer return `SOCIAL_PROVIDER_PAUSE_STORE_NOT_PROVISIONED`.

## ACCEPTANCE CRITERIA
- Exact-head CI and Vercel preview green.
- No conflict markers; migrations byte-identical to `9f1da4f`.
- Owner confirms the four migrations are applied in production before merge.

## ROLLBACK POINT
Code: revert the merge commit of this PR (restores current `main`). Database: the four migrations are additive except the provider CHECK constraint replacements, which can be re-created with the previous provider list.

## HUMAN GATES
**Merge order is mandatory.** Without the restored tables, `GET /api/social-media/connectors` (the Accounts page), the connector health route, the daily orchestrator and autopilot fail closed with HTTP 503 `SOCIAL_PROVIDER_PAUSE_STORE_NOT_PROVISIONED`, and the analytics routes error.
1. Backup / PITR confirmed for the production Supabase project.
2. Owner applies, in this order, through the controlled production path (Supabase SQL editor or reviewed migration run):
   1. `prisma/migrations/20260929120000_social_provider_tiktok_and_pause/migration.sql`
   2. `prisma/migrations/20260929120000_unified_client_workspace_os/migration.sql`
   3. `prisma/migrations/20260929121500_social_metric_snapshots/migration.sql`
   4. `prisma/migrations/20260929130000_social_provider_telegram/migration.sql`
3. Verify: the six tables exist (`social_provider_pauses`, `capability_readiness_overrides`, `lifecycle_funnel_states`, `social_metric_snapshots`, `provider_account_metrics`, `social_metric_sync_runs`); `social_connectors_provider_check` includes TIKTOK and TELEGRAM; RLS/grant posture matches the 2026-10-19 audit (no new API-role exposure).
4. Merge this PR.

## RETURN FORMAT
PR link, exact head SHA, CI and preview results, migration evidence.

## SUPERSESSION CONDITIONS
Supersedes the "lineage decision" blockers in `GEM_EXECUTION_RECORD.md` rows 15–16. Draft PRs #425–#433 and #362–#369 should be re-evaluated against `main` after this merges.

## MERGE GATE
Per `MERGE-GATES.md`, plus HUMAN GATES above.
