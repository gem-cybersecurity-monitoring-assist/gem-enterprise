# GEM Migration Integrity and Database Recovery — 2026-10-17

**Scope:** repository history and disposable local PostgreSQL 16 only (socket-only cluster, databases named `*_test`). No production database, Supabase project or deployment was accessed. **MOCK** below means a local stand-in for a Supabase-managed object; everything else is genuine PostgreSQL behaviour.

Tooling (committed):
- `scripts/verify-migration-chain.sh`: replays `prisma/migrations` into a `*_test` database.
- `scripts/verify-local-authorization.supabase-stub.sql`: the MOCK Supabase objects.

## 1. Root cause

1. **`public.admin_access_tokens` has never been defined in Git.** Across all 2,069 commits on all 259 branches, no file has ever contained a `CREATE TABLE` for it, and no Prisma model has existed.
   - `src/lib/admin-access-authorizer.ts` generates `insert into public.admin_access_tokens …` for an operator to run in the **Supabase SQL editor** (URL hardcoded to project `slzdjoqpzbkwzuaexlkj`). The table was created by hand in Supabase.
   - Migrations `20260712225500_add_atomic_admin_access_consumer` and `20260713014500_add_admin_access_token_validation` were "recorded" afterwards (commits `775267c1`, `83318dfa`).
   - Both declare `public.admin_access_tokens%rowtype`, which PL/pgSQL resolves at `CREATE FUNCTION` time. So **no empty database can get past migration 13** (genuine PostgreSQL error: `relation "public.admin_access_tokens" does not exist`).
   - **Classification: Supabase-managed, provisioned externally, never captured.** Columns in use by code (`id, user_id, token_hash, expires_at, request_id, used_at, run_secret`) are evidence of usage only. **Types, constraints, defaults, indexes, RLS and grants are unknown and must come from the production database.**
2. **The production schema has three sources: migrations, `prisma db push`, and SQL-editor changes.** Genuine `prisma migrate diff` from a migrated database to the build-promoted Prisma schema:

   | | `main` | PR #440 lineage |
   |---|---|---|
   | Prisma tables never created by a migration (db-push only) | 6: `api_keys, email_campaigns, meeting_requests, news_sources, news_articles, news_ingestion_runs` | same 6 |
   | Migration-created tables absent from Prisma (raw-SQL-managed); **`db push` would DROP them** | 29 | 33 |
   | Column-level differences | 66 | 76 |
   | Enum differences | 17 dropped/altered, 7 new | same |

   Example: migrations create `users` **without** the `status` column that login reads, and **with** an `emailVerifiedAt` column that Prisma does not model. Neither the migration chain nor `schema.prisma` alone describes production.
3. **The Lovable merge `a72f063` (2026-10-15) replaced `main` with Lovable's tree.**
   - Its tree is byte-identical to its second parent `77d3796` (`d5df1d3e…`). The 86 commits on the main side since the fork point `b147dc01` (2026-09-22) were dropped. Lovable's own 6 commits touched 11 files (59 insertions, 24 deletions), none of them under `prisma/` or `supabase/`.
   - Removed from `main`: 4 migrations (`20260929120000_social_provider_tiktok_and_pause`, `20260929120000_unified_client_workspace_os`, `20260929121500_social_metric_snapshots`, `20260929130000_social_provider_telegram`) and the models `CapabilityReadinessOverride` and `LifecycleFunnelState`.
   - `main`'s remaining 39 migrations are **byte-identical** to the PR #440 lineage's. **PR #440's 43 are a strict superset.**

## 2. Missing or external definitions

