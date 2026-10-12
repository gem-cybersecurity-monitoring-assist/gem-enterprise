# Sentinel activation validation — 2026-10-12

Source: PR #430 at `8beae7f94593cd89106674049e2058a50513ef7b`.
Scope: isolated GEM-ASSIST checkout. Existing security/video working directories preserved.

## Database rehearsal — PASS

Ran `scripts/security-operations/rehearse-sentinel-migration.mjs` with separately installed, pinned `@electric-sql/pglite@0.3.14`.
The tool creates an in-memory disposable PostgreSQL-WASM database and never reads provider credentials or connects to production.

17 checks passed: exact migration application; RLS on all three tables; denied anon/authenticated access; disabled-by-default collectors; unique credential hashes; nonce replay rejection; independent collector nonces; unknown collector rejection; within-tenant event deduplication; separate tenant records; initial lifecycle; unprivileged role denial; evidence-preserving foreign key restrictions; transaction rollback; snapshot restoration; replay rejection after restore.

Migration SHA-256: `4acc3d186b1684bb9cf91cdecdc5969c71b31363c6f6d645bcd4f311ab40a0c9`.

This proves the additive SQL and a disposable snapshot restore. It does **not** prove provider-native backup restoration, concurrent server behavior, Prisma connectivity, HTTP-to-live-database integration, or production readiness. RLS deliberately supplies no browser policies; a correctly configured server database role is still necessary.

## Reproduce the rehearsal

In a separate temporary tooling directory, use `pnpm add --save-exact @electric-sql/pglite@0.3.14`.
Then run from this repository:

```text
node scripts/security-operations/rehearse-sentinel-migration.mjs <absolute-path-to-tooling>/node_modules/@electric-sql/pglite/dist/index.js
```

No application dependency or lockfile change is required. The disposable snapshot is restored in memory and discarded.

## Collector API verification

The new `sentinel-ingest-route.test.ts` executes the real Next.js route handler with mocked Prisma storage. All 18 route cases passed, covering malformed credentials, stale timestamps, bad nonces, streaming/declared size limits, invalid JSON, missing event identity, unknown/mismatched credentials, consent/expiry/revocation, quota rejection, server-authorized tenant scope, summarized metadata, deduplication, replay and storage outage. The three existing credential cases also passed (21/21 in this run). A separate run of the existing foundation, Sentinel flow and ingestion contract suites passed 15/15, for 36/36 focused tests across five files. This is route-level verification with mocked storage, not an end-to-end live database test.

Repository-wide typechecking was attempted but terminated with exit 4294967295 and no compiler diagnostic. That attempt is not a pass. Subsequent focused TypeScript validation of the new route test and its imports passed (exit 0). ESLint on the new test passed (exit 0), JavaScript syntax checking passed, and git diff --check passed (exit 0). Existing-head canonical Vercel status is successful, but does not establish new-head or database activation readiness.

## Live infrastructure findings — BLOCKED

- Canonical Vercel project: `prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z`, team `team_7lMXW95WSLeyK4yAObe8FptW`.
- Vercel connector environment listing returned 403. The same explicitly scoped operation succeeded with GEM-ASSIST's existing Vercel CLI credentials.
- Production environment points to Supabase project `kcurngdalxcjcqucylyy`.
- The connected Supabase account lists three different inactive projects. Access to the actual GEM project was denied.
- Vercel production has no `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, or equivalent connection URI recognized by `src/lib/db.ts`.
- Existing public Supabase URL/key variables do not substitute for a server PostgreSQL connection or database migration permission.
- No Wazuh service was found on GEM-ASSIST. No verified Wazuh manager endpoint or registered/activated collector credential was available.
- No SMTP or Telegram delivery credentials were found in the inspected production environment. Other existing messaging infrastructure may be configured separately and requires validation before delivery claims.

Environment values were inspected only locally; temporary secret-bearing files were deleted. No production configuration, database, sensor enrollment, notifications, billing, or containment was changed.

## Remaining execution dependencies

1. Connect the Supabase account/organization that owns `kcurngdalxcjcqucylyy`, or provide its authorized database access through a secret store.
2. Configure `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` in Vercel with valid PostgreSQL URIs, never in chat or source control. Inspect actual schema and migration history before applying any migration.
3. Rehearse a provider-native backup/restore, check server role access and schema compatibility, then apply the additive Sentinel migration through the approved deployment process.
4. Register and activate one consented lab collector; connect a genuine sensor; verify HTTPS ingest, dashboard persistence, replay rejection, tenant boundaries, revocation and outage recovery.
5. Validate the existing notification provider and approved retention schedule. Keep containment disabled until separately tested authorization and rollback controls exist.

Do not restore, overwrite, or repurpose the unrelated inactive Supabase projects as a shortcut.
