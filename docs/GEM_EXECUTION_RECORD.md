# GEM Execution Record

Single running record of delivery state. **Implemented ≠ tested ≠ merged ≠ deployed ≠ verified in production.** Update this file in place; do not add parallel status documents.

**Last updated:** 2026-10-23.
**Production:** Vercel project `support371-gem-enterprise`, deployment `dpl_C1mvCz68…`, READY, built from `main` `100528f8` (PR #455; read via Vercel API 2026-10-23, no runtime errors in the preceding 24 hours) (read via Vercel API). Production now runs the restored `9f1da4f` lineage (PR #451, owner-approved 2026-10-22).

## Work items

| # | Item | Ref | Implemented | Tested | Merged | Deployed | Verified in prod | Blocker / next action |
|---|---|---|---|---|---|---|---|---|
| 1 | GitHub Actions SHA pins | PR #443, `8e17a857` | yes | CI green on PR | **yes** | **yes** | Workflows run on `main` | — |
| 2 | Route inventory, runbook, probes, authz harness, migration-integrity and security reports, read-only Supabase audit pack, Windows build fix, `CLAUDE.md` DB-command warning | PR #440, `941c7067` | yes | CI green on `532cfc34` (Build Verification, Tracked Secret Scan, GitGuardian, Socket) | **yes** | **yes** (`dpl_5ZeimNEs…`) | Docs, scripts and tests only; no runtime change | — |
| 3 | Proxy dotted-path bypass fix and bootstrap-status least privilege | PR #445, `04fa2f52` | yes | CI green on `c09f7e98`; preview probes passed | **yes** | **yes** (`dpl_2dSgPYdu…`) | **yes** (2026-10-19, anonymous GET via Vercel API): `/app/portfolios/x.y` redirects to `/client-login?next=…`; `/api/system/bootstrap-status` returns only `ok, service, evaluatedAt, core.ready, detailsRequireAdministrator`. Before the fix both were exposed in production. | — |
| 4 | Router slug conflict fix | local `fix/gem-route-runtime-access` `f2291ad` | yes | Local build, `next start` probe 258/258 | no | n/a | n/a | Only affects the `9f1da4f` lineage; not needed on `main`. Keep until the lineage decision. |
| 5 | Separate business and personal customer journeys | PR #434, `1222b638` | yes | CI green; `pnpm run verify` exit 0 | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | — | Owner review of public copy still advised. |
| 6 | Wix referral attribution | PR #435, `5eaa4846` | yes | CI green; `pnpm run verify` exit 0 | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | — | Release gate in its PR still applies before promotion. |
| 7 | Wix market-entry admin console | PR #436, `246dc3c9` | yes | CI green; `pnpm run verify` exit 0 | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | — | Admin-only; release gate in its PR still applies. |
| 8 | Launch content pack in social workspace | PR #437, `d0fc59c3` | yes | CI green; review fixes (X caption 254 chars, YouTube channel removed, badge sizes) | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | — | Social posts stay in draft; paid advertising stays paused. |
| 9 | Production RLS / grant exposure | `docs/security/gem-supabase-readonly-audit.sql` | pack ready | Run read-only on production 2026-10-19 (owner-approved) | — | — | **verified: no exposure** | No CRITICAL, HIGH or REVIEW findings. One defence-in-depth hardening decision remains with the owner. Detailed results are kept outside the repository. |
| 10 | Migrations deleted from `main` by `a72f063` | 4 migrations listed in `docs/GEM_MIGRATION_INTEGRITY_20261017.md` | — | Still absent from `main` at `04fa2f52` | — | — | **verified: not applied** | Superseded by rows 19 and 22: lineage restored and production schema updated 2026-10-22. |
| 11 | Production smoke tests | — | — | — | — | — | **partial** | Direct egress is blocked by the network policy. Anonymous GETs through the Vercel API work (see #3). Signed-in flows not tested. |
| 12 | `recovery-readiness` least privilege | PR #448, `2be5bb6e` | yes | 4 new tests; CI green | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | **yes** (2026-10-19, anonymous GET): returns only `ok, service, emailDeliveryConfigured, detailsRequireAdministrator`; `Cache-Control: no-store`. | Owner action pending (see owner gates). |
| 13 | AI capability upgrade baseline | PR #439, `89782007` | yes | CI green | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | — | Docs only. |
| 14 | Dependency group update (6 packages) | PR #442, `063aac67` | — | CI green on `a5304d57` | **yes** | **yes** (in `2c5fc09b`) | — | — |
| 15 | Social and TokMetric connections | production tables | — | Read-only counts 2026-10-19 | — | — | **verified: none** | No connections exist in the social or TokMetric connector tables. Accounts connected on external builder sites did not reach this app; each must be connected through the app's own OAuth start routes once provider credentials are set. |
| 16 | Remaining open PRs | 37 PRs (#111–#433) | — | Merge check against `main` `36f7ed6b`, 2026-10-22 | no | no | — | After the restore, 21 merge cleanly and 16 conflict (#111, #114, #221, #242, #244, #271, #287, #314, #330, #331, #342, #351, #362, #363, #364, #369). None is already contained in `main`. Most are drafts; each needs its own review before merging, and #341 (Klarna) and #365 (Experian) touch payment and credit providers, which need owner approval. |
| 17 | Claude Code plugin moved to `plugins/gem-enterprise` | PR #446, `72b33edf` | yes | CI green | **yes** | **yes** (`dpl_DT2PxmSA…`) | — | — |
| 18 | `@vitest/mocker` 4.1.4 → 5.0.5 | PR #449, `2c5fc09b` | — | CI green | **yes** | **yes** (`dpl_J65Fw3aV…`) | — | — |
| 19 | Restore `9f1da4f` lineage (revert `a72f063`) | PR #451, `36f7ed6b` | yes | `pnpm run verify` on `6d737640`: 179 files / 1225 tests, build OK; CI green | **yes** | **yes** (`dpl_BxDeykud…`) | **yes** (2026-10-22): `/api/health` ok on `36f7ed6b`, database ok; status endpoints return only minimal anonymous fields; `/app/portfolios/x.y` redirects to `/client-login`; no runtime errors in the first 30 minutes | — |
| 22 | Production schema for the restored lineage | Supabase migrations `social_provider_tiktok_and_pause`, `unified_client_workspace_os`, `social_metric_snapshots`, `social_provider_telegram` | yes | Read-only check after apply | n/a | **applied** 2026-10-22 (owner-approved) | **yes** | 6 new tables (`social_provider_pauses`, `capability_readiness_overrides`, `lifecycle_funnel_states`, `social_metric_snapshots`, `provider_account_metrics`, `social_metric_sync_runs`), all with RLS on and no policies. Provider checks now allow TIKTOK and TELEGRAM. Additive only; no data changed. Supersedes row 10. |
| 20 | Social and TikTok activation checklist | PR #450 | yes | CI green | — | n/a (docs) | — | `docs/social-media/PROVIDER_ACTIVATION_CHECKLIST.md`. |
| 21 | Production smoke after redeploy | — | — | Anonymous GET via Vercel API, 2026-10-20 | — | — | **yes** | `/api/auth/recovery-readiness` and `/api/system/bootstrap-status` return only their minimal anonymous fields; `core.ready` is `true`. |
| 23 | Migration baselines (production rebuildable) | `20260712225000_baseline_admin_access_tokens`, `20261023000100_baseline_db_push_tables` (branch `fix/migration-baseline-20261023`) | yes | Chain replay into a disposable PostgreSQL 16 database with the Supabase stub (platform objects only): 45 applied, 0 skipped; both baselines re-run as no-ops. Definitions taken from a read-only catalog capture of production, 2026-10-23. | pending | no (not applied to production by design) | — | Production tracks its own Supabase migration history and has no `_prisma_migrations`; do not run `migrate deploy` or `migrate resolve` against it without a separate owner-approved plan. |
| 24 | Dependency group update | PR #452, `55ef78d` | — | CI green | **yes** | **yes** (in `100528f8`) | — | — |
| 25 | Restore local `next dev`/`next start` routing; Windows developer setup | PR #455, `100528f8` | yes | CI green | **yes** | **yes** (`dpl_C1mvCz68…`) | — | `scripts/setup-windows-dev.ps1`. |
| 26 | CI migration chain replay | `.github/workflows/ci.yml` job `migration-replay` (branch `fix/migration-baseline-20261023`) | yes | Same script run locally against PostgreSQL 16: 45 applied, 0 skipped | pending | no | — | Uses the Supabase stub for platform objects only. |

## Owner gates

- Provider app credentials (social/TikTok) in Vercel, then connect each account through the app.
- Other owner gates (credentials, database hardening decisions) are tracked outside the repository.
