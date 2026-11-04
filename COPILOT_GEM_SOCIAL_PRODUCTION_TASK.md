# GEM Enterprise — Copilot Agent Execution Task

> **Execution mode:** GitHub Copilot Agent in the existing Codespace.  
> **Repository:** `gem-cybersecurity-monitoring-assist/gem-enterprise`  
> **Working branch:** `copilot/gem-social-platform-production`  
> **Goal:** Complete the existing multi-platform social management product end-to-end. This is an implementation task, not an audit-only or planning task.

## Non-negotiable execution rules

Work directly in this repository and this branch. Inspect the current code before changing it. Preserve existing working functionality, user data, product design, and established architecture. Do not replace the app, create a parallel demo, add fake connection cards, fabricate credentials or provider responses, or claim deployment without verifying it. Do not require a paid Base44 plan or wait for the user's PC/Desktop Commander. Make safe code changes autonomously, run commands and tests, fix failures, and continue through all phases in this task. Do not stop after producing a plan or status report.

Do not commit secrets. Never put client secrets, access/refresh tokens, signing keys, or database credentials in frontend code, browser storage, logs, test fixtures committed to Git, or API responses. Use server-side environment variables and encrypted server-side token storage. Never bypass approval, workspace authorization, or emergency lock to make a demo work.

## Scope: all social providers, independently

Implement and validate these integrations as separate provider adapters and account types:

1. **TikTok Organic** — official OAuth, signed state/CSRF, token exchange/storage/refresh/revocation, account/profile retrieval, granted scopes, video upload/publishing where approved, publish status, and analytics where authorized.
2. **Instagram** — correct official Meta professional-account authorization, linked Page requirements, account discovery, image/video/Reels publishing where supported, insights, token lifecycle.
3. **Facebook** — Meta OAuth, Page discovery and Page token handling, text/image/video publishing, publish confirmation, Page insights, token lifecycle.
4. **X** — official OAuth 2.0/PKCE as appropriate, profile retrieval, text/media publishing only where API entitlement permits, status/history, analytics if available, token lifecycle.
5. **YouTube** — Google OAuth, channel discovery, resumable video upload, metadata/thumbnails/privacy settings where supported, upload processing status, YouTube Analytics where authorized, token lifecycle.
6. **TikTok Shop Seller** — separate Seller Partner authorization and seller/shop APIs.
7. **TikTok Shop Creator/Affiliate** — separate creator/affiliate authorization and capabilities. Never infer Shop access from TikTok Organic access.

Use each provider's current official API documentation and actual approved scopes. Respect API tiers, app review, account type, regional availability, and publishing restrictions. If an external credential, approval, entitlement, or user authorization is missing, finish all code and configuration possible and show the exact missing prerequisite. Do not mark the provider connected until a real authorization and account verification succeeds.

## Phase 1 — inspect the actual codebase and recover build

- Read `AGENTS.md`, repository instructions, architecture docs, package manifests, lockfiles, environment examples, existing connector modules, database schema/migrations, routes, UI, deployment files, and recent history.
- Map current implementations for all seven provider tracks. Reuse existing integrations and avoid duplicate systems.
- Reproduce the current build/editor failure and identify its first root cause from actual logs. Fix it; do not merely rerun builds.
- Inspect the existing branch state and preserve unrelated work.
- Report the actual framework, backend, database, hosting, job runner, and auth architecture in the final report.

## Phase 2 — connector architecture and account center

Build/reuse a shared server-side connector contract with provider-specific adapters for:
- OAuth start/callback, state signing and validation, CSRF protection, redirect URI validation;
- token exchange, encrypted storage, refresh, revocation/disconnect;
- account discovery, identity verification, granted-scope tracking;
- provider health/readiness, normalized errors, rate limits, retries, audit events;
- provider-specific read, publish, upload, and analytics operations.

The Connections Center must show provider, account identity, connection state, granted scopes, connected date, last successful check/sync, token expiry/health, and actual available capabilities. Support multiple accounts per provider where allowed. A failure on one provider must not block another.

Use truthful states such as READY, CONNECTED, PARTIAL, NOT_CONFIGURED, ACTION_REQUIRED, APPROVAL_REQUIRED, TOKEN_EXPIRED, ERROR, and DISCONNECTED. Do not display green/connected unless a real provider response confirms the account and scopes. Never treat a local configuration check as live authorization.

## Phase 3 — content, publishing, approvals, analytics

