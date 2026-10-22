# GEM Enterprise audit and repair — 2026-10-02 UTC

Status: **partial implementation verified locally; integration and release blocked**. No service is declared complete solely from a page loading or an account signing in. No merge, paid subscription, outgoing message, social publication, financial action or production data migration was performed.

## Repository and environment

Canonical repository confirmed: `support371/gem-enterprise`, `/workspace/gem-enterprise`, remote `https://github.com/support371/gem-enterprise.git`. Initial branch `work`, clean tree, SHA `7175341a328b522fdf181bf4f5ee78d6c3376f41`, matching the inspected GitHub main. Repair branch: `codex/enterprise-audit-repair-20261002`. Existing work preserved. AGENTS.md, CLAUDE.md and applicable control-plane/build contracts were read. This repair owns a separate task contract and does not modify existing active social, workspace OS, intake-routing or credential-scan lanes.

Node 24.19.0; Enterprise pnpm 10.28.0; Lead Sites pnpm 11.25.0; Git and npm available. GitHub connector works, while local gh authentication is invalid. Sites source/access/version/D1 inventory APIs work; Vercel deployment metadata works, but its build-log API returns `Tool get_deployment_build_logs not found`. Supabase lists three inactive projects; the Enterprise authentication gateway's project is outside the visible project inventory. No live DB connection or provider authorization has been established. Direct anonymous HTTP probes in this environment returned URLError, so those probes are BLOCKED, not access-control passes.

Local Prisma generation used the repository's normal schema-promotion scripts and a validation-only local database URL, without connecting to a database. Generated Prisma/Next source changes were restored; no Prisma schema workaround is committed.

## Verified architecture and deployment provenance

Enterprise is a Next.js application on Vercel, using Prisma/PostgreSQL or configured Supabase gateways, authoritative user/session-version checks and role/member-scoped APIs. Public application intake and administrative review/assignment are separate from private organization/service delivery. The separate Sites Command Center uses D1/R2 and a signed Ed25519 aggregate bridge to Enterprise. Its bridge remains read-only for ordinary federation; an existing explicit administrative recovery operation is sensitive and was not executed.

The six connected workspaces are **Sites-managed source repositories**, not directories in the Enterprise GitHub repository. Sources were cloned from their actual configured Git endpoints. Saved version provenance and successful deployment status match these exact source heads:

| Service | Source SHA / deployed version | URL | Storage / audience |
|---|---|---|---|
| Market & Operations | `2b324dd2f6e204fe45d4ab72b953faf259a8fbae` / 4 | https://gem-market-operations-workspace.p6kwdvjbpp.chatgpt.site | D1; now custom revision 3, existing one grant preserved |
| Platform Operations & Lead Capture | `3d5ef7572a889767a549cae5a3b43ac249a7bdea` / 6 | https://gem-social-command-center.p6kwdvjbpp.chatgpt.site | D1/R2; custom revision 3 |
| TokMetric | `bef62ccedfc1c1f7973f0c638d2b1a7210539023` / 5 | https://tokmetric.p6kwdvjbpp.chatgpt.site | D1 plus active Base44 reads; custom revision 1 |
| Community Operations | `824b10207a1525e98007ea6717fad635ad6d9bf7` / 11 | https://gem-community-operations.p6kwdvjbpp.chatgpt.site | Native D1 members/conversations; public discovery and protected APIs |
| Password Recovery | `149e40adf8b8ef057843ad581c6d892bbb36ce2c` / 1 | https://gem-secure-recovery.p6kwdvjbpp.chatgpt.site | Public capability-token recovery; no D1 binding |
| Separate Command Center | `6a1987c2419cac9c0930ca0caba5f229982989ad` / 21 | https://admin.gemcybersecurityassist.com | D1/R2; now custom revision 3, existing one grant preserved |

Public Enterprise: https://www.gemcybersecurityassist.com. Client login: https://www.gemcybersecurityassist.com/client-login. Canonical Vercel project: `prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z`, team `team_7lMXW95WSLeyK4yAObe8FptW`.

