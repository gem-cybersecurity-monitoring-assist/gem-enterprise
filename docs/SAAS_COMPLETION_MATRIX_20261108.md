# GEM Enterprise SaaS — implementation and acceptance register

**Updated:** 2026-11-08  
**Repository:** `gem-cybersecurity-monitoring-assist/gem-enterprise`  
**Canonical project:** `support371-gem-enterprise`  
**Release mode:** private pre-market build. Do not activate commerce or community membership from this register.

This document is an additive reconciliation against `README.md`, `docs/GEM_COMPLETE_ROUTE_AND_CAPABILITY_INVENTORY.md`, `docs/GEM_COMMAND_CENTER.md`, `docs/unified-workspace-data-model.md` and the Notion production publishing/roles standard. Existing route presence is **not** runtime certification.

## Source of truth

- Maintain one Next.js application, one approved production Vercel project, the existing session system and the existing PostgreSQL/Prisma persistence.
- Preserve existing GEM operational modules, staff/client permission boundaries and evidence-led claim publishing.
- Never describe mock, seeded or disconnected data as real tenants, customers, revenue, security coverage, monitoring uptime or production integrations.
- Do not absorb separate crypto, copy-management, AI or gaming projects into this repository absent a separate, approved integration contract.
- Production schema promotion, new paid services, provider credentials, automatic publishing and external transfers require separate approvals.

## Implementation matrix

| Area | Existing implementation | Required next backend/frontend slice | Release gate |
| --- | --- | --- | --- |
| SaaS owner control plane | Command-center routes, aggregate snapshot, readiness model | Capability registry and protected SaaS overview added in PR #472; next add verified health by provider and tenant, without assuming active status | Authenticated owner/admin test, canonical preview, accessibility audit |
| Identity/access | Signed sessions, client/admin/analyst roles, protected routes | MFA enforcement, short-lived privileged sessions, revocation/device UI, per-resource tenant authorization regression matrix | AuthZ tests for anonymous, client A, client B, staff, admin, owner |
| Tenant management | Organizations, workspaces, membership and invitations | Owner governance screens, idempotent provisioning, membership audit and onboarding recovery | Database migration tests and cross-tenant proofs |
| Service delivery | Requests, tickets, communications, meetings, customer-success routes | Request-to-assignment-to-closure end-to-end flow and notifications with durable events | Success/error/unauthorized/provider-failure test cases |
| Governance/compliance | Audit, approval, KYC and evidence models | Immutable evidence capture, retention schedules, authorized review and incident escalation | Evidence/privacy/legal review and staff MFA |
| AI and automation | Agent governance, approval and connector foundations | Agent registry binding, allowlisted actions, idempotency and human approval execution paths | Tool permission/evaluation/rollback testing |
| Cybersecurity | Service, intelligence and monitoring-facing routes | Verified telemetry adapters, incident lifecycle and actual coverage evidence | No continuous-monitoring or SLA claim without real staffing/telemetry |
| Social command center | TokMetric, social operations, review/publishing foundations | End-to-end provider OAuth/readiness, draft finalization and approved publishing tests | Provider permissions, disclosure, human approval, idempotency |
| Community | Fictional `/community-hub` preview and application path | Persisted tenant/member identity, groups, posts, reporting, moderation, event ownership, opt-out and deletion | Consent, abuse handling, moderation staff, verified people only |
| Marketplace | Request-only store/service listings | Provider vetting, listings lifecycle, quotes, proposals, cancellation/dispute workflows | No transactions without explicit business/payment gate |
| SaaS billing | Proposed subscription, usage and operating models | Approved plans, signed payment webhooks, metering, invoicing, reconciliation and refunds | Explicit owner authorization, accounting/legal and safe migration |
| Partner/reseller | Organization and partner reference surfaces | Partner applications, verified agreements, role separation and white-label domain tenancy | Contracts, affiliation evidence and security review |
| Developer API | Docs, access and integrations surfaces | Scoped token lifecycle, endpoint contracts, usage quotas, versioning and webhook replay protection | Contract, auth, rate-limit and incident tests |
| Analytics/CRM | Command-center metrics and market/customer-success routes | Real event projections, lead attribution, customer health and export controls | Consent, privacy, source timestamps, no fake metrics |
| Reliability | Vercel, CI, docs and monitoring foundations | Canonical preview gate, backups, restore rehearsal, accessibility and dependency scanning | Reproducible release evidence and tested rollback |

## New read-only SaaS vertical slice in PR #472

- `src/lib/saasCapabilityCatalog.ts`: typed capability registry and non-live labels.
- `src/app/app/command-center/saas/page.tsx`: staff/admin-oriented private control page.
- `src/components/command-center/SaaSOperationalSnapshot.tsx`: fetches real aggregate metrics from the existing command center; unavailable state remains explicit.
- `src/app/api/command-center/saas-capabilities/route.ts`: admin-authorized, non-cacheable inventory API.
- `src/lib/platformNavigation.ts` and `src/app/app/layout.tsx`: admin navigation integration.
- `src/__tests__/saasCapabilityCatalog.test.ts`: catalog invariants.

### Acceptance tests before merge

1. `corepack enable && pnpm install --frozen-lockfile && pnpm run verify` on an authorized, connected build environment; record exit status and commit SHA.
2. Confirm canonical Vercel preview corresponds to the **latest** PR commit. Other duplicate-project statuses are not authoritative.
3. Anonymous, client and analyst access to the SaaS page must be rejected/redirected; admin/internal/owner access to the page and API must be checked individually.
4. Simulate database outage: snapshot displays unavailable (not demo data or zeros).
5. When authorized real aggregates exist, show them with a generated timestamp and no personal records.
6. Check phone-size layout, keyboard navigation, contrast and screen-reader announcements.
7. Ensure no mutation of users, credentials, billing, publication queues or external providers.
8. Merge and production promotion only after required reviews; a successful build does not authorize database migrations or activating gated products.

## Explicit gaps and blockers

- A verified canonical preview build is **not** equivalent to full authenticated end-to-end acceptance.
- Codespace/Desktop Commander may be offline, requiring a reachable authorized test runner.
- Production community membership, marketplace orders, billing and live provider writes are not activated.
- The operating-layer schema proposal in `prisma/proposals/20260713_command_center_operating_layer.sql` has not thereby been approved as a production migration.
- Staff identities, licenses, corporate metrics and service guarantees require evidence from the approved verification registry and current operational systems before display.
