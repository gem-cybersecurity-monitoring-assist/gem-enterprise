# GEM Sentinel collector: free-first runbook

## Truthful status
The source branch adds a **real Next.js collector API, owner-only registry, incident listing and PostgreSQL models**. They must not be described as protecting any device until database migration, enrollment, consent, lab tests and production approval have occurred. No commercial subscription is required by these new modules, but the operator must supply legitimate database/hosting resources.

## Endpoints
- `GET /api/admin/sentinel/collectors` requires platform-owner authenticated session; keys never returned.
- `POST /api/admin/sentinel/collectors` requires platform-owner session, `tenantId`, `source`, `label`, `consentReference`; rejects unknown organizations. Generates a cryptographically random collector key **once**; stores only SHA-256 hash, returns disabled registration.
- `PATCH /api/admin/sentinel/collectors` requires platform-owner session. `{action:"activate",id,consentReference,consentConfirmed:true}` records owner attestation only after independent consent verification. `{action:"revoke",id}` disables the credential permanently.
- `POST /api/security/sentinel/ingest` accepts a registered, enabled collector with `x-gem-sentinel-key`, `x-gem-sentinel-timestamp` (UTC ISO 8601) and `x-gem-sentinel-nonce` (16-96 random URL-safe characters), 16 KiB maximum JSON alert payload. A 5-minute freshness window, persistent unique nonce and per-collector minute quota provide replay and basic abuse controls. HTTP TLS is required at the edge.
- `GET /api/admin/sentinel/events` provides the 100 most recent metadata-only incidents to an authenticated platform owner; optional authorized organization filter.
- `/app/admin/sentinel` shows verified storage status, collectors, and persisted events, never fabricated health or zero-risk claims.

## Setup / deployment gating
1. On a **disposable** PostgreSQL database, verify `prisma validate`, `prisma generate`, focused tests, typechecking, lint, and canonical build.
2. Compare migration to actual schema state, dry run backups, rehearse migration/rollback and restore. Promote `prisma/migrations/20261011210000_sentinel_security_core/migration.sql` only with approved database role after maintenance validation. Do **not** use `db push` to bypass migrations.
3. Validate application session authorization against both existing local JWT and Supabase Gateway modes. Gateway-only deployments must not be described as ready until the database is reachable.
4. Register one organization that has an active GEM member and a signed, scoped agreement covering the exact lab device, alert fields, retention period, response limitations, and data access.
5. Provision a collector as the platform owner. Capture the one-time key in an approved secret manager on the collector host; never paste it into chat, GitHub, environment screenshots, or Telegram.
6. After reviewing the corresponding customer consent, explicitly activate the collector with the matching consent reference and a recorded approval.
7. Use an authorized sensor or test sender, send one bounded Wazuh-style event over HTTPS with a fresh timestamp and nonce; confirm 202, then verify the event appears in the authenticated Sentinel dashboard.
8. Resend the same event with a **different** nonce; verify response indicates `duplicate:true` and does not create another record.
9. Replay exactly the same nonce; verify 409. Test malformed auth, expired credentials, disabled collector, rate limit, oversized payload, same source ID in two tenants, revoked consent, database outage and recovery.
10. Set retention policy and scheduled deletion for nonce and alert tables. The new API does **not** automatically purge retained telemetry; configure the approved retention job before enrolling customer production assets.
11. Run independent penetration, security-header, accessibility and disaster recovery tests; use honest capability claims in store listings and website.

## Security boundaries
- The collector key is a bearer secret transmitted in a custom header over HTTPS. It is **not** a VPN, hardware attestation, or cryptographic evidence that a particular device is healthy.
- Requests are authenticated to a registered collector; authorization scope comes from the database, not the event body.
- A collector consent reference is an operator-governed record, not a substitute for independent legal permission. No automatic protection starts just by saving consent text.
- The API stores summarized event metadata only. It does not store raw logs, passwords, account numbers, banking data, or complete forensic evidence.
- Events do not grant direct security response authority; all response actions remain gated and disabled in this release.
- Secure source-specific adapters, advanced rate limiting, secret rotation, and integration tests remain necessary for broader multi-customer production.
- If live sensor telemetry is unavailable, the dashboard must state that monitoring is not connected rather than report zero threats.

## Rollback
Disable all collectors first, preserve audit evidence, then roll back the application version. Destructive database rollback is *not* automatic and must respect evidence retention. Keep the additive tables until explicitly reviewed for safe archival/deletion.

## Free-first boundary
No mandatory paid third-party API, extra hosting plan, proprietary breach feed, or commercial SIEM needed. Existing hosting tiers may impose build quotas and compute/storage limits; never use those limits as justification to weaken security.