Vercel metadata shows repeated failed previews, including `dpl_89tRgYKs8cTERpAkMwMhaMQoLqkt` for source `c08232797ca5230a95a080cefff281f79883de89`. A ready production deployment is `dpl_GbB6T6BgLGZt7kcFQ2yWdsHWreMF`, source `99efe69e6308bddddd30279c33acd4fd4c40ba81`, URL https://support371-gem-enterprise-otbb8hlcu-admin-25521151s-projects.vercel.app. That production source predates current main. Ready deployment metadata does not establish latest-source readiness. Hosted failure causes remain UNKNOWN because actual build logs are unavailable.

D1 table inventory was inspected without exporting member conversations, provider secrets or record datasets. Market has work_items/client_accounts/team_members/agent_runs/audit_events. Lead has leads/lead_operations/records/jobs/settings/provider OAuth and connection tables. TokMetric has native draft/approval/compliance/audit/commerce tables but lacks native equivalents for its eight Base44-read entity types. Community has native memberships/profiles/posts/replies/reports/private AI threads/messages/entitlements/audit/records. Command Center has organizations/memberships/clients/leads/projects/tasks/workflow transitions/approvals/evidence/audit/rate windows and commerce tables. Full deployment IDs and source provenance are retained in the local delivery artifacts.

## Confirmed findings and repairs

**Enterprise — IMPLEMENTED / LOCALLY VERIFIED.** Remove Crypto Signal Bot from the Enterprise product registry; Certification Access is absent and protected by an exclusion check. Preserve independent crypto repositories, deployments, accounts, secrets and records. Gate platform metadata and actions using authoritative requireAdmin, no-store responses and timestamped configuration evidence. Configured routes do not claim a live connection. Repository sync now returns a truthful unconfigured response rather than a fictitious queued job. Password reset updates, trigger-driven session revocation and matching audit verification occur within one transaction; failed evidence rolls back the password. Concurrent account suspension/email changes and token replay fail closed. Database outages return an unavailable result without underlying details.

**Market — IMPLEMENTED / LOCALLY VERIFIED; HOSTING PRIVACY CONFIGURED.** Original stored-record APIs and MCP lacked required identity/member gates. Repair REST, MCP and page boundaries using trusted stable identity plus verified email and active server-controlled membership. Only configured WORKSPACE_OWNER_USER_ID grants owner status. Scope non-admin reads/updates to owned records; preserve legacy email-owned records while new writes use stable IDs. Validate writes and origin, disallow browser privilege selection, restrict invitations and keep agent briefs review-only. Record and audit changes use atomic D1 batches with tested rollback. Fixed portfolio percentages and connector availability claims become explicitly unverified. Live hosting policy changed to custom; code deployment is pending. Legacy membership email mappings still require administrative reconciliation before final acceptance.

**Command Center — IMPLEMENTED / LOCALLY VERIFIED; HOSTING PRIVACY CONFIGURED.** Original backend inserted the first signed-in email into platform_owners and granted owner privileges. Remove first-visitor bootstrap. Owner authority requires explicit PLATFORM_OWNER_USER_ID, with both trusted ID and email required for API identity. Preserve all existing database rows. Foreign-origin writes fail closed, exceptions return generic failures, and readiness is timestamped runtime-binding evidence. Existing granular tenant/role/client visibility and signed federation controls remain. Live audience changed to custom; code deployment and owner-ID configuration are pending.

**Recovery — IMPLEMENTED / LOCALLY VERIFIED.** Original route forwarded token/password to the historical Supabase reset-page function. New route targets the canonical Enterprise reset endpoint, rejects redirects, bounds actual request bytes and requires both explicit success and session-revocation evidence. Public intended access and fragment-token handling are preserved. Historical backend token compatibility is UNKNOWN; newly issued canonical links must be used. Real database trigger/audit/session invalidation and email delivery are not verified. Rate limiting remains process-local and requires production review.

**Lead Capture and inquiry workflow — IMPLEMENTED / LOCALLY VERIFIED; NOT CONFIGURED LIVE.** Sign-in alone previously admitted users to shared lead/provider/worker administrative APIs. Require configured LEAD_ADMIN_USER_IDS plus trusted ID/email. Retain native D1 atomic capture, contact/request-key deduplication, optimistic versions and server-defined review transitions. Capture/review audit records retain actor and source; assignment is mandatory before delivery; completion records an outcome.

