# GEM Enterprise Supabase Production Target

Verified on 2026-07-06.

## Intended production database

- Supabase project: `supabase-charcoal-lens`
- Project reference: `slzdjoqpzbkwzuaexlkj`
- Region: `us-east-1`
- Status at verification: `ACTIVE_HEALTHY`
- Public schema state at verification: empty
- Migration history at verification: empty
- Security advisor findings at verification: none
- Performance advisor findings at verification: none

This clean project is the intended target for applying the repository's reviewed database migrations. It must be connected to the Vercel project `support371-gem-enterprise` for the Production environment. Do not substitute another Supabase project.

## Legacy project retained without destructive changes

- Supabase project: `supabase-byzantium-lever`
- Project reference: `kcurngdalxcjcqucylyy`

The legacy project contains the existing tables `threads`, `thread_users`, `messages`, `profiles`, `contact_messages`, and `admin_users`. It does not match the current GEM Enterprise Prisma schema and must not be overwritten or treated as the production schema without a separate migration plan.

## Persistent operator access

- [Production project dashboard](https://supabase.com/dashboard/project/slzdjoqpzbkwzuaexlkj)
- [Production Edge Functions](https://supabase.com/dashboard/project/slzdjoqpzbkwzuaexlkj/functions)
- Publishing worker: `gem-social-publishing-gateway`
- Keep the provider sign-in and authorization in the connected app. The repository records the project reference and deployment target. It does not store an account password, personal access token, database URL, or service-role key.
- Open the project dashboard and verify that the signed-in Supabase account can see **supabase-charcoal-lens**. If the project is absent, switch to the account or organization with access to this project, or have its administrator grant the access required for the operation.
- Authorize the Supabase connection with that identity. Where a client supports a separate MCP connection, use the [official Supabase OAuth setup](https://supabase.com/docs/guides/getting-started/mcp) with the production project pinned. For a separate inspection connection use `https://mcp.supabase.com/mcp?project_ref=slzdjoqpzbkwzuaexlkj&read_only=true`. An operator who must deploy functions should use an explicitly authorized connection with the required project role.

### Verified Vercel sign-in route

Vercel Storage identifies the exact Supabase project `slzdjoqpzbkwzuaexlkj` as
`supabase-charcoal-lens`, resource `store_E1xlP6klmbdB3ofE`, with status
available, provider status ready, SSO supported, and Supabase Free Plan.
Open the [exact Vercel storage resource](https://vercel.com/geraldhoeven-4141s-projects/~/stores/store_E1xlP6klmbdB3ofE)
from the owning Vercel team, then use its Supabase dashboard link. Vercel
identifies `admin@gemcybersecurityassist.com` as the Marketplace installer
and Vercel team owner. The Supabase organization role is still to be
verified after sign-in.

The Vercel resource is attached to the Crypto Signal Bot project. This is
evidence of where to find the existing Supabase account, not authorization
to change Crypto Signal Bot or its database configuration. GEM Enterprise's
older Vercel storage attachment points to `kcurngdalxcjcqucylyy`.

### Requested transfer destination

The second Supabase connection (Apple sign-in) can see destination organization
`nnfqefhuldprcjawdybt`, which listed no projects at verification. Keep Crypto
Signal Bot and Copy Manager in the first account.

The source is a native Vercel Marketplace resource. Supabase documents that
Marketplace owner roles are synchronized from Vercel and cannot be added
manually in Supabase Studio. Use the existing Vercel owner identity and the
verified resource's Studio sign-in. Verify that identity's membership in the
destination organization, then inspect whether the existing project offers
Transfer in General Settings and whether Vercel-managed billing permits it.
If the transfer control is absent, confirm the supported route with Supabase
before changing any integration or project. The available connections have not
verified source owner access, eligibility, or the transfer itself.

References: [Marketplace permissions and limitations](https://supabase.com/docs/guides/integrations/vercel-marketplace) and
[project transfer prerequisites](https://supabase.com/docs/guides/platform/project-transfer).

### Access check for each work session

1. Fetch project metadata by the exact reference and verify its identity. A healthy application endpoint only proves the application is responding.
2. List Edge Functions for that project and look for `gem-social-publishing-gateway`. Listing functions confirms inspection access. Deployment requires the appropriate role and the reviewed release procedure.
3. Verify the required storage and RPCs without reading account records or credentials:

```sql
select
  to_regclass('public.social_connectors') is not null as connector_table_present,
  to_regclass('public.social_publishing_jobs') is not null as queue_table_present,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gem_social_health'
  ) as publishing_health_rpc_present;
```

If any access check fails, recover access to this exact project before making a production change. Continue through the [provider activation checklist](../social-media/PROVIDER_ACTIVATION_CHECKLIST.md) only after verifying the connection.

## Expected Vercel variables

The application accepts one pooled runtime URL from:

- `POSTGRES_PRISMA_URL`
- `DATABASE_URL`
- `POSTGRES_URL`
- `NEON_DATABASE_URL`

It accepts one direct/unpooled URL from:

- `POSTGRES_URL_NON_POOLING`
- `DATABASE_URL_UNPOOLED`
- `POSTGRES_URL_NO_SSL`

No secret values belong in this repository.

## Controlled production bootstrap

`AUTO_DB_PUSH` and `AUTO_DB_SEED` must remain `false` in Vercel. The Vercel build intentionally fails closed if either is enabled.

Do **not** use `prisma db push` as a first-time production bootstrap. Schema push can create Prisma tables and columns, but it does not apply SQL-only security invariants carried by reviewed migrations, including CHECK constraints, row-level security, append-only triggers, and grants/revokes.

For a new or empty intended production project:

1. authorize the exact Supabase project `slzdjoqpzbkwzuaexlkj`;
2. configure pooled and direct server database URLs in Vercel without exposing their values;
3. apply the repository's reviewed migrations through the controlled production migration path;
4. verify constraints, foreign keys, indexes, row-level security, triggers, and grants/revokes;
5. run the controlled bootstrap/seed procedure only after the schema and security invariants are proven;
6. keep automatic database push and seed disabled for normal deploys.

The customer-success and communication-governance migrations are specifically release-gated because their SQL security controls are not represented by `prisma db push` alone.
