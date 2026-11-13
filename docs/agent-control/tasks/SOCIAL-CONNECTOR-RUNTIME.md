# Social connector runtime repair

Owner: ChatGPT Work / social connection lane, 2026-11-13.
Base: 6ca45ae2247368f4005423d329ebb68afee76b28.
Scope: social connector database diagnostics and focused tests; no publishing, credentials, other projects, or schema writes.
Goal: diagnose the production pre-OAuth error and restore actual account authorization.
Verification: safe diagnostic allowlist tests, existing connector authority tests, typecheck, lint, canonical preview and live readback.
Rollback: revert this scoped commit.
Status: IN_PROGRESS. OAuth account persistence has not passed.
