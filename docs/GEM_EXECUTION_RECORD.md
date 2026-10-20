# GEM Execution Record

Single running record of delivery state. **Implemented ≠ tested ≠ merged ≠ deployed ≠ verified in production.** Update this file in place; do not add parallel status documents.

**Last updated:** 2026-10-20.
**Production:** Vercel project `support371-gem-enterprise`, deployment `dpl_J65Fw3aVrBpikards4eJYMEcA4H4`, READY, built from `main` `2c5fc09b` (read via Vercel API). After the repository moved to `gem-cybersecurity-monitoring-assist/gem-enterprise`, the Vercel Git integration was reconnected; production deploys resumed on 2026-10-20. Production runs the post-Lovable `main` tree, not the `9f1da4f` lineage.

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
| 9 | Production RLS / grant exposure | `docs/security/gem-supabase-readonly-audit.sql` | pack ready | Run read-only on production 2026-10-19 (owner-approved) | — | — | **verified: no exposure** | 0 public tables without RLS; 0 CRITICAL/HIGH/REVIEW findings; 164 LOW `GRANTED_BUT_RLS_DENIES` (API roles hold grants, RLS returns zero rows); no `SECURITY DEFINER` function callable by API roles; `anon`/`authenticated` lack BYPASSRLS; `admin_access_tokens` present with RLS on and no API-role privileges; `pg_graphql` not installed. **Missing control:** default privileges grant API roles full access to future tables, so any new table created without RLS would be exposed. Next: owner decides on revoking those default privileges and API-role grants (defence in depth). Data API "Exposed schemas" setting still to be read from the Dashboard. Detailed results are kept outside the repository. |
| 10 | Migrations deleted from `main` by `a72f063` | 4 migrations listed in `docs/GEM_MIGRATION_INTEGRITY_20261017.md` | — | Still absent from `main` at `04fa2f52` | — | — | **verified: not applied** | Production has no `_prisma_migrations`; its schema comes from 123 Supabase migrations (2026-07-11 to 2026-08-21). None of the 6 tables those 4 migrations create exist, and `social_connectors` still allows only META, X, LINKEDIN, YOUTUBE, NEXTDOOR. Production schema and `main` code agree on this point. Restoring the migrations is part of the lineage decision. |
| 11 | Production smoke tests | — | — | — | — | — | **partial** | Direct egress is blocked by the network policy. Anonymous GETs through the Vercel API work (see #3). Signed-in flows not tested. |
| 12 | `recovery-readiness` least privilege | PR #448, `2be5bb6e` | yes | 4 new tests; CI green | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | **yes** (2026-10-19, anonymous GET): returns only `ok, service, emailDeliveryConfigured, detailsRequireAdministrator`; `Cache-Control: no-store`. `emailDeliveryConfigured` is `false`. | SMTP variables still to be set (owner, production credentials). |
| 13 | AI capability upgrade baseline | PR #439, `89782007` | yes | CI green | **yes** | **yes** (`dpl_FsSQU3LS…`, `2be5bb6e`) | — | Docs only. |
| 14 | Dependency group update (6 packages) | PR #442, `063aac67` | — | CI green on `a5304d57` | **yes** | **yes** (in `2c5fc09b`) | — | — |
| 15 | Social and TokMetric connections | production tables | — | Read-only counts 2026-10-19 | — | — | **verified: none** | 0 rows in `social_connectors`, `social_connector_credentials`, `social_oauth_authorization_attempts`, `social_publishing_jobs`, `tokmetric_connectors`, `tokmetric_connector_credential_references`, `tokmetric_oauth_authorization_attempts`, `tokmetric_publish_jobs`. 1 active GPT credential, never used. Accounts connected on external builder sites did not reach this app; each must be connected through the app's own OAuth start routes once provider credentials are set. |
| 16 | Remaining open PRs | 37 PRs (#111–#433) | — | Local merge check against `main` `2c5fc09b`, 2026-10-20 | no | no | — | None descends from `a72f063`: all were built on the `9f1da4f` lineage. 19 conflict with `main`; the other 18 merge textually but target files the Lovable merge removed. They wait on the lineage decision (#19), then each is rebased or closed. |
| 17 | Claude Code plugin moved to `plugins/gem-enterprise` | PR #446, `72b33edf` | yes | CI green | **yes** | **yes** (`dpl_DT2PxmSA…`) | — | — |
| 18 | `@vitest/mocker` 4.1.4 → 5.0.5 | PR #449, `2c5fc09b` | — | CI green | **yes** | **yes** (`dpl_J65Fw3aV…`) | — | — |
| 19 | Restore `9f1da4f` lineage (revert `a72f063`) | branch `restore/canonical-lineage`, `22da2f6f` (no PR yet) | yes | Local `pnpm run verify` 2026-10-20: exit 0, 179 files / 1225 tests, build OK; Vercel preview READY | no | no | — | **Owner decision.** 295 files, +26,833 / −1,646. Based on `dccc6581`; conflicts with current `main` only in `package.json` and `pnpm-lock.yaml` (from #449). |
| 20 | Social and TikTok activation checklist | PR #450 | yes | CI green | — | n/a (docs) | — | `docs/social-media/PROVIDER_ACTIVATION_CHECKLIST.md`. |
| 21 | Production smoke after redeploy | — | — | Anonymous GET via Vercel API, 2026-10-20 | — | — | **yes** | `/api/auth/recovery-readiness` and `/api/system/bootstrap-status` return only their minimal anonymous fields; `core.ready` is `true`. |

## Owner gates

- SMTP credentials for password-recovery email (production credentials).
- Social/TikTok provider app credentials in Vercel, then connect each account through the app.
- `admin_access_tokens` baseline (needs the real production definition).
- Emergency RLS migration: **not needed** (#9 found no exposure). Hardening default privileges and API-role grants remains an owner decision.
- Canonical-lineage / `a72f063` revert decision.
