# GEM Sentinel — dedicated Supabase database setup (free-first)

Status (2026-10-12): **dedicated Supabase project created and migrations installed**. Project `thhbviealrttyqyagqnu` in organization `atnocdfzendybmbokfvc` was provisioned on the **Free** plan at provider-confirmed **$0/month** project creation cost, in `us-east-1`, and reports `ACTIVE_HEALTHY`. The project remains **not connected to Vercel's GEM Sentinel application** because an authenticated private PostgreSQL connection value is not available to this session and Vercel environment listing returned HTTP 403. No customer sensors are enrolled.

## Why dedicated storage

The main GEM Enterprise application may use an existing Supabase Auth Gateway and a separate PostgreSQL connection. Sentinel must **never replace** the public app's `NEXT_PUBLIC_SUPABASE_URL`, `POSTGRES_PRISMA_URL`, `DATABASE_URL`, or other business-database variables with credentials from a new project. GEM Sentinel's monitoring records are intentionally isolated from customer accounts, transactions, and any separate crypto project.

## Verified provisioning and security (2026-10-12)

- Supabase project: `thhbviealrttyqyagqnu` (GEM Sentinel Security). Direct management: https://supabase.com/dashboard/project/thhbviealrttyqyagqnu
- Completed Supabase migrations: `gem_sentinel_security_core` (version `20261012015611`) and `gem_sentinel_dedicated_tenants` (version `20261012015615`).
- Verified all five `sentinel_*` tables exist with **zero rows**, RLS enabled, and anonymous / authenticated roles denied SELECT and INSERT permissions. No browser Data API policies were granted.
- Security advisor's five INFO `rls_enabled_no_policy` findings are an intentional consequence of server-only table use. Do not add permissive browser policies to suppress them.
- Readiness endpoint: `GET /api/admin/sentinel/readiness` (Platform Owner only). Returns `SCHEMA_READY_FOR_LAB` only after the running application connects to the designated private PostgreSQL database and verifies the five table privileges. This is distinct from live customer-device protection.
- **Open blocker:** connect a **server-only** secret via Vercel preview environment configuration. Do not replace GEM Enterprise's canonical database or Auth Gateway variables.

## Project setup

1. Locate the correct Supabase organization. Check account access to the existing GEM project first; do not provision duplicates if it can be recovered.
2. Obtain the project's actual creation cost using the Supabase management API and capture explicit owner confirmation. A Free organization does **not** guarantee that creating another project is free.
3. If approved, create a project named **GEM Sentinel Security** in a suitable region such as `us-east-1` (subject to owner selection and data residency). Select no automatic Data API exposure if offered.
4. Verify the project is healthy. From the SQL editor, inspect that no GEM Sentinel tables already exist.
5. Apply `prisma/migrations/20261011210000_sentinel_security_core/migration.sql` and then `prisma/migrations/20261012110000_sentinel_dedicated_tenants/migration.sql`. Apply only to this explicitly selected project, after rehearsal and backup planning. Both migrations are additive.
6. Confirm **five private tables**: `sentinel_collectors`, `sentinel_nonces`, `sentinel_security_events`, `sentinel_tenants`, `sentinel_operation_audit`. Check RLS is enabled on all five and grants to `anon`, `authenticated` and PUBLIC are denied; do not add browser-readable policies.
7. Set the **server-only** Vercel environment variables for the correct **preview** target:

   `SENTINEL_STORAGE_MODE=dedicated`

   `SENTINEL_DATABASE_URL=<Supabase private PostgreSQL URI, obtained securely from this project>`

   Do **not** set `NEXT_PUBLIC_SENTINEL_DATABASE_URL`; never paste credentials in source, tickets, chat or logs. Use the provider's supported pooled/Session-Mode connection URI and review Prisma compatibility. Verify SSL and least-privilege role access.

8. Keep the existing GEM Auth Gateway and canonical database settings unchanged. Restart/redeploy the exact reviewed preview head after adding secrets, then verify owner authorization.
9. Navigate to `/sentinel`, open **Authorize organizations**, register a disabled organization, verify actual signed consent, then explicitly approve it. Back under **Connections**, register a disabled sensor for the same organization and consent reference. Save its generated key securely. Activate only after the authorized collector host is configured.
10. Send a single genuine, authorized lab alert over HTTPS to `/api/security/sentinel/ingest` with an accepted key, fresh timestamp and unique nonce. Verify alert persistence, cross-tenant isolation, duplicate response, replay rejection, revoke and outage/recovery.
11. Configure expiry, nonce retention, incident retention, access audit, backup/restore and periodic endpoint health checks **before any paying-client onboarding**. No unsupervised containment or bank-account action is authorized by this setup.

## Modes

- **Shared mode**: default when both `SENTINEL_STORAGE_MODE` and `SENTINEL_DATABASE_URL` are absent. Retains the pre-existing GEM PostgreSQL dependency and member authorization semantics. No new behavior is silently activated.
- **Dedicated mode**: explicit mode plus a distinct private database URL. Credentials and event metadata go only to the Sentinel database, with its own owner-governed organization registry and local append-only administrative audit. Fails closed if URL is missing/invalid or duplicates the canonical connection string.
- Supplying a Sentinel URL without selecting dedicated mode causes an error, rather than accidental use of an unintended database.

## Limitations

- This is **not** a completed infrastructure deployment. The Supabase project, network/database role, migrations and connected sensor still require independent verification.
- Existing route authentication comes from GEM Enterprise / approved Supabase Auth Gateway; the dedicated database is not a new client login system.
- The table `sentinel_operation_audit` records administrative changes. Security operators must additionally verify that audit actions cannot be altered by the least-privilege database user. Supabase's database owner roles can bypass RLS; protect project owner credentials.
- A dedicated Sentinel project does not automatically provide Wazuh, Suricata, endpoint agents, dark-web monitoring, continuous availability or SOC staffing.
- Confirm resource/free-plan quotas. No paid service or subscription may be enabled to complete setup.
- When used over direct PostgreSQL, new Supabase Data API table exposure defaults are not a dependency. Do not grant public REST access merely to make an ORM query work.
