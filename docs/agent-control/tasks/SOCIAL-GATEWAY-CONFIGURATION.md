# Social gateway configuration failure repair

Owner: ChatGPT Work. Issue #500. Branch: fix/social-gateway-configuration.
Base: 7c6ef0e5defac773ca86e00d256ab62caada866b.

The original publishing function exits during startup when the machine secret
is missing, producing WORKER_ERROR rather than a controlled setup response.
Build a fail-closed request guard and lazy client initialization. Preserve
machine authentication, every RPC action, method/CORS behavior and publishing
gates. Redact raw exceptions from logs as well as responses.

Owned files: supabase/functions/gem-social-publishing-gateway/index.ts,
direct handler regression tests, activation runbook and this task record.
No overlap with workspace navigation PR #499 or development PR #497.
No schema, secrets, provider scopes, production deployment, publishing flags,
paid services or unrelated project changes.

Acceptance: missing configuration registers a handler and returns stable 503;
no database call before authentication; wrong/missing bearer remains 401 when
configured; valid health reaches the existing RPC; JSON errors are 400; raw
exceptions/credentials never enter responses or logs. Test the actual Deno
handler with fake runtime and Supabase boundaries, not a duplicate function.

Verify focused/full tests, lint/typecheck/build, independent review and hosted
exact-head checks. Edge-runtime deployment and live acceptance remain separate
owner actions. Missing secret installation is not solved by this repair.
Rollback: revert this focused change. Status: IMPLEMENTED; hosted gates pending.

Node 24.22.1 / pnpm 10.28.0: 30 focused tests passed; full suite 1,486
tests across 219 files passed. Schema generation/consistency, claims report,
lint, typecheck and website production build passed. Local aggregate verify
stops at tsx Unix IPC listen EPERM; the identical claims script passed with
node --import tsx, then remaining checks passed individually. Dependencies were
reused from an identical lockfile after registry access was blocked. Independent
code review found no concrete blockers. Deno import resolution/typecheck and
hosted edge deployment are not verified by the Node VM test harness. A fresh
live unauthenticated health POST still returns 500 WORKER_ERROR, as expected
for the unchanged hosted source; no runtime fix or secret installation claimed.
