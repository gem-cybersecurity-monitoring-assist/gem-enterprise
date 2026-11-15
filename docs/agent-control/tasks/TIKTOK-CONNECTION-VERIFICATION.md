# TikTok connection verification

Owner: ChatGPT Work. Issue #502. Branch: fix/tiktok-connection-verification.
Base main: 8598474dd3cd0fd41fdbb0a27721891bedd2ae9c.

Repair the existing health route's persistence authority and add a bounded,
read-only identity check for existing TikTok Content Posting connectors.
Use the same pinned-project session/account/workspace reconciliation as OAuth
readback; require manage/connectors permission before credential access.
The provider response must match the stored account identity. Return only safe
results; persist a safe audit record, never tokens or provider error bodies.
Keep stored authorization separate from fresh verification in the mobile UI.

Owned: new oauth/health.ts, connectors/health route, TokMetricConnectorPanel,
TokMetricSetupStatus (existing health caller), focused health tests, activation runbook and these lane records. No overlap
with isolated development PR497; earlier overlapping connector PRs are merged.
No schema, credentials, token refresh/revoke, scopes, publishing APIs/flags,
paid resources or unrelated projects. Existing publishing guards stay intact.
Tests must cover denied authorities, scoped backend, stale/disabled/malformed
credentials, provider failures, wrong identity, successful verification and
redaction. Run local checks, independent review and exact-head hosted gates.
Rollback the focused code release. Live identity checks do not prove publishing
approval or authorize any post. Status: IMPLEMENTED; independent review complete after resolving existing setup-status consumer and stale workspace error findings. Local schema generation/checks, claims check, lint, typecheck, 1,536 tests across 224 files and production build passed. Aggregate verify encountered the known tsx Unix IPC EPERM; identical claims script passed with node --import tsx and all remaining checks ran individually. Exact-head hosted gates and live check pending.
