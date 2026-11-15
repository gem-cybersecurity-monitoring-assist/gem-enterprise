# Isolated GEM Enterprise development deployment

Issue #496. Production remains `support371-gem-enterprise` / `slzdjoqpzbkwzuaexlkj`.
Development is `gem-enterprise-development` (`prj_BcEaEo1E25IOw30KcGQBfwIoVCQ9`) / `dusqdnebwkoycdtjkhyy`.

The normal `vercel.json` is unchanged. The development project cannot build `main` or reuse that production config. Do not remove the canonical guard or copy production secrets.

## Selected development source

1. Review the implementation PR on `fix/development-deployment-496`; its canonical preview uses the unchanged production config.
2. Create/update only `deploy/gem-enterprise-development` from the reviewed source head. In that branch, copy `vercel.development.json` to `vercel.json` and commit the overlay. Never merge the overlay branch into main.
3. Set `GEM_DEPLOYMENT_PROFILE=development` in this Vercel project's Preview environment. Request a **preview** from this exact branch, keeping SSO protection enabled. The guard rejects all other projects, branches, targets and configs for development.
4. The selected development config has no cron definitions, disables autopilot/auto-approval/publishing/OAuth/AI/migrations/seeding, and overrides gateway defaults to the new database. Auth and intake require direct database configuration; their production gateway fallbacks are disabled.

## Private configuration

Configure development-only `POSTGRES_PRISMA_URL` (pooled), `POSTGRES_URL_NON_POOLING` (direct/session), and an independent `JWT_SECRET` of at least 32 characters in the development project's Preview environment. Do not enter values into GitHub or chat. Database URLs must identify `dusqdnebwkoycdtjkhyy`, use `sslmode=require&sslaccept=strict`, and use either `postgres` or the explicit `gem_dev_runtime` login. Missing/foreign-project configuration fails before running the build; no placeholder database credentials are installed in Vercel.

### Dedicated development runtime checkpoint

An independent `JWT_SECRET` and the runtime role's direct `POSTGRES_URL_NON_POOLING` were generated and saved as Preview-only Vercel Secrets without displaying values. The database password is encrypted under `gem-development-runtime-dusqdnebwkoycdtjkhyy` in Supabase Vault. The runtime cannot read Vault. Never expose values through logs or GitHub.

Development-only SQL plans are in `scripts/database/development-runtime-access.sql` and `scripts/database/development-runtime-password.sql`. They are intentionally outside the automatic Prisma/Supabase migration directories and must never be replayed into production. The server role can perform ordinary application DML and bypasses RLS only for its private backend connection, following Supabase's Prisma pattern. It cannot create schema objects, databases, roles, replicate, inherit privileged roles, or call the `service_role`-only social RPCs. API-role grants and all table RLS remain unchanged.

The role remains **NOLOGIN** until the exact shared pooler host is verified from this project's Connect panel (do not guess a regional host). Then privately transfer the same Vault-held runtime password into pooled (6543) and session (5432) URLs using username `gem_dev_runtime.dusqdnebwkoycdtjkhyy`; set both Preview Secrets, verify the URI target/TLS privately, enable this runtime login through the pinned development Supabase connection, and test real connectivity. The six-connection role limit requires small Prisma connection pools. No owner database password needs to be copied.

The development build invokes the existing full preview verification (schema generation, claims, lint, typecheck, tests, Next build). It performs no migrations, seeding, provider calls, or account copying. A successful build is not proof of working database authentication: separately smoke-test database health, login, workspace authorization and read-only connectors. The new database has no copied production users or social connections.

The initial development app origin is a development-only placeholder hostname. Before testing authentication links, set the `NEXT_PUBLIC_APP_URL`, `GEM_PUBLIC_APP_URL`, `GEM_PUBLIC_BASE_URL`, `GEM_AGENT_API_BASE_URL`, scanner/public URLs to the actual protected preview origin in the overlay config; never point them at production. OAuth remains off.

## Still excluded

Legacy Facebook automation SQL is not compatible with the current Prisma workspace schema and remains unapplied. News scheduling and live publishing remain disabled. YouTube remains paused. No billing/plan change or production promotion is included.

## Rollback

Stop preview creation, restore the development project's ignored command to `exit 0`, and leave the deployment overlay branch unmerged. No production rollback or database rollback is necessary for this deployment-only change.
