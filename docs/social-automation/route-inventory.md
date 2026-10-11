# Social Automation — Route Inventory

**Branch:** `feat/social-automation-control-plane`
**Remote HEAD verified:** `41dfbad9f24667839058eb84adb389f8cd4d13ab`
**Generated:** 2026-09-29 (WS-F verification)

Mandate check: every route below was verified by reading `route.ts` source — each exports the claimed
HTTP method handler(s), so no route 404s by construction. Auth requirements and response shapes are
taken from the source. Test mapping cites the vitest suites that exercise the route or its
underlying module (all provider I/O is mocked in tests; no live provider calls).

Common conventions across all routes:

- Success bodies always include `ok: true` and a `correlationId` (except the two redirect routes and the two worker routes, which still include `ok`).
- Failure bodies are `{ ok: false, error: { code, message } }` via `tokMetricErrorResponse`, with `Cache-Control: no-store`.
- `externalActionTaken: false` is asserted on website/cron entry points to record that no provider-side publish happened in that request.
- Session auth helpers: `requireActiveTokMetricSession` / `requireTokMetricSession` (401 `UNAUTHENTICATED` when absent), `requireWorkspaceAccess(workspaceId, session)` (403 when not a member), `requirePermission(membership, action, resource)` (403 when role lacks the grant), `enforceEmergencyLocks(workspaceId, domain)` (423 `TOKMETRIC_LOCKED` under emergency stop), `requireSameOrigin` (403 `CROSS_ORIGIN_REQUEST_BLOCKED` for mutating website routes).

## 1. Connection plane

| Method | Route | Auth | Purpose | Success | Failure |
|---|---|---|---|---|---|
| GET | `/api/social-media/connectors` | Session + workspace access | List workspace connectors, enriched with provider-pause state and live-probe signal | 200 `{ ok, connectors[], pausedProviders[], liveProbe{source} }` | 401 unauthenticated; 400 `VALIDATION_ERROR` (missing `workspaceId`); 403 no workspace access |
| DELETE | `/api/social-media/connectors` | Session + `manage:connectors` + emergency locks + same-origin | Disconnect connector; deletes server-side credential and attempts provider-side revocation | 200 `{ ok, externalRevocationAttempted, externalRevocationOutcome, … }` | 403 cross-origin; 403 permission; 423 emergency lock; 404 connector not found |
| POST | `/api/social-media/connectors/health` | Session + `manage:connectors` + emergency locks + same-origin | Credential lifecycle evaluation; conditional token refresh with concurrency claim; optional read-only live probe (`liveProbe: true`), cached ~15 min with `source` labeling | 200 `{ ok, connector, credentialHealth, tokenRefreshAttempted, tokenRefreshSucceeded, liveProbe{source: "live" \| "config"} }` | 503 `SOCIAL_OAUTH_CONFIGURATION_CHANGED`; refresh-rejected errors (`SOCIAL_TOKEN_REFRESH_REJECTED`, etc.) |
| GET | `/api/social-media/connectors/[id]/test` | Session + `manage:connectors` | **Read-only** single-connector connectivity probe (one HTTP GET to provider account API; never publishes) | 200 `{ ok, healthy, latencyMs, accountName, scopes[], checkedAt, readOnlyProbe: true }` | 400 missing id/workspaceId; 503 provider config incomplete |
| PUT | `/api/social-media/connectors/[provider]/pause` | Session + `manage:connectors` + pause-admin + same-origin | Provider-scoped publishing pause for a workspace (`social_provider_pauses`) | 200 `{ ok, provider, paused: true, pausedAt, pausedBy, reason }` | 403 not pause-admin; 400 invalid provider; 403 cross-origin |
| DELETE | `/api/social-media/connectors/[provider]/pause` | Session + `manage:connectors` + pause-admin + same-origin | Resume publishing for a provider | 200 `{ ok, provider, paused: false, wasPaused }` | 403 / 400 as above |
| GET | `/api/social-media/readiness` | Admin only (`requireAdmin`) | Operator truth view: per-provider readiness + `SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED` flag | 200 `{ generatedAt, livePublishingEnabled, providers }` | 401/403 non-admin |

