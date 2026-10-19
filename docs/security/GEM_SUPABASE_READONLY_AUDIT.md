# GEM Supabase Read-Only Security Audit — Owner Guide

**SQL pack:** `docs/security/gem-supabase-readonly-audit.sql`
**Purpose:** determine, from production catalog metadata, whether the RLS and grant gaps found in `docs/GEM_MIGRATION_INTEGRITY_20261017.md` §4 actually exist in the live Supabase project.
**Status:** prepared and validated locally. **Run read-only against production on 2026-10-19** (owner-approved): no exposure found, one missing control (default privileges). Summary in `docs/GEM_EXECUTION_RECORD.md` item 9; detailed results are kept outside the repository.

## 1. Safety properties

- **Catalog-only.** The pack reads `pg_roles`, `pg_class`, `pg_policy`/`pg_policies`, `pg_attribute`, `pg_proc`, `pg_default_acl`, `pg_constraint`, `pg_index`, `pg_trigger`, `pg_extension` and `pg_namespace`. It also calls the privilege functions `has_table_privilege`, `has_any_column_privilege`, `has_schema_privilege`, `has_function_privilege` and `pg_has_role`.
- **It never reads application rows.** No user, session, KYC, audit, ticket or token rows, no password hashes, no `_prisma_migrations`, no settings and no environment variables.
- **Read-only transaction.** The first statement is `SET LOCAL transaction_read_only = on`; any write in the same transaction is rejected by PostgreSQL.
- **No write commands at all:** no `ALTER`, `GRANT`, `REVOKE`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP` or similar.
- **Enforced by test.** `src/__tests__/supabase-readonly-audit-pack.test.ts` fails if a write keyword, an application-table read or a secret-reading function is added.
- `admin_access_tokens` is inspected through `to_regclass` and catalog joins only, so the pack does not error if the table is absent. It never selects token values.

## 2. Running it in the Supabase Dashboard

1. Sign in at https://supabase.com/dashboard and open the GEM project (the repository references project ref `slzdjoqpzbkwzuaexlkj`; confirm it is the production project).
2. Left sidebar: **SQL Editor**, then **New query**. Keep the role selector at the default **postgres** role.
3. Paste the entire contents of `docs/security/gem-supabase-readonly-audit.sql`.
4. Click **Run** (Ctrl/Cmd + Enter). The editor shows only the **last** result: **section 10, consolidated findings**.
5. To see another section, highlight the `SET LOCAL transaction_read_only = on;` line **and** that section's `SELECT`, then click **Run selected**. Sections 2 (per-table grid), 3 (policies), 6 (functions) and 8 (`admin_access_tokens`) are the ones to export.
6. Also record two Dashboard settings (no SQL needed):
   - **Project Settings → Data API**: is the Data API enabled, and is `public` listed under **Exposed schemas**?
   - **Database → Extensions**: is `pg_graphql` enabled? It exposes the same grants through `/graphql/v1`.
7. Optional corroboration: **Advisors → Security Advisor**, and note any "RLS Disabled in Public" or "Security Definer View" lints.
8. Do not save the query as a **shared** snippet. A private snippet, or no snippet, is fine.

**psql alternative** (shows every section; `-1` is required so `SET LOCAL` covers the whole run):
`psql "<production connection string>" -X -1 -v ON_ERROR_STOP=1 -f docs/security/gem-supabase-readonly-audit.sql > gem-audit-YYYYMMDD.txt`
Enter the connection string yourself. Never paste it into chat, tickets or files.

## 3. Saving the results securely

- Use the result toolbar's CSV export for sections 10, 2, 3, 6 and 8. Name files `gem-supabase-audit-<project-ref>-<YYYYMMDD>-section<N>.csv`.
- The output contains **no secret values**, but it maps the attack surface. Treat it as **confidential**: store it in an access-restricted location such as an encrypted drive or a restricted company folder.
- **Do not** post it in GitHub issues, PRs, commit messages, public Slack channels or chat transcripts.
- To share with a reviewer, share the file through the restricted location, or share the section 10 counts by severity and finding only.
- Record the date and time, the project ref, the person who ran it, and the two Dashboard settings from §2.6. Keep the files until remediation is verified, then follow your retention policy.

## 4. Interpreting the results

### Evidence levels (use these words exactly)

| Level | Meaning |
|---|---|
| **Confirmed exposure** | The database permits an API role (`anon`/`authenticated`) to access the object without effective RLS, **and** the object is reachable through an enabled API. For `public` that means it is listed under Data API → Exposed schemas, or `pg_graphql` is enabled. |
| **Confirmed database permission** | The database permits access (`DB_ACCESS_*`), but the Data API does not expose `public` and `pg_graphql` is disabled. Not reachable today; one setting change away. |
| **Missing control** | A grant exists but RLS currently blocks it (`GRANTED_BUT_RLS_DENIES`), or default privileges would grant API roles access to future tables. No current access; defence in depth is missing. |
| **Theoretical risk** | A risk that depends on something not shown by this pack: a leaked `service_role` key, a future migration, a policy expression that might be too broad. |

### Section 10 findings

| Finding | What it means | Evidence level | Severity |
|---|---|---|---|
| `DB_ACCESS_NO_RLS` | Table without RLS, and the role has SELECT/INSERT/UPDATE/DELETE (or column SELECT) | Confirmed exposure if `public` is exposed; otherwise confirmed database permission | CRITICAL when `sensitive=t`, else HIGH |
| `DB_ACCESS_BYPASSRLS` / `API_ROLE_HAS_BYPASSRLS` | `anon` or `authenticated` has the BYPASSRLS attribute; every grant ignores RLS | Same as above | CRITICAL |
| `DB_ACCESS_VIEW_OWNER_RIGHTS` | A view without `security_invoker` runs with its owner's rights, so the base tables' RLS does not apply to API roles | Same as above; check which base tables the view reads | HIGH (CRITICAL if it reads sensitive tables) |
| `DB_ACCESS_MATVIEW_NO_RLS` / `DB_ACCESS_FOREIGN_TABLE` | Materialized views and foreign tables cannot use RLS | Same as above | HIGH |
| `VIEW_INVOKER_CHECK_BASE_TABLES` | The view respects the caller's rights; its exposure equals that of its base tables in section 2 | Depends on base tables | REVIEW |
| `POLICY_DEPENDENT` | RLS on, with policies for this role; access is whatever the policy expressions allow (section 3) | Review each `using_expression`/`with_check_expression`. `true` means full access | REVIEW |
| `GRANTED_BUT_RLS_DENIES` | RLS on, no applicable policy, grant present; API roles get zero rows | Missing control | LOW |
| `SECURITY_DEFINER_CALLABLE_BY_API_ROLE` | An RPC callable through the Data API that runs with owner rights (bypasses RLS) | Confirmed callable; impact depends on the function | HIGH. Expected only for `gem_consume_admin_access_token` and `gem_validate_admin_access_token` (token-gated by design). Any other is unexpected; `(no pinned search_path)` adds hijack risk |
| `ADMIN_ACCESS_TOKENS_ABSENT` / `_PRESENT` | Whether the externally provisioned table exists | — | INFO |
| `AUDIT_COMPLETE_NO_API_ROLE_TABLE_ACCESS` | No API role can access any public relation | No exposure found | INFO |

`service_role` rows in section 2 normally show full access with BYPASSRLS. That is expected for the server-side key and is a **theoretical risk** only if the key leaks.

### Section 8, `admin_access_tokens`

- **absent:** the table was dropped or renamed. The one-time administrator setup flow (`/api/admin-access`) cannot work. Record this; do not create the table from code usage.
- **present, `rls` enabled, `effective_privilege` false for `anon`/`authenticated`:** expected safe state. Export the `column`, `constraint`, `index`, `trigger` and `policy` rows; they are the authoritative input for the baseline migration (recovery plan, step 4).
- **present, and `anon` or `authenticated` has any privilege with RLS disabled:** **confirmed exposure** if `public` is exposed. An API caller could read token hashes and expiries, or insert or alter setup tokens for the administrator account. Treat as an incident: escalate immediately and restrict access before anything else.
- **`function_using_table` rows:** which functions touch the table and whether API roles can execute them.

### Sections 4, 5 and 7

- **Section 4** shows *where* a privilege comes from: a direct grant, `PUBLIC`, or a grantor. Use it to plan revokes.
- **Section 5** catches column-level grants that the table-level checks would miss.
- **Section 7** rows granting `anon`/`authenticated` on **tables** mean every *future* table created by that owner is accessible until it is revoked or RLS is enabled. That is a **missing control** for new tables.

## 5. Decision rules after running

1. Any CRITICAL **confirmed exposure** (including `users`, `user_sessions`, `kyc_*`, `audit_logs`, `support_tickets`, `admin_access_tokens`): stop and approve an emergency hardening migration (recovery plan step 2). That migration enables RLS and revokes API-role privileges on the listed objects, after auditing `supabase/functions` for API-role table reads. **This pack contains no repair SQL by design.**
2. Only *confirmed database permission* (public not exposed): schedule the same hardening as high priority. Do not enable the Data API for `public` until it is done.
3. Only missing controls or REVIEW items: fold them into the baseline migrations (recovery plan steps 4–5).
4. `AUDIT_COMPLETE_NO_API_ROLE_TABLE_ACCESS` and Security Advisor clean: record the result. The mock simulation's exposure does **not** apply to production.

## 6. Local validation evidence (disposable PostgreSQL 16; no production access)

| Database | Construction | Result |
|---|---|---|
| `mig_pr440_defaults_test` | PR #440 migration chain + MOCK Supabase default privileges | Exit 0, no errors. 55 `DB_ACCESS_NO_RLS` per API role (18 CRITICAL sensitive + 37 HIGH), 11 `GRANTED_BUT_RLS_DENIES`, `ADMIN_ACCESS_TOKENS_ABSENT`. Matches the migration report's simulation. |
| `mig_pr440_stub_test` | Same chain, no default grants | Exit 0: `AUDIT_COMPLETE_NO_API_ROLE_TABLE_ACCESS`, `ADMIN_ACCESS_TOKENS_ABSENT`. |
| `audit_fixture_test` (dropped after use) | Test-only fixture: policy, owner-rights and invoker views, matview, partitioned table, column-only grant, `SECURITY DEFINER` without `search_path` granted to anon, `anon BYPASSRLS` (reverted), placeholder `admin_access_tokens(id int)` (not a schema proposal) | Every finding type produced as expected. Section 8 printed metadata only. |
| Read-only guard | Pack plus an appended `CREATE TABLE`, run with `psql -1`; and a single multi-statement query string (SQL Editor style) | Both rejected: `cannot execute CREATE TABLE in a read-only transaction`. Nothing created. |
| Static guard test | `supabase-readonly-audit-pack.test.ts` | 4/4 pass. A negative control (injected `UPDATE` plus a `SELECT … FROM public.users`) fails 3/4 checks, as intended. |

## 7. What this pack does not cover

- Whether the Data API or GraphQL is enabled. Read these from Dashboard settings (§2.6).
- Storage bucket objects and storage policies beyond bucket-table existence, and `auth` schema configuration.
- Policy expression correctness (section 3 lists them for human review).
- Application-layer authorization. Verified separately at 222/222 in `docs/GEM_SECURITY_VERIFICATION_20261017.md`.