New Enterprise administrator endpoint `/api/admin/intake/handoff` reads the authoritative stored inquiry and checks kind/status/consent. It requires explicit capture-for-review confirmation, direct mandatory audit storage, a configured private Sites service credential and shared HMAC key. It signs exact bytes to a fixed destination and rejects redirects. The receiver `/api/internal/enterprise-inquiry` permits only fresh signed capture requests, stores once in D1, grants no human identity or admin privilege, returns only a receipt and rejects existing-contact collisions for human reconciliation. Failed sender audit does not initiate a transfer. Retry uses the same persistent inquiry key. This implements an administrator-initiated server handoff; automatic dispatch, a durable handoff outbox/consumer and cross-service delivery-outcome reconciliation remain BLOCKED, not completed. No live transfer was invoked.

Existing Lead jobs persist leases/deduplication/retries/provider mutation uncertainty and approvals. Native mocked-provider tests verify these behaviors, not actual provider scopes. Browser polling and the external runner remain part of unattended processing; no cloud processing schedule is attached. Do not enable social publishing as a workaround.

**TokMetric — VERIFIED PARTIAL MIGRATION / LIVE CUTOVER BLOCKED.** Current Sites source actively calls Base44 for Workspace, Organization, ConnectorInstance, Job, ApprovalRequest, AnalyticsSnapshot, DomainEvent and Content. Its own D1 handles new drafts/approvals/compliance and commerce. The separate support371/tokmetric-platform legacy source also retains Base44 dependencies. Source AGENTS.md explicitly says to keep the Worker/hosting/build handoff scaffold intact. No blind dependency removal or empty replacement dataset is introduced. Authorized complete export, reviewed identity/workspace mapping, additive D1 migration, record reconciliation and rollback are required. A concrete migration contract is provided in local artifacts. Actual Base44 read authorization/data exposure and completeness of preserved records remain UNKNOWN.

**Community — NATIVE MEMBER BACKEND VERIFIED; AI CONNECTION UNVERIFIED.** Current native D1 member APIs already enforce identity, active membership, ownership, admin boundaries and atomic audits. Tests verify private AI histories are inaccessible even to administrators, author impersonation/role promotion are blocked and suspension cannot be reversed by re-enrollment. The active AI route still invokes configured external GEM_AI_ENDPOINT; legacy toolbox Supabase code remains in source. External AI authorization and data reconciliation are unverified. Remove the excluded crypto listing from the Enterprise-facing brochure and replace fixed readiness/activation labels and stale aggregate valuation claims with pending/unverified states and timestamped configuration review. Public discovery remains accessible by policy; private conversations were not exported or sent.

## Validation

| Check | Result |
|---|---|
| Enterprise focused six suites | 40 passed |
| Enterprise full suite, final repair sources | 936 passed, 6 failed; 942 tests / 146 files |
| Same six tests on untouched base commit | Same 6 failures, 37 passes across the affected suites |
| Enterprise scoped repair lint | Passed; full lint has one existing closeReview hook warning in OrganizationWorkspaceOperatingSystem.tsx |
| Enterprise typecheck before generated route types | Passed before integration; final integration types introduce no additional errors after enum correction |
| Enterprise generated route type/build checks | BLOCKED: 5 errors reproduced on untouched base via Webpack: recoveryWatchTestables invalid route export; Facebook analytics/approvals/content/operations synchronous searchParams |
| Enterprise canonical Turbopack build | BLOCKED: local PostCSS/Turbopack port/process operation restriction, including retry after environment permission change |
| Market | Build, typecheck, scoped lint, 5 policy and 5 real SQLite route checks passed |
| Lead | Build/typecheck passed; 19 native D1/mocked-provider/workflow/signature checks passed; 1 browser-render check skipped |
| Command Center | Build/artifact validation; 59 existing security + 3 identity checks passed |
| Recovery | Build/typecheck; 4 mocked-upstream/rendered checks passed |
| Community | Build; 11 native member/rendered checks passed |
| TokMetric unchanged source | Build and both Sites/commerce test files passed; bundle-size warning remains |
| Live signed handoff/provider delivery/password-reset exercise | NOT RUN; configuration/access blocked; no outbound action performed |

