# Owner gateway diagnostics before activation

Owner: ChatGPT Work. Issue #506. Branch: fix/social-gateway-owner-diagnostics.
Base main: e279a96d892e37ea9835f16b2e8cf1e5a1651454.

Add a platform-owner-only fixed health check using the existing machine-secret
transport while publishing flags remain off. Pin the original Supabase function
base before any transport, strictly validate health/RPC inventory, and return
static redacted diagnostics with checked time and unchanged flag states. Add a
44px control to the existing Social Command Center, visible only to the owner.
Owned: new publishing/gateway-diagnostics.ts, gateway-health API route, new
SocialGatewayDiagnostics.tsx, one Command Center page insertion, focused tests,
activation runbook and these records. Existing publishing probes/gates unchanged.
No secrets entered, state/data writes, migrations, permissions, provider consent,
publishing actions, paid resources or unrelated projects. Fake keys only in tests.
Verify actual auth helper denials/reconciliation, fixed health-only payload,
wrong-target rejection, malformed/partial health, redaction and rendered UI.
Independent review and exact-head hosted gates before Git-owned release.
Rollback this focused PR. Status: IMPLEMENTED. Independent review found no concrete blockers. 50 focused diagnostic/client tests passed; full suite 1,574 tests/227 files passed. Schema generation/consistency, claims (node --import tsx), lint, typecheck and production build passed. Final copy clarification was followed by a fresh full test/build cycle. Exact-head hosted gates and live diagnostic response pending.