Test mapping: `social-control-plane-ws-a.test.ts` (26), `social-provider-oauth-foundation.test.ts`, `social-provider-account-lifecycle.test.ts`, `social-credential-rotation-concurrency.test.ts`, `social-provider-scope-contracts.test.ts`, `social-meta-page-credential-isolation.test.ts`.

## 2. OAuth

| Method | Route | Auth | Purpose | Success | Failure |
|---|---|---|---|---|---|
| GET | `/api/social-media/oauth/[provider]/start` | Session + `manage:connectors` + emergency locks + `sec-fetch-site` ≠ cross-site check | Create PKCE pair + nonce + authorization attempt, then redirect to the provider authorization URL | 302 redirect to provider (TikTok unified via `tiktok-adapter.ts` + `TIKTOK_SOCIAL_REDIRECT_URI`) | 403 `CROSS_SITE_AUTHORIZATION_BLOCKED`; 503 `SOCIAL_OAUTH_NOT_CONFIGURED` |
| GET | `/api/social-media/oauth/[provider]/callback` | Must match initiating session (`sessionFromStateActor`) + `manage:connectors` + emergency locks | Validate state, consume attempt, exchange code, discover accounts, persist connectors | 302 redirect to `redirectAfter` with `?provider=&connectionState=connected&connectedCount=` | 400 `SOCIAL_AUTHORIZATION_DENIED` / `MISSING_AUTHORIZATION_CODE`; 401 state mismatch; 503 config changed mid-flow |

Test mapping: `social-provider-oauth-foundation.test.ts`, `social-control-plane-ws-a.test.ts` (TikTok unification), `social-provider-account-lifecycle.test.ts`.

## 3. Publishing

| Method | Route | Auth | Purpose | Success | Failure |
|---|---|---|---|---|---|
| GET | `/api/social-media/publishing/jobs` | Session + workspace access | List publishing jobs for a workspace | 200 `{ ok, jobs[] }` | 401; 403; 400 missing `workspaceId` |
| POST | `/api/social-media/publishing/jobs` | Session + `publish:content` + emergency locks + same-origin + required `Idempotency-Key` header | Queue a job behind governance gates: content APPROVED + separate-operator approval evidence + passing compliance review + all media assets present | 202 `{ ok, job }` | 400 `IDEMPOTENCY_KEY_REQUIRED`; 409 `CONTENT_NOT_APPROVED` / `APPROVAL_EVIDENCE_INVALID` / `COMPLIANCE_EVIDENCE_INVALID` / `MEDIA_ASSET_MISSING`; 423 emergency lock |
| GET / POST | `/api/social-media/publishing/jobs/process` | `CRON_SECRET` Bearer (timing-safe) | Slot-agnostic worker tick; claims due jobs (`FOR UPDATE SKIP LOCKED`), runs adapters, verifies publication | 200 `{ ok, processed, published, retrying, blocked, failed }` | 503 `CRON_AUTH_NOT_CONFIGURED`; 401 `UNAUTHORIZED`; 500 `SOCIAL_PUBLISHING_WORKER_FAILED` |
| GET / POST | `/api/social-media/publishing/jobs/process/[slot]` | `CRON_SECRET` Bearer + slot `00`–`23` validation | Hourly slot tick owning one UTC hour window; overdue jobs recovered by later ticks | 200 `{ ok, slot, processed, published, retrying, blocked, failed }` | 400 `INVALID_SLOT`; 503/401/500 as above |
| GET | `/api/social-media/publishing/providers/capabilities` | Session + workspace access | Operator-visible per-provider capability truth table (no secrets) | 200 `{ ok, capabilities, youtubeUploadCertified, youtubeUploadCertifiedAt }` | 401; 403; 400 missing `workspaceId` |
| GET | `/api/social-media/publishing/providers/nextdoor/config` | Session + workspace access | Status-only view of the Nextdoor endpoint config; the URL template is never returned | 200 `{ ok, configured, approved, approvedBy, approvedAt }` | 404 `SOCIAL_CONNECTOR_NOT_FOUND`; 409 provider mismatch / disabled |
| PUT | `/api/social-media/publishing/providers/nextdoor/config` | Session + `manage:connectors` + emergency locks + same-origin | Human approval of the per-workspace Nextdoor Publish API endpoint; AES-256-GCM-encrypted URL template stored server-side on the connector | 200 `{ ok, approved: true, approvedBy, approvedAt }` | 503 `NEXTDOOR_CONFIG_ENCRYPTION_UNAVAILABLE`; 400 invalid template; 403 permission |

