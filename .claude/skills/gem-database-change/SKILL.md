---
name: gem-database-change
description: Add or change GEM Enterprise data models, Prisma schema, Supabase SQL migrations, RLS or grants. Use whenever a feature needs new tables, columns or constraints.
---

# Change the database safely

Schema work is fully buildable by agents. Applying it to the shared production database is an owner step.

## Facts about this database

- Production is Supabase project `slzdjoqpzbkwzuaexlkj`. Its schema comes from Supabase-applied migrations; production has no `_prisma_migrations` table.
- Never run `pnpm run db:migrate` (`prisma migrate dev`) or `pnpm run db:push` (`prisma db push`) against a shared, preview or production database. Against production, `db push` would drop raw-SQL-managed tables.
- Use them only on a disposable local database.

## Steps

1. Edit `prisma/schema.prisma`; run `pnpm run db:generate`.
2. Add a migration under `prisma/migrations/<timestamp>_<name>/migration.sql`. Keep it **additive**: `CREATE TABLE IF NOT EXISTS`, new nullable columns, widened CHECK constraints. Avoid drops and renames; when unavoidable, write a two-step plan.
3. Security for every new table: `ENABLE ROW LEVEL SECURITY`, and `REVOKE ALL ... FROM anon, authenticated` unless the table is meant to be read through the Supabase API.
4. Make the code tolerate the table not existing yet (see `isMissingStore` in `src/lib/social-media/oauth/provider-pause.ts`): fail closed with a clear 503 rather than crashing a page.
5. Replay the full chain on a disposable database: `scripts/verify-migration-chain.sh <name>_test --stub scripts/verify-local-authorization.supabase-stub.sql`.
6. Add tests and note rollback steps in the pull request.

## Owner activation

The owner approves applying the migration to production. After approval, it is applied through Supabase migrations and verified read-only: tables exist, RLS on, API-role access as intended.
