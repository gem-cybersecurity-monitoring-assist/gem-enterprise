# GEM ↔ Zoho Catalyst Control-Plane Bridge

This integration extends GEM through Zoho Catalyst without duplicating GEM business data or authorization.

## Authority boundary

- GEM PostgreSQL/Prisma remains authoritative for users, organizations, workspaces, projects, roles, approvals, audit events, service requests, campaigns, assets, support, and other domain records.
- Catalyst provides an execution bridge only.
- The bridge exposes only allowlisted read operations during the first deployment slice.
- Missing credentials, missing runtime, invalid upstream responses, and unsupported operations fail closed.

## Catalyst target

- Project: `Project-Rainfall`
- Project ID: `85214000000014023`
- Organization: `939258801`
- Initial environment: `Development`
- Function type: `AdvancedIO`
- Recommended function reference: `gem_control_plane`

## Required runtime variables

Configure these on the Catalyst function only. Never commit their values.

- `GEM_AGENT_API_BASE_URL=https://support371-gem-enterprise.vercel.app`
- `GEM_AGENT_API_KEY=<same protected server-to-server credential configured for the GEM agent API>`

## Initialization

Use the Catalyst CLI from a clean working tree and associate the directory with the existing `Project-Rainfall` project. Initialize an Advanced I/O Node.js function using the current runtime offered by the CLI. The CLI must generate `.catalystrc`, `catalyst.json`, and the function `catalyst-config.json`; do not hand-edit the generated runtime stack value.

Copy `index.js`, `bridge.js`, `package.json`, and `test/` from this directory into the generated `functions/gem_control_plane/` folder, then install dependencies.

## Local verification gate

Run:

```bash
npm install
npm test
catalyst serve
```

Pass criteria:

1. `npm test` passes all tests.
2. `/health` returns the same safe operational/degraded result class as GEM `/api/agent/health`.
3. `/context` returns GEM platform context and accepts only `platform`, `stores`, `tiktok`, or `google` views.
4. Removing `GEM_AGENT_API_KEY` returns a fail-closed 503 response.
5. Unknown routes return 404 with `BLOCKED_BY_POLICY`.
6. No request can choose an arbitrary upstream URL or arbitrary GEM API path.

## Development deployment

Deploy only after the local gate passes:

```bash
catalyst deploy
```

After deployment, confirm the function appears in Catalyst Functions for Project-Rainfall Development.

Do not promote to Production at this stage.

## API Gateway gate

Only after the function exists remotely:

- create API Gateway routes for `/gem/health` and `/gem/context`;
- target the deployed `gem_control_plane` Advanced I/O function;
- require API Key authentication at the gateway;
- apply conservative throttling;
- keep CORS limited to the approved GEM hostnames already configured in Catalyst.

Do not expose a catch-all route.

## End-to-end acceptance

The integration is `READY` only when all of the following are proven:

- Catalyst function deployed in Development;
- required environment variables configured without exposing the secret;
- gateway routes target the exact deployed function;
- unauthenticated gateway request is rejected;
- authenticated `/gem/health` succeeds;
- authenticated `/gem/context` succeeds;
- missing GEM agent credential causes 503 rather than fallback access;
- arbitrary paths are not proxyable;
- GEM database and authorization remain untouched;
- Catalyst `GEM_CATALYST_BINDINGS` record is updated from `READY_FOR_FUNCTION_DEPLOYMENT` to `READY` only after smoke tests pass.

## Rollback

Rollback consists of disabling/deleting the two Catalyst API Gateway routes and disabling the Catalyst function. GEM remains independently operational because Catalyst is not the system of record and no GEM domain tables are mirrored here.

## Expansion rule

Write operations may be added later only as individually allowlisted business operations that call existing GEM policy-controlled endpoints. Never add a generic database proxy, arbitrary HTTP proxy, role bypass, or agent self-approval path.
