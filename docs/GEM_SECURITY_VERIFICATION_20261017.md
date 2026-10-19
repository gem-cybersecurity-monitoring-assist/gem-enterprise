# GEM Security Verification and Release Readiness — 2026-10-17

**Scope:** local verification only. Nothing was pushed, merged or deployed, and no production service, credential or data was used.
**Environment:**
- Production build (`next start`) inside a network namespace that had loopback only.
- Disposable PostgreSQL 16 cluster with a Unix socket only (no TCP listener), database `gem_authz_test`.
- Synthetic `@example.test` users only.

## 1. Verified fixes (local commits, not pushed)

| Fix | PR #440 lineage (`fix/gem-route-runtime-access`, base `2bf8d8b`) | `main` lineage (`fix/gem-access-hardening-main`, base `1c07a42`) | Evidence |
|---|---|---|---|
| Router conflict `[id]` vs `[provider]` under `/api/social-media/connectors` made `next start` answer almost every request with 500 | `f2291ad` | Not needed (folders absent on `main`) | Before: 253/258 pages returned 500. After: 0 slug errors. Route manifest unchanged (480 = 480 routes). Regression test added. |
| Dotted paths skipped the proxy session gate on protected routes | `43f7514` | `b5d6a88` | `/app/portfolios/x.y` rendered for anonymous visitors on both lineages. After: 258/258 page probes pass. 10 proxy behavior tests. |
| Anonymous `/api/system/bootstrap-status` disclosed deployment SHA, environment, backend topology, auth source, missing variables and DB push/seed/migration flags | `6366367` | `3ed8d95` (cherry-pick) | Anonymous, non-admin and gate-failure callers get `ok, service, evaluatedAt, core.ready, detailsRequireAdministrator`. Admins get the full diagnostic. 4 tests; verified at runtime with real admin and client sessions. |

**Checks on each branch:**

| Branch | Lint | Typecheck | Test files | Tests | Build |
|---|---|---|---|---|---|
| PR #440 lineage | pass | pass | 175 | 1201 | exit 0 |
| `main` lineage | pass | pass | 134 | 788 | not rebuilt |

The fixes change no application URLs.

## 2. Diagnostic endpoints

| Endpoint | What anonymous callers receive | Needed anonymously? | Action |
|---|---|---|---|
| `/api/system/bootstrap-status` | Before: commit SHA (12 chars), environment, canonical-project match, gateway selection/operation/admin-configured, DB URL and direct-URL configured, auth source (`local_jwt`/`supabase_gateway`/`missing`), password-reset signing, SMTP configured, missing core variable names, evidence-vault/scanner topology, demo-data and auto DB push/seed/migration flags. No secret values. | Only liveness and overall readiness. No consumer exists (UI, tests, monitors, docs). | **Implemented** least privilege (see §1). |
| `/api/auth/recovery-readiness` | Reset page origin, token transport, `emailDeliveryConfigured`, names of missing SMTP variables, port/secure validity, sender/reply-to configured, transport security, gateway-recovery and session-revocation mode. No secret values. | Partly. `docs/RELEASE3_SMTP_ACTIVATION.md` step 4 reads it before the administrator step, and `canonical-password-recovery.test.ts` asserts this contract. | **Decision required.** Recommended minimal public response: `ok`, `service`, `emailDeliveryConfigured`. Move `missingVariables`, port/secure/sender/reply-to and `transportSecurity` behind `requireAdmin()` (or into the existing admin-only `verify` route), then update the activation doc and test. Not changed because the contract is deliberate and documented. |

## 3. Signed-in authorization (application layer)

`scripts/verify-local-authorization.mjs` result: **222/222 PASS**, exit 0.

| Area | Checks | Result |
|---|---|---|
| Login | 7 | Real `/api/auth/login` for client, client in a second organization, analyst, admin and super_admin; suspended account refused (403); wrong password refused (401). |
| Role gates | 17 | Admin APIs: anonymous 401, client and analyst 403, admin and super_admin 200. Staff route: client 403, analyst passes. Proxy page gates send client to `/app/dashboard`. bootstrap-status: minimal for client, full for admin. |
| Record ownership | 11 | A second client cannot read or post to another client's support ticket, revoke their API key, cancel their meeting, or mark their notification read. The database state was verified unchanged after each attempt. The owner and admin succeed. |
| Session | 16 | Expired, wrong-signature and wrong-audience tokens are refused on `requireSession` routes, `getSession` routes and protected pages. A validly signed token claiming `admin` for a DB `client` is refused. A token revoked by a `sessionVersion` bump is refused. An admin suspended, or a super_admin downgraded, after login loses admin API access immediately. |
| Non-GET methods | 96 anonymous, 24 client-on-admin, 3+3 well-formed-body | No protected write was accepted without a session. Three gateway-delegating handlers validate input before auth (400 on an empty body); with a well-formed body they return 401. |
| Public or shared-secret writes | 45 (recorded) | Only `POST /api/auth/logout` succeeds anonymously (harmless). Legacy Facebook write endpoints are disabled stubs (fixed 409). Eight worker or bridge endpoints fail closed (503) because they're unconfigured. |

