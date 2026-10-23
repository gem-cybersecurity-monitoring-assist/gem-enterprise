# GEM Enterprise Agent Pull Request Handoff

Copy this template into every workstream pull request.

## Identity

- Agent/workstream:
- Parent issue:
- Focused issue:
- Base branch: `main`
- Base SHA:
- Exact head SHA:
- Canonical Vercel project: `prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z`
- Canonical Vercel team: `team_7lMXW95WSLeyK4yAObe8FptW`
- Exact-head preview deployment:

## Objective

Describe the smallest complete vertical slice and the user or operator outcome.

## Owned scope

### Routes changed

- None / list exact routes

### Redirects, rewrites or middleware changed

- None / list source → destination and authentication behaviour

### APIs changed

- None / list method and exact path

### Files changed

- List exact files and explain why each belongs to this workstream.

## Data impact

- Prisma models changed: Yes / No
- Migration included: Yes / No
- Data backfill required: Yes / No
- Compatibility assessment:
- Disposable PostgreSQL rehearsal:
- Production migration authorised: No unless explicit owner evidence is linked

## External services

- Providers involved:
- Configuration status:
- Platform approval status:
- User authorisation status:
- External write status:
- Provider calls made during smoke tests:

## Environment requirements

List variable names only. Never include values.

- None / `VARIABLE_NAME`

## Security and privacy impact

- Session/role impact:
- Tenant-isolation impact:
- Sensitive-data handling:
- Token/secret handling:
- Rate limiting and replay protection:
- Audit/evidence records:
- Retention/deletion impact:

## Public claims impact

- Claims added or changed:
- Evidence owner/location:
- Classification: verified / conditional / demonstration / planned / expired / unsupported
- Expiry/review date:

## Verification

- [ ] Prisma schema-source checks
- [ ] Public claims report
- [ ] ESLint
- [ ] TypeScript
- [ ] Full Vitest suite
- [ ] Focused workstream tests
- [ ] Optimised Next.js build
- [ ] Exact-head canonical Vercel deployment READY
- [ ] Route/redirect smoke tests
- [ ] Mobile and accessibility smoke tests where applicable
- [ ] No unresolved review threads
- [ ] Independent QA for release-impacting changes

Record commands, result counts and evidence references.

## Manual owner actions

- None / list exact owner-controlled action.
- Confirm no secret, migration, payment, identity-provider, live publishing or production deployment action is implied by merge alone.

## Not activated

Explicitly list capabilities that remain disabled, request-only, sandbox-only or fail-closed.

## Rollback

- Code rollback:
- Data rollback/recovery:
- Provider/feature-gate rollback:
- Smoke checks after rollback:

## Final declaration

- The PR is focused and contains no unrelated cleanup.
- No browser-supplied role, organisation, entitlement, provider state or payment state is treated as authoritative.
- No sample or planned capability is represented as live.
- Production deployment remains owned by Vercel Git integration.
- High-impact owner actions remain unperformed unless separately evidenced.