Test mapping: `social-publishing-wsb.test.ts` (34), `social-publishing-governance.test.ts`, `social-publishing-command-routes.test.ts`.

## 4. Analytics

| Method | Route | Auth | Purpose | Success | Failure |
|---|---|---|---|---|---|
| GET | `/api/social-media/analytics` | Session + `manage:analytics` + workspace access | Aggregated metric snapshots: totals + daily series + engagement rate (provider/scopes filtered via `social_metric_snapshots`) | 200 `{ ok, filters, totals{…, engagementRate}, series[] }` | 400 invalid query (`VALIDATION_ERROR`); 403 permission |
| GET / POST | `/api/social-media/analytics/sync` | `CRON_SECRET` Bearer (timing-safe) | Trigger the metric sync worker (per-provider fetchers → snapshots + account metrics + sync runs) | 200 `{ ok, jobsConsidered, snapshotsCollected, accountMetricsCollected, runs[] }` | 503 `CRON_AUTH_NOT_CONFIGURED`; 401 `UNAUTHORIZED`; 500 `SOCIAL_METRICS_WORKER_FAILED` |

Test mapping: `social-analytics-routes.test.ts` (3), `social-analytics-sync.test.ts` (6), `social-analytics-store.test.ts` (6), `social-analytics-providers.test.ts` (11), `social-analytics-scoring.test.ts` (8).

## 5. Orchestration / autopilot

| Method | Route | Auth | Purpose | Success | Failure |
|---|---|---|---|---|---|
| POST | `/api/social-media/autopilot/cancel` | Session + `publish:content` + same-origin | Cancel pending autopilot jobs (optionally current policy version only) | 200 `{ ok, cancelled, … }` | 403 cross-origin / permission |
| GET | `/api/social-media/orchestrator/daily` | Session + workspace access | Read the adaptive content plan campaign for `planDate` | 200 `{ ok, campaign }` | 400 missing/invalid `workspaceId`/`planDate` |
| GET / POST | `/api/social-media/orchestrator/daily/process` | `CONTENT_ORCHESTRATOR_CRON_SECRET` Bearer (falls back to `CRON_SECRET`, timing-safe) | Scheduled run: kill-switch check → live signal ingestion (provenance + evergreen fallback) → learning weights → `AUTO_POLICY` materialization, or `HUMAN` mode when autopilot disabled | 200 `{ ok, mode: "AUTO_POLICY" \| "HUMAN", cycles[] \| campaignId, pausedProviders[], signalProvenance, … }` | 503 `CONTENT_ORCHESTRATOR_NOT_CONFIGURED`; 401 `UNAUTHORIZED`; 423 `TOKMETRIC_LOCKED` (kill switch engaged) |

Test mapping: `social-autopilot.test.ts` (8), `social-autopilot-governance.test.ts` (30), `social-autopilot-rollback.test.ts` (3), `content-orchestrator-governance.test.ts`.

## Deployment status

- All 17 route files (24 method handlers) are implemented on `feat/social-automation-control-plane` at `41dfbad9f24667839058eb84adb389f8cd4d13ab`.
- Worker routes are wired to Vercel cron schedules in `vercel.json` (19 crons; see handoff section E).
- **Not yet live:** the branch has not been merged or deployed; the routes become reachable when the owner merges this PR and Vercel deploys it. No production deployment was performed by WS-F.
- Database tables used by the routes come from migrations `20260929120000_social_provider_tiktok_and_pause` and `20260929121500_social_metric_snapshots`; both must be applied via the owner-approved path before first use (see `human-required.md`).

## 404 audit result

Every claimed route file exists and exports its claimed method handlers — **zero routes 404 by construction**. One note for the owner: `vercel.json` also registers a 19th cron, `/api/internal/recovery-readiness-watch` (pre-existing, non-social), which is outside this inventory's scope.