| Object | Used by | Defined in repo? | Owner of definition |
|---|---|---|---|
| `public.admin_access_tokens` (table, plus its RLS/grants) | 2 migrations; `admin-access-consumer.ts`, `admin-access-authorizer.ts` | **No** | Production Supabase (manual) |
| `storage.buckets` (`gem-verify-evidence` row) | `20260711224500` | No (platform) | Supabase Storage |
| `pg_cron` extension, `cron.schedule`/`unschedule`/`job` | `20260712134000` | No (platform) | Supabase extension |
| `net._http_response` (`pg_net`) | `20260726044500` (function body) | No (platform) | Supabase extension |
| `extensions` schema, `extensions.digest` (`pgcrypto`) | 3 invitation migrations | No (platform) | Supabase |
| Roles `anon`, `authenticated`, `service_role` | grants/revokes in 10+ migrations | No (platform) | Supabase |
| 6 Prisma tables (above) | Prisma client | Only in `schema.prisma` | `db push` history |
| Unmerged branches add 5 more migrations (`…020500_add_admin_access_token_validation`, `…032500_command_center_operating_models`, `…150000_experian_account_connection`, `…210000_sentinel_security_core`, `…110000_sentinel_dedicated_tenants`) | — | Branch-only | Not authoritative until merged |

## 3. Chain replay results (from an empty database)

| Run | `main` (39) | PR #440 (43) |
|---|---|---|
| Plain PostgreSQL 16 (genuine, no stubs) | stops at #5 `20260711224500` (`storage.buckets`) | same |
| + MOCK Supabase stub | stops at #13 `20260712225500` (`admin_access_tokens`) | same |
| + MOCK stub, the 2 admin-access migrations **SKIPPED** | 37 applied, complete | 41 applied, complete |
| PR #440 with the back-dated migration in commit order | — | identical schema (`pg_dump --schema-only` compared) |

**Ordering, idempotency and rollback:**
- **Duplicate timestamps.** `20260929120000` is used twice. `…_social_provider_tiktok_and_pause` was committed on 2026-10-11 but sorts before `…_unified_client_workspace_os` (committed 2026-09-29). Both orders produce the same schema, but future migrations need unique timestamps.
- **Idempotency.** Every file was re-run inside a transaction that was always rolled back. 24 of 41 are re-runnable; 17 are not (plain `CREATE TYPE`/`TABLE`/`INDEX`/`ADD COLUMN`). They fail cleanly, with no partial state. A migration whose objects already exist in production (from `db push` or the SQL editor) will **fail** on `migrate deploy`. Such migrations need `prisma migrate resolve --applied` after the schema is confirmed equal.
- **Rollback.** There are no down migrations. Destructive statements in the chain are limited to constraint and trigger replacement plus one `DELETE FROM admin_access_tokens` inside a function. **Rollback means restoring a backup or Point-in-Time Recovery (PITR)**; per-phase reversal must be scripted in advance (§5).
- **Dangerous commands.**
  - `pnpm run db:push` (would drop 29–33 tables).
  - `pnpm run db:migrate` (`prisma migrate dev`, a development-only command that may offer a database reset when it finds drift).
  - `CLAUDE.md` §10 previously suggested both. It now restricts them to disposable databases.

## 4. Database-level security (what the migration chain defines)

From real PostgreSQL catalogs of the migrated PR #440 test database:
- 88 public tables. **RLS enabled on 32, forced on 0, policies: 0** (RLS-enabled tables are deny-all for API roles; the table owner used by Prisma bypasses RLS).
- **56 tables have no RLS** in the replayed chain (application tables; see the Prisma schema). Migrations revoke API-role access only on newer tables; none changes default privileges.
- 11 `SECURITY DEFINER` functions in the replayed database (13 counting the two skipped admin-access functions), all with a pinned `search_path` and none executable by `PUBLIC`. The two skipped admin-access functions are granted to `anon` by design (token-gated).
- Triggers: append-only guards on 3 event tables; password-change session revocation and audit on `users`.
- **Tenant isolation and ownership are enforced only in application code** (verified at the app layer, 222/222, see `docs/GEM_SECURITY_VERIFICATION_20261017.md`). **No database-level tenant isolation exists in the chain.**

**Production exposure** was checked read-only on 2026-10-19; no exposure was found (see `docs/GEM_EXECUTION_RECORD.md` item 9).

## 5. Recommended canonical lineage and repair sequence

