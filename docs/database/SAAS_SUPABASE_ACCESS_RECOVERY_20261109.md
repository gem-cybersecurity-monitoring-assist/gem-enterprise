# GEM Enterprise Supabase authority and non-destructive recovery

Verified through the *existing* Codespace `orange-waddle-q7g66xg5p5j5f5q7` on 2026-11-09. The repository was checked out into a separate temporary directory; no copy-trading or casino project was modified.

## Target is established; permission is not

- Canonical intended GEM Enterprise production Supabase project: `supabase-charcoal-lens`, reference `slzdjoqpzbkwzuaexlkj`. Source: `docs/database/supabase-production-target.md` and runtime gateway default `src/lib/supabase-gateway.ts`.
- Legacy Vercel Supabase public URL (not interchangeable with the GEM production schema): project `kcurngdalxcjcqucylyy`. Source: the production-target document. Do not run GEM schema migrations there.
- Repository `supabase/config.toml` currently defaults to `zplnwkgxkovepqplhohx`. The CLI target differs from the production gateway. Deliberately leave it unchanged until its staging/legacy ownership is understood; target production only with explicitly verified project scope.
- Vercel runtime health reports `supabase_gateway` with database `ok`; this confirms gateway connectivity, *not* direct database administration or migrated SaaS operating tables.
- Existing Codespace `codespaces-c39052` has GitHub identity `support371` with repository read access, but no `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_PASSWORD`. It does not have Supabase CLI installed and its GitHub token cannot list repository Codespaces secrets.
- The connected Supabase app lists other projects but does not authorize the intended production ref. The absence of the project from the app's account scope does not mean the project has been deleted.
- Vercel's project connector is GitHub (`support371-gem-enterprise`), not a Supabase management connector.

## Read-only preflight

From the GEM Enterprise repository root:

```sh
node --test scripts/gem-supabase-target-preflight.test.mjs
node scripts/gem-supabase-target-preflight.mjs --audit
```

The audit command performs no writes. It prints only project references, boolean token presence and a non-secret Management API permission status. With a scoped management token available *inside the authorized terminal environment*, it probes GET `/v1/projects/slzdjoqpzbkwzuaexlkj` without logging the token. Without `--audit`, a mismatched CLI target or unverified management authorization returns a nonzero code.

## Remaining authorization requirement

The production project must be made visible to the authorized Supabase connection or a scoped Supabase Management API token for that project must be stored in a protected environment (not chat, code, or logs). The token must be created by an account already permitted on the owning organization; creating a token does not grant missing organization access. An authenticated access check must succeed before project details, migration history, logs, or Edge Functions can be modified.

This authorization step is **not completed** by GitHub repository access, Vercel `NEXT_PUBLIC_` variables, or an anonymous Edge Function HTTP 401. Do not fall back to the unrelated connector projects, enable privileged JWT bypasses, fabricate a service role, or clone a production database.

## After legitimate connection

1. Run the audit and verify the exact project ref and least-privileged scoped permissions.
2. Read project health and the migration history. Compare to repository migrations before any schema change.
3. Perform dry-run/isolated rehearsal with approved reversible SQL; validate RLS, grants and audit controls.
4. Only after separate deployment approval, apply reviewed migrations to the identified project and verify schema and tests.
5. Re-test authenticated owner access, tenant boundaries and SaaS workflow acceptance. The readiness dashboard's partial evidence never substitutes for end-to-end tests.

**Current status:** Production gateway target identified; administrative Supabase authority remains unverified. No secret, schema, service, project configuration or payment setting was changed in this investigation.