Complete the existing Content Studio, media library, calendar, compliance/approval center, publishing queue, and analytics dashboard. Preserve the current UI and workflow.

Content workflow must include draft creation, media upload, per-platform variants, preview, approval, scheduling, queueing, publish attempt, provider-confirmed result, retries, cancellation, and history. Use separate provider payload builders; do not assume one payload works everywhere. Support text, images, short-form video, Reels, TikTok videos, and YouTube uploads only where the provider supports them.

The queue must run server-side/background, not depend on an open browser. Implement idempotency, time zones, duplicate prevention, retry/backoff, rate-limit handling, resumable uploads where appropriate, and recovery after worker restart. Mark content PUBLISHED only after the provider confirms it and returns a verifiable external post/video ID or status.

Approval records must bind to immutable content/media version hashes. Material edits invalidate prior approval. AI may draft/adapt/suggest but must not approve its own restricted content or bypass human policy.

Analytics must be provider-backed. Distinguish unavailable metrics from zero; never synthesize live analytics. Store dated snapshots and show source/provider and last sync.

## Phase 4 — security, workspace isolation, emergency lock

Verify authentication, role-based authorization, workspace ownership, tenant isolation, secure secret handling, input validation, callback protection, rate limiting, audit logs, and sensitive-data redaction. Ensure one workspace cannot read or mutate another workspace's accounts, tokens, content, jobs, or analytics.

Verify Emergency Lock blocks all external write operations (publishing, ads, Shop mutations, and other provider mutations) while allowing safe diagnostics/read-only checks. Every external write must enforce authentication, workspace permission, role, approval policy, idempotency, and audit logging. Do not weaken security to make tests pass.

Keep advertising spend and Shop mutations disabled unless explicitly configured and separately authorized.

## Phase 5 — repair all existing product areas

Inspect and repair the existing Dashboard, Connections, Developer Applications, Content Studio, Media Library, Calendar, Compliance, Approvals, Publishing Queue, TikTok Shop, Advertising, Analytics, Jobs, Audit Logs, Emergency Control, GPT Connection, Production Readiness, Settings, authentication, workspace, and team management. Fix broken imports, nonfunctional controls, missing routes, invalid API contracts, incorrect status indicators, and runtime errors. Preserve unrelated functionality and data.

## Phase 6 — tests and production readiness

Run available dependency install, lint, typecheck, syntax, unit, integration, migration, frontend/backend production build, API route, OAuth, publishing, security, and workspace-isolation checks. Add provider-specific tests for missing credentials, invalid/expired state, callback mismatch, token expiry, permission denial, rate limiting, provider outage, interrupted upload, duplicate publish, emergency lock, and cross-workspace access.

Mocks are permitted for automated tests but must be clearly identified as mocks and never shown as live connected accounts. If real credentials exist in the secure environment, perform real sandbox/authorized checks without exposing them.

Inspect deployment configuration and prepare the actual frontend, backend, database migrations, background workers/schedulers, callback URLs, CORS, health checks, logs, monitoring, and rollback path using the repository's existing hosting. Deploy only if the available credentials and permissions permit it. Verify the deployed health endpoint and real API responses before claiming deployment. Never invent a production URL.

## Completion criteria and final report

Continue through implementation and repair; do not return after the audit. Re-run checks after each repair and at the end. Preserve work with commits on this task branch. Do not merge to main or trigger destructive production migrations without the appropriate explicit approval.

Return one consolidated report with:
1. Exact root cause of build errors and fixes.
2. Files changed and database migrations.
3. Commands run, exit codes, test results, and remaining warnings.
4. Page/navigation/runtime validation.
5. A matrix for TikTok Organic, Instagram, Facebook, X, YouTube, TikTok Shop Seller, and TikTok Shop Creator covering UI, OAuth, credentials configured (yes/no only; never reveal values), live authorization, scopes, read, publish/write, analytics, and truthful state.
6. Security/workspace isolation and emergency-lock results.
7. Deployment and live health status.
8. Exact remaining external prerequisites per provider (credentials, redirect URI registration, app review, permissions, account authorization, API tier, or hosting secret).

**Definition of success:** all code and tests that can be completed in this repository are implemented and passing; every provider is either genuinely connected and verified or explicitly marked with its precise external prerequisite. No placeholders, false green statuses, fabricated analytics, or unverified publishing claims.

**Start now. Inspect the repository and execute the complete task continuously.**
