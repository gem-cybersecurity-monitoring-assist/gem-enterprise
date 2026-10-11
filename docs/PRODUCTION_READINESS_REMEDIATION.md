# Production readiness remediation

This change prepares reviewable application improvements. It does not activate providers, apply production migrations, or authorize a production deployment.

## Included improvements

- Correct autopilot slot jitter without dropping the final bounded slot.
- Restore controlled public community redirects and fix the review dialog's stale busy-state handler.
- Discover all test files under `src`, including previously omitted library tests.
- Match service readiness to the requested module; an unrelated social account cannot satisfy financial provider readiness. Unknown financial providers require explicit server-owned `moduleIds` mappings. Current database connector records are not financial integrations, so financial capabilities correctly remain unavailable until implemented.
- Report authentication configuration independently from database health. The public health check never claims it executed a login.
- Support shared atomic Redis REST rate limiting across API handlers. Partial configuration, endpoint failure and malformed responses fail closed instead of reverting to per-instance counters.

## Shared rate-limit configuration

The adapter accepts an Upstash-compatible HTTPS Redis REST endpoint, using a single atomic Lua counter/expiry operation. Configure these names in the approved server-side secret/environment store, without committing values:

- `GEM_RATE_LIMIT_REDIS_URL`: HTTPS endpoint, without embedded credentials.
- `GEM_RATE_LIMIT_REDIS_TOKEN`: authorization credential.
- `GEM_RATE_LIMIT_SHARED_REQUIRED=true`: deny protected requests if shared configuration is missing or unavailable.

Local development without shared configuration retains the existing bounded process-local limiter. Production rollout must either configure and verify the shared adapter with the required flag or demonstrate approved equivalent edge protection. Do not declare global abuse protection ready solely from unit tests. Credentials are never forwarded through redirects. Counter identifiers are hashed; Redis keys do not contain raw emails/IP addresses.

Acceptance: configure the approved endpoint, allow the exact host, exercise simultaneous requests from independent workers, confirm the shared threshold and expiry, and verify an outage returns 503 without executing protected writes. No paid service is activated by this change.

## Release gates still requiring runtime access

1. Review a branch and create the canonical Vercel preview; verify the exact SHA and role/tenant customer scenarios before an approved merge.
2. Validate migrations in a disposable Supabase-compatible database. Generic local PostgreSQL does not supply Supabase storage schemas, pg_cron/pg_net or deployed gateway functions.
3. Verify production migration history, SQL security invariants, backup restoration and rollback on the approved target; never use schema push for this proof.
4. Verify actual SMTP recovery delivery and completion, provider OAuth/webhook/worker pilots, and monitoring/alert delivery.
5. Keep document upload disabled until its production handler, scanning, quarantine, review authorization and retention pipeline are implemented and tested.
6. Keep unsupported financial execution, custody and regulated decisions disabled pending a defined service scope and approvals.

Publishing a cloud environment snapshots development files; it does not merge application changes or prove live production behavior.

## Local end-to-end harness and dependency hardening

Run `node scripts/local-customer-e2e.cjs` against the local production-mode server and disposable development database. The harness rejects non-loopback targets, creates unique temporary fixtures, and removes them afterward. It exercises two tenants, customer/staff authorization, request assignment and closure, project delivery, independent weekly-update review, audit persistence, membership suspension and session revocation. Fixtures are provisioned directly: this does not establish production intake/invitation email or gateway behavior.

Next.js, PostCSS, Sharp and Nodemailer were updated to security-fixed versions; compatible Browserslist dependencies were refreshed. Native PNG encode/decode and local MIME generation were checked. No email was delivered externally. A targeted follow-up refreshes AI SDK, Vitest/coverage, jsdom and tsx, and uses scoped patched dependency overrides for brace-expansion, js-yaml, Babel, selector parsing and Vitest's supported Vite 8 range. Vite is explicitly declared so dependency resolution selects a patched release. Both the full and production dependency audits now report one high finding and zero critical/moderate/low findings. The remaining high `braces` advisory has no published patch and appears through build-tool dependency paths including Tailwind and ESLint. This is a residual review item, not a clean audit or proof of non-exploitability. Do not accept untrusted build/glob configuration; reassess when an upstream fix is released.

Staff request mutations now require same-origin submission and rate limiting in addition to active-account/staff authorization. Provider and document-upload activation gates remain unchanged.

Latest local validation: `verify:preview` passed schema and public-claims checks, zero-warning lint, TypeScript, and 950 tests across 148 files. The production build passed. After restarting that build, the local harness passed 23 HTTP checks, including rejection of missing/untrusted origins for staff mutations. These are API/database checks with directly provisioned fixtures, not browser automation or live production acceptance. Production gates above remain open.
