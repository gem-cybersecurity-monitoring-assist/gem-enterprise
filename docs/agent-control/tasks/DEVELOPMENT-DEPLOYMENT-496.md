# Isolated development deployment

- Owner: ChatGPT Work; source issue #496.
- Base: 7c6ef0e5defac773ca86e00d256ab62caada866b.
- Implementation branch: fix/development-deployment-496.
- Scope: deployment guard, isolated config/build preflight, regression tests, documentation and dedicated development-only runtime access/credential provisioning.
- Excluded: production settings/data/credentials, canonical migration-chain changes, provider credentials, social account connections, publishing, paid services.
- Acceptance: canonical behavior preserved; exact development project builds only the dedicated branch as preview with the development config; unknown projects fail closed; no development crons/auto-approval; missing or wrong-database credentials fail before build without logging secrets.
- Rollback: restore the development project's ignored build command to exit 0 and stop its deployment branch. Never merge that branch's vercel.json overlay into main.
- Status: PR #497 published; parent head 27a621a04cea675f043fa7911dc7f02e14bbf683 passed hosted CI/migration replay/credential scan and canonical preview. Local aggregate verify was blocked by tsx IPC; component checks and build passed. Dedicated runtime continuation now has an independent JWT secret, encrypted Vault-held database password, direct URL saved in Vercel Preview, and verified restricted-role grants. Role-aware validator passes 1,516 tests, lint and typecheck; independent review found no remaining blocker in these changes. Role remains NOLOGIN; exact shared pooler hostname, pooled Preview URL, new-head hosted checks and actual development connectivity remain pending. No working development website claimed.
