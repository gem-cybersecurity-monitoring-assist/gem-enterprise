# Social Automation — Definition of Done

**Branch:** `feat/social-automation-control-plane` @ `41dfbad9f24667839058eb84adb389f8cd4d13ab`
**Assessed:** 2026-09-29 (WS-F). All verdicts are code + unit-test evidence unless noted.
Nothing was executed against live providers; production deployment has not happened.

| # | Item | Verdict | Evidence / notes |
|---|---|---|---|
| 1 | Catalyst backend deployed | **NOT APPLICABLE (architecture decision)** | Zoho Catalyst was deliberately not used — see `architecture.md` in this folder. The control plane lives in the existing Next.js + Supabase/Prisma stack. There is no Catalyst project wired to this build. |
| 2 | Website can reach it | **PASS (code) / HUMAN_REQUIRED (deploy)** | Control plane is part of the same Next.js app as the GEM website (same repo); mutating routes enforce same-origin. Reachability in production requires the owner to merge the PR and let Vercel deploy it. |
| 3 | Workspace resolution works | **PASS** | `requireWorkspaceAccess(workspaceId, session)` on every workspace-scoped route; exercised by `social-provider-oauth-foundation.test.ts` and others. |
| 4 | Social Accounts endpoint works | **PASS** | `GET /api/social-media/connectors` lists connectors with pause + live-probe enrichment. |
| 5 | Connection status endpoint works | **PASS** | `POST /api/social-media/connectors/health` evaluates credential lifecycle, performs conditional refresh with concurrency claims, and labels live vs config probes. 26/26 WS-A tests. |
| 6 | OAuth start/callback architecture works | **PASS (code) / HUMAN_REQUIRED (provider setup)** | PKCE + nonce + attempt-consumption + account discovery flows are unit-tested. Completing a real OAuth loop needs owner-registered provider apps, redirect URIs, and scopes (see `human-required.md`). |
| 7 | Secrets stay server-side | **PASS** | AES-256-GCM token encryption; refresh tokens and access tokens never appear in API responses (tests assert absence); Nextdoor URL template never returned to the browser; revocation attempted server-side on disconnect. |
| 8 | Scheduler executes | **PASS (code) / HUMAN_REQUIRED (runtime)** | 19 crons registered in `vercel.json` (recovery watch 47 6 * * *, orchestrator 10 5 * * *, analytics sync 0 2 * * *, 16 hourly publishing slots 0 7..22). Actual execution needs Vercel cron delivery plus `CRON_SECRET` / `CONTENT_ORCHESTRATOR_CRON_SECRET` configured. |
| 9 | Content jobs can be created | **PASS** | `POST /api/social-media/publishing/jobs` creates governed jobs; 202 on success. |
| 10 | Policy gate executes | **PASS** | `evaluateSocialPublishingAuthorization` gates every claim; `social-publishing-governance.test.ts` covers allow/block paths. |
| 11 | Eligible jobs enter queue | **PASS** | Slot-aware worker claims due jobs with `FOR UPDATE SKIP LOCKED`, per-provider caps and spacing backpressure. |
| 12 | Blocked content cannot enter queue | **PASS** | 409 gates: `CONTENT_NOT_APPROVED`, `APPROVAL_EVIDENCE_INVALID`, `COMPLIANCE_EVIDENCE_INVALID`, `MEDIA_ASSET_MISSING`. Unit-tested. |
| 13 | Provider adapters can process eligible jobs | **PASS (mocked) / HUMAN_REQUIRED (live)** | Adapters for FACEBOOK_PAGE, INSTAGRAM_PROFESSIONAL, X, LINKEDIN_COMPANY, YOUTUBE, NEXTDOOR, TELEGRAM are registered and unit-tested against mocked HTTP, including media upload flows and publication verification read-back. Live dispatch needs provider approvals, quotas, and `SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED=true`. |
| 14 | Publication results recorded | **PASS** | Worker verifies publication via provider read-back and persists outcome on the job (PUBLISHED/RETRYING/FAILED/DEAD_LETTER). |
| 15 | Analytics can be synchronized | **PASS (mocked) / HUMAN_REQUIRED (provider metrics)** | Sync worker, per-provider fetchers, snapshot/account-metric/run tables, and the read API are unit-tested (33 WS-C tests). Live metric pulls need provider API tiers and metric permissions. |
| 16 | Telegram integration represented | **PASS** | `TELEGRAM` registered in `sharedSocialPublishingProviders` and the worker `adapters` record; `docs/integrations/telegram.md` documents the bot-token + channel setup. Not separately deployed. |
| 17 | Metricool represented where configured | **PASS** | `docs/integrations/metricool.md` documents the honest current state (website tracker today; no fabricated API integration). |
| 18 | Health endpoint works | **PASS** | `POST /api/social-media/connectors/health` (+ read-only `GET /api/social-media/connectors/[id]/test`). |
| 19 | All claimed routes tested | **PASS** | All 24 method handlers across 17 route files are covered by named suites or static export assertions (see `route-inventory.md`). |
| 20 | No claimed route returns 404 | **PASS** | Static verification: every `route.ts` exports its claimed handler(s); Next.js registers all of them. |
| 21 | Audit events persisted | **PASS (code) / HUMAN_REQUIRED (DB)** | `emitTokMetricAudit` fires on every mutating route with outcome metadata. Actual row persistence requires the owner-approved migration run + database. |
| 22 | Emergency stop functional | **PASS** | Global kill switch (`enforceEmergencyLocks` → 423), provider-scoped pause (`PUT/DELETE …/pause`), autopilot cancel endpoint. Unit-tested including kill-switch-engaged paths. |

## Honest summary

- **Code-complete:** 20 of 22 items PASS on code + unit tests; item 1 is intentionally not applicable (architecture decision).
- **HUMAN_REQUIRED before production use:** PR merge + Vercel deploy, the two new Prisma migrations via the owner-approved path, `CRON_SECRET` / `CONTENT_ORCHESTRATOR_CRON_SECRET` (and orchestrator workspace/actor IDs), provider app registrations and scopes, `SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED` decision, autopilot enablement decisions, and approved news sources. Full list in `human-required.md`.
- **Not verified by WS-F:** live provider OAuth round-trips, live publishing, live metric pulls, and real cron execution — all require the human-required setup above and were out of scope (no live provider calls authorized).