The six pre-existing test failures are digital-hub-fullstack, public-truth-routing, scoped-service-requests, social-autopilot, social-provider-oauth-foundation and social-publishing-governance. Their owners/build lanes must resolve the baseline before a release. None were silenced, skipped or rewritten to manufacture a clean full gate.

## Repair branches, files and deployment status

All five modified Sites use isolated `codex/enterprise-audit-repair-20261002` branches. Their final repair commits, including the signed Lead follow-up, were pushed successfully. No source main was merged or updated. Sites source-version saving requires the configured source branch HEAD, so an isolated repair SHA is not falsely saved/deployed as main. Runtime access-policy revisions are the only live changes.

| Sites source directory | Final local repair SHA |
|---|---|
| gem-market-operations-workspace | `299861343e66bd8091b992717695190475ec79f5` |
| gem-social-command-center | `3ca550be8656c362704c5ba4f5b8025884371c89` |
| gem-enterprise-command-center | `d250b4a22158cd80c8ac0b4d22d15bb198aa2547` |
| gem-secure-recovery | `af7b67253ce4833af493012947566ddd2ece372d` |
| gem-community-operations | `c76f7899e93285d9e59742f31a0e6a6ad91dc13c` |

Changed Enterprise files: product registry and exclusion test; platform evidence plus environment/deployment-plan/repository/sync routes; password reset transaction and tests; enterpriseInquiryHandoff helper and admin intake handoff route/test; control-plane task and audit records. Changed Sites files and commit manifests are in `enterprise-audit-artifacts/site-repair-commits.json`, with service-specific ENTERPRISE-REPAIR.md in each repository. Enterprise implementation commit: `7842ca97995ea12ed93e88e7ac2fccde9f6a27d8`. Draft review: https://github.com/support371/gem-enterprise/pull/391. The final documentation head and all changed paths are retained in the delivery/source manifest.

## Remaining blockers and safe next work

1. Review and coordinate existing source/build lanes for the reproduced six tests and five generated-type errors. Do not merge without owner authorization. Vercel hosted build logs are still required to confirm the actual remote preview causes.
2. Establish production DB/gateway ownership, backups and execution access. Verify reset trigger/audit/session-version invariants with controlled accounts; verify real recovery link delivery. Do not infer this from signed-in access.
3. Verify site-specific trusted owner/admin IDs and reconcile intended member grants before setting WORKSPACE_OWNER_USER_ID, PLATFORM_OWNER_USER_ID and LEAD_ADMIN_USER_IDS. Account allowlist IDs are not assumed equivalent to runtime identities.
4. Configure Enterprise GEM_ENTERPRISE_INQUIRY_HMAC_KEY and GEM_LEAD_SITES_SERVICE_TOKEN and matching Lead ENTERPRISE_INQUIRY_HMAC_KEY only in server secret stores after reviewed code release. Verify scope, replay/tamper/duplicate behavior and mandatory sender/receiver audits with controlled inquiries. Do not forward applicant records before that review/configuration.
5. Obtain TokMetric authorized exports and identity mapping; stage and validate a record-preserving native migration. Community external AI/provider scopes and preserved data still require evidence. Keep all independent crypto assets untouched.
6. Implement and verify an approved unattended runner/outbox/reconciliation contract using existing free services. Current persistent job tables and browser polling are not proof of durable unattended processing. Do not schedule prohibited social, message or financial actions.

## Rollback

No production schema migration was executed. Revert the relevant repair branch commits and rebuild the prior source, retaining records and server secrets. For deployed Sites, restore their recorded previous saved versions only after review; keep Market/Command Center private so rollback does not reopen anonymous record access. Preserve existing owner/membership rows; never restore first-visitor bootstrap to regain access. Remove or disable new handoff configuration before reverting its endpoints, retain native leads/audits, and reconcile acknowledged receipts rather than deleting records or replaying contact/provider actions. For Vercel, its Git integration owns production release; recorded ready production deployment is a rollback candidate, not authorization to promote it. Future TokMetric migration must preserve exports/import manifests and new native writes for reconciliation before any cutover.
