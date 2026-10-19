# GEM Execution Record

Single running record of delivery state. **Implemented ≠ tested ≠ merged ≠ deployed ≠ verified in production.** Update this file in place; do not add parallel status documents.

**Last updated:** 2026-10-19.
**Production:** Vercel project `support371-gem-enterprise`, deployment `dpl_2dSgPYdukRXAeNSSNkJBdNPMi97f`, READY, built from `main` `04fa2f52` (read via Vercel API). Production runs the post-Lovable `main` tree, not the `9f1da4f` lineage.

## Work items

| # | Item | Ref | Implemented | Tested | Merged | Deployed | Verified in prod | Blocker / next action |
|---|---|---|---|---|---|---|---|---|
| 1 | GitHub Actions SHA pins | PR #443, `8e17a857` | yes | CI green on PR | **yes** | **yes** | Workflows run on `main` | — |
| 2 | Route inventory, runbook, probes, authz harness, migration-integrity and security reports, read-only Supabase audit pack, Windows build fix, `CLAUDE.md` DB-command warning | PR #440, `941c7067` | yes | CI green on `532cfc34` (Build Verification, Tracked Secret Scan, GitGuardian, Socket) | **yes** | **yes** (`dpl_5ZeimNEs…`) | Docs, scripts and tests only; no runtime change | — |
| 3 | Proxy dotted-path bypass fix and bootstrap-status least privilege | PR #445, `04fa2f52` | yes | CI green on `c09f7e98`; preview probes passed | **yes** | **yes** (`dpl_2dSgPYdu…`) | **yes** (2026-10-19, anonymous GET via Vercel API): `/app/portfolios/x.y` redirects to `/client-login?next=…`; `/api/system/bootstrap-status` returns only `ok, service, evaluatedAt, core.ready, detailsRequireAdministrator`. Before the fix both were exposed in production. | — |
| 4 | Router slug conflict fix | local `fix/gem-route-runtime-access` `f2291ad` | yes | Local build, `next start` probe 258/258 | no | n/a | n/a | Only affects the `9f1da4f` lineage; not needed on `main`. Keep until the lineage decision. |
| 5 | Separate business and personal customer journeys | PR #434 | yes (PR author) | Merged with `main` `04fa2f52` (`f1ee23ba`): `pnpm run verify` exit 0, 136 files / 797 tests, build OK | no | no | — | Not draft. Merge needs owner review of public copy. |
| 6 | Wix referral attribution | PR #435 (draft) | yes | Merged with `main` `04fa2f52` (`f4f5b2d0`): `pnpm run verify` exit 0, 135 files / 794 tests, build OK | no | no | — | Draft; stays draft until its release gate is met. |
| 7 | Wix market-entry admin console | PR #436 (draft) | yes | Merged with `main` `04fa2f52` (`169a7c33`): `pnpm run verify` exit 0, 136 files / 796 tests, build OK | no | no | — | Draft; stays draft until its release gate is met. |
| 8 | Launch content pack in social workspace | PR #437 | yes | Merged with `main` `04fa2f52` (`11a6f9b6`): `pnpm run verify` exit 0, 136 files / 797 tests, build OK | no | no | — | Social posts stay in draft; paid advertising stays paused. |
| 9 | Production RLS / grant exposure | `docs/security/gem-supabase-readonly-audit.sql` | pack ready | Run read-only on production 2026-10-19 (owner-approved) | — | — | **verified: no exposure** | 0 public tables without RLS; 0 CRITICAL/HIGH/REVIEW findings; 164 LOW `GRANTED_BUT_RLS_DENIES` (API roles hold grants, RLS returns zero rows); no `SECURITY DEFINER` function callable by API roles; `anon`/`authenticated` lack BYPASSRLS; `admin_access_tokens` present with RLS on and no API-role privileges; `pg_graphql` not installed. **Missing control:** default privileges grant API roles full access to future tables, so any new table created without RLS would be exposed. Next: owner decides on revoking those default privileges and API-role grants (defence in depth). Data API "Exposed schemas" setting still to be read from the Dashboard. Detailed results are kept outside the repository. |
| 10 | Migrations deleted from `main` by `a72f063` | 4 migrations listed in `docs/GEM_MIGRATION_INTEGRITY_20261017.md` | — | Still absent from `main` at `04fa2f52` | — | — | **verified: not applied** | Production has no `_prisma_migrations`; its schema comes from 123 Supabase migrations (2026-07-11 to 2026-08-21). None of the 6 tables those 4 migrations create exist, and `social_connectors` still allows only META, X, LINKEDIN, YOUTUBE, NEXTDOOR. Production schema and `main` code agree on this point. Restoring the migrations is part of the lineage decision. |
| 11 | Production smoke tests | — | — | — | — | — | **partial** | Direct egress is blocked by the network policy. Anonymous GETs through the Vercel API work (see #3). Signed-in flows not tested. |

## Owner gates

- `recovery-readiness` public contract decision.
- `admin_access_tokens` baseline (needs the real production definition).
- Emergency RLS migration: **not needed** (#9 found no exposure). Hardening default privileges and API-role grants remains an owner decision.
- Canonical-lineage / `a72f063` revert decision.
