# Isolated development deployment

- Owner: ChatGPT Work; source issue #496.
- Base: 7c6ef0e5defac773ca86e00d256ab62caada866b.
- Implementation branch: fix/development-deployment-496.
- Scope: deployment guard, isolated config, build preflight, regression tests and deployment documentation.
- Excluded: production settings, migrations, provider credentials, account connections, publishing, paid services.
- Acceptance: canonical behavior preserved; exact development project builds only the dedicated branch as preview with the development config; unknown projects fail closed; no development crons/auto-approval; missing or wrong-database credentials fail before build without logging secrets.
- Rollback: restore the development project's ignored build command to exit 0 and stop its deployment branch. Never merge that branch's vercel.json overlay into main.
- Status: implemented; independent review findings resolved. Local claims check, lint, typecheck, 1,513 unit tests and Next production build passed; 1,513 tests also pass with the selected development config/environment. The standard verify chain stopped at a sandbox-restricted tsx IPC socket; the claims check passed through node --import tsx and remaining checks ran individually. Hosted preview remains to be checked. Private development database URLs and JWT_SECRET remain required; no working development site claimed.