**Canonical: the `9f1da4f` lineage (PR #440 base).** It is a strict superset of `main`'s migrations and models and holds the 86 commits that `a72f063` discarded. Confirm against the Vercel production deployment SHA before acting.

Dependency-ordered plan. Every write step needs explicit owner approval.

| # | Step | Where | Reversible by |
|---|---|---|---|
| 0 | **Backups.** Confirm PITR is enabled; take a manual Supabase backup plus `pg_dump -Fc` of production; restore it into a disposable database and run both harnesses (restore drill). | Owner, production read | — |
| 1 | **Read-only capture:** `pg_dump --schema-only` (public, storage bucket row, cron jobs), `_prisma_migrations`, `pg_dump -s -t public.admin_access_tokens`, extensions list, the §6 audit pack, deployed commit SHA. | Owner, read-only | — |
| 2 | **Emergency exposure fix, only if the §6 audit pack shows confirmed exposure:** migration enabling RLS and `REVOKE ALL … FROM anon, authenticated` on the affected tables, plus `ALTER DEFAULT PRIVILEGES … REVOKE`. First audit `supabase/functions` for any anon/authenticated table reads. | Migration PR, then production | Scripted re-grant |
| 3 | **Restore `main`:** `git revert -m 1 a72f063` on a branch (dry run: 4 conflicts — `prisma/schema.prisma`, `roadmap.md`, 2 tests), re-apply Lovable's 11-file change and the 21 later `main` commits, plus PR #443 / `fix/gem-access-hardening-main`. | Reviewed PR | Revert the revert |
| 4 | **Baseline `admin_access_tokens`** from the step-1 dump (never from code usage), as a migration timestamped before `20260712225500`, using `CREATE TABLE IF NOT EXISTS` and its exact RLS/grants. In production: `prisma migrate resolve --applied`. | Migration PR | Delete the `_prisma_migrations` row |
| 5 | **Baseline drift:** a reviewed migration for the 6 db-push-only tables and the column/enum differences, generated by diffing the step-1 dump, guarded (`IF NOT EXISTS`) and resolved as applied in production. Mark raw-SQL tables as intentionally unmodelled (or add `@@ignore` models) so `db push` can never target them. | Migration PR | Delete the row |
| 6 | **The 4 removed migrations:** keep their exact bytes from `9f1da4f` (checksums must match). If production `_prisma_migrations` lists them, nothing to apply; otherwise `migrate deploy` after step 5. | Lineage restore | Backup |
| 7 | **Supabase platform prerequisites:** document them, or add a `supabase start`-based CI job; run `scripts/verify-migration-chain.sh` (stub) on every PR. | CI PR | — |

## 6. Read-only verification for the owner

Use the validated pack **`docs/security/gem-supabase-readonly-audit.sql`** with its guide **`docs/security/GEM_SUPABASE_READONLY_AUDIT.md`** (Dashboard steps, secure handling, interpretation). It supersedes the draft queries previously in this section. Those drafts:
- checked only ordinary tables and only SELECT, so views, matviews, column grants, BYPASSRLS and policies were missed;
- used `'public.admin_access_tokens'::regclass`, which aborts if the table is absent.

The pack is catalog-only, runs in a read-only transaction, and was validated on disposable databases (guide §6). Migration history (`_prisma_migrations`) is a separate, owner-approved read and is not part of the pack.

## 7. Acceptance criteria

- The chain replays from empty with **0 skips** on Supabase-local (or PostgreSQL plus a stub limited to platform objects).
- `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel` shows no unexplained drift; raw-SQL tables are listed as intentional.
- Production `_prisma_migrations` equals the repository set, with matching checksums.
- The §6 audit pack's consolidated findings show no CRITICAL or HIGH rows in production.
- A restore drill of the production backup into a disposable database passes `verify-local-authorization.mjs` and a database-level RLS/grant test.
- New migrations use unique timestamps; CI runs the chain replay.

## 8. Decisions required

1. Confirm the canonical lineage (recommended: `9f1da4f` / PR #440) and approve restoring `main` (step 3).
2. Authorize an owner (or a read-only, owner-supervised session) to run steps 0–1 and the §6 audit pack.
3. Approve the emergency exposure fix (step 2) only if the §6 audit pack confirms exposure.
4. Decide how raw-SQL-managed tables should be represented in Prisma (`@@ignore` models versus a documented exclusion).
