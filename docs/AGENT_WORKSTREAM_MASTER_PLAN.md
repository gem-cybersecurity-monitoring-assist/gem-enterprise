# GEM Enterprise Agent Workstream Master Plan

Parent programme: #254

Base `main` at plan creation: `c16ae1e270de0f085b5c061eff7ed9f225443999`

## Canonical operating flow

```text
Public discovery
  → Get Started
  → Eligibility status and requirements
  → Typed Enterprise / Community / Product intake
  → Durable public reference
  → Administrator triage and reviewer assignment
  → Qualification and human decision
  → Explicit idempotent conversion
  → Account invitation
  → Client login and session authority
  → Applicant-type KYC / KYB / Trust / Family Office verification
  → Compliance decision
  → Organisation, workspace and entitlements
  → Protected client portal
```

Submission, approval, conversion, identity verification and entitlement activation are separate events. A public submission must not create an account, contract, price, entitlement, approval or service activation.

## Canonical architecture

- Public application: `https://www.gemcybersecurityassist.com`
- Repository: `support371/gem-enterprise`
- Production branch: `main`
- Production deployment: canonical Vercel Git integration only
- Application system of record: PostgreSQL through the approved Prisma/Supabase boundary
- Authentication: canonical GEM signed session and approved Supabase gateway path
- Base44 and external dashboards: orchestration/visibility only; never production systems of record

## Workstream ownership

| Agent | Issue | Workstream | Primary ownership | Starts |
|---|---:|---|---|---|
| Coordinator | #254 | Programme, dependencies and release order | Workstream board, cross-agent boundaries, release evidence | Immediately |
| A | #255 | Public onboarding and route consistency | Get Started, Eligibility, Enterprise apply, Request Access and public CTA tests | Wave 1 |
| B | #256 | Intake lifecycle, applicant status and conversion | Intake APIs, transitions, idempotent conversion and public status | Wave 2 after E interface |
| C | #257 | Authentication, sessions and protected redirects | Auth, middleware, Client Login, Portal and Access Continue | Wave 1 |
| D | #258 | KYC, KYB, Trust and Family Office verification | KYC routes, provider abstraction, evidence and manual review | Wave 2 |
| E | #259 | Production database and Supabase gateway reliability | Data-access boundary, Vercel runtime, health and migrations | P0 / Wave 1 |
| F | #260 | Administrator and reviewer command centre | Admin APIs/UI, reviewer assignment and admin-domain architecture | Wave 2 |
| G | #261 | Store, commerce and external channels | Catalogue, product requests, Google/Wix/TikTok/Facebook/Shopify status | Wave 3 |
| H | #262 | TokMetric and social providers | OAuth, provider review, approvals, publishing gates and disconnect | Wave 3 |
| I | #263 | Trusted video rendering | Worker dispatch, ComfyUI adapter, private media and callbacks | Wave 3 |
| J | #264 | Contact, recovery and transactional notifications | Contact persistence, password recovery, invitation and status mail | Wave 2 |
| K | #265 | CI, deployment and monitoring | Validation source, Vercel deployment evidence and runtime monitoring | Wave 4 |
| L | #266 | Independent QA, claims and security | Route crawler, claims evidence, tenant isolation and release sign-off | Baseline now; release gate always |
| M | #267 | Historical PR and backlog triage | Disposition of stale, duplicate, conflicting and experimental PRs | Baseline now |

## File-boundary rules

1. Each slice uses one issue, one branch and one focused PR.
2. Agents must not modify another workstream's primary files without a recorded interface agreement in both issues.
3. Shared schema or authentication changes require Coordinator review before implementation.
4. Avoid broad formatting or unrelated cleanup that creates conflicts.
5. Start from current `main`; do not stack on stale open PR branches unless the Coordinator records the dependency.
6. Existing PRs #219, #248, #249, #250 and #252 are inputs, not automatic merge candidates. Compare and revalidate them against current `main`.

## Execution waves

### Wave 0 — governance and evidence baseline

- #254 Coordinator publishes dependencies and blocks overlapping file ownership.
- #266 Agent L captures route, redirect, claims and security baseline.
- #267 Agent M classifies historical PRs.

