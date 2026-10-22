# Social Automation — Architecture Decision: No Zoho Catalyst

**Decision:** the social automation control plane is implemented in the existing
Next.js + Supabase/Prisma stack of `support371/gem-enterprise`. Zoho Catalyst was
**not** used, and no Catalyst migration is planned.

## Justification

(a) **No Catalyst access exists in this environment.** There is no Catalyst CLI, no API
credentials, the console sits behind a Zoho login, and the repository contains zero
Catalyst references. Building on Catalyst would have meant starting from credentials
nobody holds.

(b) **The repo already contained a sound foundation.** The July 2026 work merged OAuth
with PKCE, a governed idempotent publishing queue, provider adapters, a scheduler, and
a policy gate. The mandate explicitly says to continue a sound existing system and
authorizes choosing a better architecture rather than rebuilding.

(c) **Rebuilding in Catalyst would be the unnecessary rebuild the mandate forbids.**
It would also split the system: website, API, jobs, and audit would span two platforms
with two auth models and two data stores, for no functional gain.

## What was built instead

- **Control plane:** Next.js App Router routes under `src/app/api/social-media/**`
  (17 route files, 24 handlers) — see `route-inventory.md`.
- **Domain logic:** `src/lib/social-media/{oauth,publishing,analytics,autopilot,orchestration,providers,policy.ts}`.
- **Data:** Supabase/Postgres via Prisma; two new migrations
  (`20260929120000_social_provider_tiktok_and_pause`, `20260929121500_social_metric_snapshots`),
  RLS enabled, `social_provider_pauses` / `social_metric_snapshots` /
  `provider_account_metrics` / `social_metric_sync_runs` tables.
- **Scheduling:** Vercel crons in `vercel.json` (19 entries) calling `CRON_SECRET`-guarded routes.
- **Control surface:** the GEM website itself (same repo) — command center UI plus
  `docs/social-automation/` operator docs.
- **Secrets:** server-side only (AES-256-GCM token encryption; encrypted Nextdoor URL template).

## Catalyst's remaining role

None for this implementation. Zoho Catalyst console/API access for project 939258801
remains an **optional future** item (listed in `human-required.md`) if the owner ever
wants it for a different workload — it is not a dependency of the social automation build.
