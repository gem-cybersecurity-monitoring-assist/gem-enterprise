# Task Contract — UNIFIED-WORKSPACE-OS

Owner: Muse / unified workspace lane
Source: owner mandate 2026-09-29 ("GEM ENTERPRISE UNIFIED CLIENT OPERATING PLATFORM — FULL IMPLEMENTATION MANDATE", 17 sections)
Working branch: `feat/unified-client-workspace-os`
PR: #374 (open; do NOT merge without explicit owner authorization)

## Objective

Turn GEM Enterprise into the complete operating system through which GEM
acquires, qualifies, activates, manages, protects, communicates with, delivers
services to, bills, supports, retains and expands each client — one client, one
identity, one login, one organization, one workspace, one management record,
many GEM services behind it. Extend the existing architecture; do NOT build a
separate app, duplicate CRM, duplicate client database, or disconnected
dashboard.

## Owned file sets (one mutation owner per set)

- WS-A: `src/lib/capabilityReadiness.ts`, `src/__tests__/capabilityReadiness.test.ts`,
  `src/components/capability/ReadinessBadge.tsx`
- WS-B: `src/lib/commandCenter*.ts`, `src/app/app/command-center/**`,
  `src/app/app/command-center/_components/*`, `src/__tests__/command-center*.test.ts`
- WS-C: `src/app/app/workspace/page.tsx`, `src/components/workspace/*`,
  `src/lib/clientWorkspaceCatalog.ts` (additive), `src/lib/workspaceModuleReadiness.ts`
- WS-D: `src/app/app/admin/client-operations/page.tsx`,
  `src/components/admin/client-operations/*`
- WS-E: `src/lib/serviceRequests.ts`, `src/app/api/admin/requests/**`
- WS-F: `prisma/schema.prisma` (append-only), `prisma/migrations/*` (new),
  `docs/unified-workspace-data-model.md`
- WS-G: new focused tests under `src/__tests__/` for readiness consumers,
  tenant isolation, route separation, entitlements, provider-not-configured
  states, audit events, approval gates, incident visibility
- Coordinator: this contract, `docs/agent-control/ACTIVE-WORK.md` lane row,
  commit/push via GitHub API, gates, preview verification, final report

## Forbidden overlap

Other active lanes (ads bridge, social autopilot, TikTok shop, news scroll,
PR #291 / #292 / #252 files); provider credentials; production data;
auth/session core outside owned files; any file owned by another workstream.

## Hard rules

1. No secrets in code, tests, logs, or commits.
2. No fabricated balances, holdings, transactions, incidents, tenants, or
   provider connectivity. Unbacked capabilities render explicit
   setup/not-connected state and fail closed.
3. Server-side auth on every sensitive page/API (`requireSession` +
   `isAdminRole` / `isStaffRole` / `isPlatformOwnerRole`); tenant isolation on
   every query; never weaken platform-owner checks.
4. Reuse existing Prisma models; additive-only schema changes with migrations.
5. Do NOT merge into main. Preview deployments allowed and expected.
6. Never claim a skipped or unstarted check passed. Exact-head evidence required.

## Completion evidence required

- `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run verify:preview`
  (configuration-independent parts), `pnpm run build`
- Prisma validate + schema-check scripts
- New tests listed above, all passing
- Preview deployment of the branch verified for unauthenticated behavior;
  authenticated role verification via code-inspected gates + unit tests
  (no production credentials used)
- Section-17 completion package in the final report

## Implementation status — 2026-09-29

All seven workstreams complete. Coordinator remediation: removed hardcoded
fabricated "Operating posture" percentages (94/87/91/84%) and fabricated
tenant filter options (Northstar Health / Apex Realty Group / Harbor Financial)
from `src/components/command-center/CommandCenterView.tsx` (outside WS-B's file
set); both now render explicit not-connected / setup-required states.

Focused tests: 120/120 pass —
capabilityReadiness 32, command-center suite 19, workspaceModuleReadiness 24,
serviceRequestLifecycle 18, roleGating 13, commandCenterHonesty 14.
`tsc --noEmit`: zero errors in workstream files (only the known sandbox
`@prisma/client` generation stub errors). ESLint: clean on all workstream files.

Corrections applied and verified:
- WS-E lifecycle aligned to existing Prisma RequestStatus enum
  (open/in_progress/pending_info/completed/cancelled).
- WS-F model renamed CustomerLifecycleState -> LifecycleFunnelState
  (table lifecycle_funnel_states) to avoid the existing TS type collision.
- WS-E onboarding audit: PASS — provisionOrganizationWorkspace is atomic;
  invitation acceptance delegates to gateway edge functions; platform-admin
  never granted.
- WS-E schema follow-up: `case_assigned`/`case_status_changed` not in Prisma
  AuditAction enum; mutations fall back to `admin_action` with
  metadata.operation set. Adding the enum values needs a migration + owner approval.

Pushed as scoped commits to `feat/unified-client-workspace-os`. PR #374 remains
open; production merge NOT authorized.