### Wave 1 — remove current blockers

Run in parallel where file ownership remains separate:

1. #255 public onboarding routing
2. #259 production data/gateway reliability
3. #257 session and protected redirect correction

Wave 1 exit criteria:

- Public applicant route reaches the correct public application.
- No production Prisma initialisation errors remain.
- Session context preserves role, KYC, organisation, portfolio and entitlements.
- Canonical Vercel previews are exact-head READY.

### Wave 2 — complete the client lifecycle

1. #256 intake conversion and applicant status
2. #258 applicant-type KYC/KYB
3. #260 administrator conversion and review UI
4. #264 transactional notifications and password recovery

Wave 2 exit criteria:

- Approved applicant can be explicitly converted once without orphaned records.
- Invitation is generated only after committed conversion.
- User signs in and enters the correct verification lane.
- Human-controlled decision creates the correct organisation/workspace entitlement path.

### Wave 3 — external business services

1. #261 commerce/channel verification
2. #262 TokMetric/social provider certification
3. #263 trusted video rendering

Each provider or channel must use its own focused slice. Configuration, provider approval, user authorisation and external-write activation remain separate gates.

### Wave 4 — release operations

1. #265 consolidate CI and monitoring.
2. #266 run independent end-to-end QA.
3. #254 assemble release evidence and owner approvals.

## Cross-workstream interfaces

### A → B
Public intake submits a validated applicant type and returns a durable public reference. It creates no account or entitlement.

### B → J
B commits the intake transition/conversion, then emits an idempotent notification event. J delivers transactional communication outside the database transaction.

### B → D
Conversion persists the authoritative applicant type and KYC/KYB lane. D must not infer it from a query string or browser field.

### B → F
F invokes the explicit conversion API and displays immutable history. F must not create user/organisation/workspace records directly.

### E → B/C/D/F/J
E provides the documented production data-access contract and readiness diagnostics. Other workstreams must not independently invent database/gateway fallbacks.

### C → D/F
C supplies the authoritative signed session, role, KYC status, organisation, portfolio, entitlements and session version.

### H → I
I produces governed media versions. H may only reference an approved exact media/content version and must never publish merely because rendering completed.

### L → all agents
Critical route, claims, tenant-isolation or secret-exposure findings block promotion.

## Pull-request handoff contract

Every PR must state:

1. Agent/workstream and issue.
2. Base `main` SHA and exact head SHA.
3. Routes, redirects and rewrites changed.
4. APIs and data models changed.
5. Migration and compatibility impact.
6. External providers involved.
7. Environment-variable names required, without values.
8. Security, privacy and public-claims impact.
9. Tests and verification output.
10. Canonical exact-head Vercel preview.
11. Manual owner actions.
12. Rollback method.
13. Explicit list of capabilities not activated.

Use `docs/AGENT_PR_HANDOFF_TEMPLATE.md`.

## Mandatory verification gate

- Prisma schema-source checks
- public claims report
- ESLint
- TypeScript
- full Vitest suite
- focused workstream tests
- optimised Next.js build
- exact-head canonical Vercel READY preview
- no unresolved review threads
- independent QA for release-impacting changes
- migration rehearsal and owner approval when applicable
- documented rollback

A runner that does not start is not a successful code check. Record runner availability separately from repository verification.

## Owner-only actions

Agents may prepare and verify but must not independently perform:

- production secret creation or rotation
- production database migration
- identity-provider production activation
- applicant eligibility or identity decision
- payment or subscription activation
- paid-provider commitment
- legal/regulatory public representation
- live social publishing
- advertising expenditure
- TikTok Shop, seller or merchant write
- automatic PR merge
- direct production deployment outside Vercel Git integration
- production-domain or authentication-system migration

## Programme definition of done

The programme is complete when a new applicant can select the correct path, submit a durable request, receive a reference, be reviewed, be explicitly converted without duplication, receive a secure invitation, sign in, enter the correct verification lane, receive a human-controlled decision, obtain organisation-scoped entitlements and reach the correct protected workspace. Every transition must be auditable, fail-closed and supported by exact-head preview plus production smoke evidence.