## 4. Newly discovered issues

1. **Migrations cannot build a database from empty.** Root cause and the recovery plan are in `docs/GEM_MIGRATION_INTEGRITY_20261017.md`.
   - `public.admin_access_tokens` was created by hand in the Supabase SQL editor and has never been defined in any commit on any branch.
   - Two migrations depend on it through `%rowtype`.
   - Production is also shaped by `db push` (6 tables, 66–76 column differences).
   - **Owner action:** read-only schema capture of production, then baseline migrations generated from that capture.
2. **Resolved 2026-10-19: not exposed in production** (read-only audit, see `docs/GEM_EXECUTION_RECORD.md` item 9). Original finding: **RLS-less tables under Supabase default privileges.** 56 public tables (including `users`, `user_sessions` and `kyc_*`) have no RLS, and the migration chain defines 0 policies. In a MOCK simulation of Supabase's default grants, `anon` could read and write 55 of them, including `users."passwordHash"`. Production state is unknown. **Owner action:** run the validated read-only audit pack `docs/security/gem-supabase-readonly-audit.sql` following `docs/security/GEM_SUPABASE_READONLY_AUDIT.md`. Do not label production exposed until its section 10 results and the Data API setting support it.
3. **`pnpm run db:push` / `db:migrate` are destructive against real databases.** `db push` would drop 29–33 raw-SQL-managed tables; `migrate dev` may offer a reset. `CLAUDE.md` §10 now restricts both to disposable databases.
4. **Login rate limit trusts `x-forwarded-for`.** `getRequestContext` takes the first `x-forwarded-for` value. On Vercel the platform sets this header. On any self-hosted `next start` deployment, a client could rotate the header to bypass the 10-per-5-minutes login limit. **Low on Vercel; document or restrict to trusted proxies.**
5. **82 of 102 protected pages rely on the proxy only.** This is safe with fix §1, but any future proxy regression exposes them. Keep the proxy tests.
6. **`recovery-readiness` disclosure.** See §2 (decision required).

## 5. Outstanding authorization tests

- Database-layer controls. The replayed chain contains them for inspection (32 RLS-enabled tables, 0 policies, 11 `SECURITY DEFINER` functions, 5 triggers). It is **not** the production configuration, so production RLS, grants and default privileges remain **unverified** (issues 1–2).
- Organization/workspace tenant isolation for workspace-scoped data (`WorkspaceMember`, organization projects, scoped service requests, TokMetric workspaces). Only cross-user ownership was tested.
- Supabase-gateway sessions (`authSource: supabase_gateway`) and every gateway-delegated admin route under real configuration.
- The 8 fail-closed worker/bridge endpoints and cron routes with real secrets.
- Rendered-DOM navigation anchors; any preview or production deployment.

## 6. Changes ready for draft PRs (awaiting approval)

| Branch | Base | Commits | Suggested target |
|---|---|---|---|
| `fix/gem-access-hardening-main` | `main` `1c07a42` | `b5d6a88`, `3ed8d95` | `main` |
| `fix/gem-route-runtime-access` | `2bf8d8b` | `f2291ad`, `43f7514`, `6366367` | `docs/gem-complete-route-inventory-20261015` (PR #440), or `main` after the lineage decision below |
| `docs/gem-complete-route-inventory-20261015` | remote `2bf8d8b` | `47fea9e`, `4d46bfa`, plus this record and harness | PR #440 (push) |
| `fix/gem-actions-sha-pins` | `main` | `9bd1fe3` | PR #443 (already open, all checks green) |

## 7. Main-branch recovery work

- `a72f063` (Lovable merge, 2026-10-15) reverted 303 files from `9f1da4f`: workflow SHA pins (fixed by PR #443), `production-readonly-smoke.yml`, 4 Prisma migrations and schema models, and 40 test files (1186 → 774 tests). An owner must decide which lineage is canonical before the PR #440-lineage fixes can target `main`.
- After PR #443 merges, re-run PR #440's checks.
- Root cause proven: the tree of `a72f063` is byte-identical to Lovable's parent `77d3796`. The dependency-ordered repair (backups → read-only capture → exposure fix → `git revert -m 1 a72f063` → baselines) is in `docs/GEM_MIGRATION_INTEGRITY_20261017.md` §5. Recommended canonical lineage: `9f1da4f` / PR #440.

## 8. PC-only validation

- Windows build of `47fea9e` on Node 24.x. Steps and the git bundle were provided separately; **not yet run**.
