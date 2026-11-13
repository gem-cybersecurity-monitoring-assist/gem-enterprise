# Social connector runtime repair

Owner: ChatGPT Work / social connection lane, 2026-11-13.
Base: 6ca45ae2247368f4005423d329ebb68afee76b28.
Scope: social connector database diagnostics and focused tests; no publishing, credentials, other projects, or schema writes.
Goal: diagnose the production pre-OAuth error and restore actual account authorization.
Verification: safe diagnostic allowlist tests, existing connector authority tests, typecheck, lint, canonical preview and live readback.
Rollback: revert this scoped commit.
Status: IN_PROGRESS. OAuth account persistence has not passed.

## Workspace access prerequisite
Owner-approved connector completion also requires the existing audited role/membership editor to use the verified social database for gateway sessions. Scope includes workspace-access-admin catalog and mutations, its existing API/component, and regression tests. No automatic grants, SQL writes, publishing rights or other workspaces.

Production diagnostic confirmed TLS_CERTIFICATE on 2026-11-13. Repair supplies the official public Supabase Root 2021 CA (SHA-256 807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa) only to the project-bound social client, retaining sslmode=require and sslaccept=strict. No certificate-verification bypass, password reset, global database change or automatic access grant.
