# GEM Execution Record

Single running record of delivery state. **Implemented ≠ tested ≠ merged ≠ deployed ≠ verified in production.** Update this file in place; do not add parallel status documents.

**Last updated:** 2026-10-18.
**Production:** Vercel project `support371-gem-enterprise`, deployment `dpl_CPQgnXqF9UkGR8aPMahCiCaJJ9KU`, READY, built from `main` `8e17a857` (read via Vercel API). Production runs the post-Lovable `main` tree, not the `9f1da4f` lineage.

## Work items

| # | Item | Ref | Implemented | Tested | Merged | Deployed | Verified in prod | Blocker / next action |
|---|---|---|---|---|---|---|---|---|
| 1 | GitHub Actions SHA pins | PR #443, `8e17a857` | yes | CI green on PR | **yes** | **yes** (`dpl_CPQgnX…`) | Workflows run on `main` | — |
| 2 | Route inventory, runbook, probes, authz harness, migration-integrity and security reports, read-only Supabase audit pack, Windows build fix, `CLAUDE.md` DB-command warning | PR #440 + local `47fea9e`…`df968d53` | yes | Simulated merge onto `8e17a857`: `pnpm run verify` exit 0, 133 files / 778 tests, build OK, secret scan OK | no | no | — | **Push denied by this session's permission policy.** PR shows `unstable` only because its last CI ran before #443. Next: push branch, let CI run, then merge. |
| 3 | Proxy dotted-path bypass fix and bootstrap-status least privilege (`main` lineage) | local `fix/gem-access-hardening-main` `9c4baee1`, `c09f7e98` (rebased on `8e17a857`) | yes | `pnpm run verify` exit 0, 134 files / 788 tests; 10 proxy + 4 disclosure tests | no | no | — | Both issues are **live in production** (production runs `main`). Push and PR blocked as in #2. Next: push, PR to `main`, merge after CI. |
| 4 | Router slug conflict fix | local `fix/gem-route-runtime-access` `f2291ad` | yes | Local build, `next start` probe 258/258 | no | n/a | n/a | Only affects the `9f1da4f` lineage; not needed on `main`. Keep until the lineage decision. |
| 5 | Separate business and personal customer journeys | PR #434 | yes (PR author) | Merge onto `8e17a857`: verify exit 0, 779 tests, build OK. Two static public pages, no forms or fetch | no | no | — | Mergeable. Next: re-run CI (stale), then merge after #440/#3. |
| 6 | Wix referral attribution | PR #435 (draft) | yes | Merge onto main: verify exit 0, 776 tests | no | no | — | Draft. Additive campaign sources only. Next: mark ready, CI, merge. |
| 7 | Wix market-entry admin console | PR #436 (draft) | yes | Merge onto main: verify exit 0, 778 tests | no | no | — | Draft. Admin page under `/app/admin` (proxy admin gate). Next: mark ready, CI, merge. |
| 8 | Launch content pack in social workspace | PR #437 | yes | Merge onto main: verify exit 0, 779 tests | no | no | — | Next: CI, merge. |
| — | Full integration sequence 3 → 2 → 5 → 6 → 7 → 8 on `8e17a857` | simulated locally | — | No conflicts; verify exit 0, **138 files / 808 tests**, build OK, secret scan OK | — | — | — | Order above is the recommended merge order. |
| 9 | Production RLS / grant exposure | `docs/security/gem-supabase-readonly-audit.sql` | pack ready | Validated on disposable DBs | — | — | **unverified** | Read-only Supabase advisor call was **denied** by this session's permission policy. Owner runs the pack, or grants the session read-only access. |
| 10 | Migrations deleted from `main` by `a72f063` | 4 migrations listed in `docs/GEM_MIGRATION_INTEGRITY_20261017.md` | — | Still absent from `main` at `8e17a857` | — | — | **unverified** whether production applied them | Needs production `_prisma_migrations` (read-only). Same permission blocker as #9. |
| 11 | Production smoke tests | — | — | — | — | — | **not run** | Egress to `www.gemcybersecurityassist.com` is denied by this environment's network policy. |

## Owner gates (unchanged)

- `recovery-readiness` public contract decision.
- `admin_access_tokens` baseline (needs the real production definition).
- Emergency RLS migration (only after #9 confirms exposure).
- Canonical-lineage / `a72f063` revert decision. Production currently serves `main`, so the main-lineage fixes (#3) are the ones that matter now.
