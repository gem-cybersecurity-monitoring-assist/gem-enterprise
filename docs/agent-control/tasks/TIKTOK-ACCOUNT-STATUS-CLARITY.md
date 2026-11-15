# TikTok accounts status clarity

Owner: ChatGPT Work. Issue #504. Branch: fix/tiktok-account-status-clarity.
Base main: 62c942ab81f0c1c70d933eb7938b799ed504bdb7.

Remove the accounts view's contradictory static account-state table. Its real
TokMetricConnectorPanel already reads authorized records and verifies TikTok
identity. Replace the accounts-only pre-connection banner and obsolete build
checklist with safeguards and existing practical review steps. Keep other page
kinds, Shop flow, credentials, scopes, database and publishing gates unchanged.
Owned: TokMetricWorkspacePage.tsx, rendered accounts-page test and these records.
No schema, secret, provider/API or paid changes. Test real rendered page against
a mocked saved connection, not source-string assertions. Independent review,
local checks and exact-head hosted preview before Git-owned release.
Rollback focused UI commit. Status: IMPLEMENTED; independent review found no concrete blockers. Local schema generation/checks, claims, lint, typecheck, 1,537 tests/225 files and production build passed. Hosted exact-head gates and release pending.
