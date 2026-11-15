# Active Work

## Public new-client entry and SaaS activation journey — 2026-11-15
Owner: ChatGPT Work. Issue #510; task [CLIENT-ENTRY-510](tasks/CLIENT-ENTRY-510.md).
Branch: `fix/new-client-intake-entry-510`, base `de79e803a917ae75c755b93092951e22b36d3047`.
Scope: route enterprise applicants to their dedicated intake; repair the legacy Community access form's retired endpoint; remove unverified Community response promises; show existing invite-based account activation stages on the SaaS dashboard. No schema, credentials, provider publishing, paid work or unrelated projects. Status: IMPLEMENTED ON BRANCH; exact-head hosted verification, independent review and production acceptance pending.


## Core Prisma fail-closed readiness — 2026-11-15
Owner: ChatGPT Work. Issue #508; branch `fix/core-prisma-readiness-508`, task [CORE-PRISMA-READINESS](tasks/CORE-PRISMA-READINESS.md).
Scope: reuse the existing signed-in, membership-scoped Workspace Gateway for gateway sessions; validate and whitelist response fields, preserve local Prisma when configured, and fail closed for unavailable core Command Center aggregates. No secrets, migrations, publishing or production changes. Status: PR #509 DRAFT; hosted exact-head gates rechecking after final sanitization.

## Owner gateway diagnostics — 2026-11-15
Owner: ChatGPT Work. Issue #506; task: [SOCIAL-GATEWAY-OWNER-DIAGNOSTICS](tasks/SOCIAL-GATEWAY-OWNER-DIAGNOSTICS.md).
Branch: `fix/social-gateway-owner-diagnostics`, base `e279a96d892e37ea9835f16b2e8cf1e5a1651454`.
Scope: fixed owner-only health transport and existing Command Center control; no activation, credentials, database writes or publishing gate changes. Status: IMPLEMENTED; independent review clear; schema/claims/lint/typecheck/1,574 tests/227 files/build passed. Hosted gates and live diagnostic smoke pending.

## TikTok account status clarity — 2026-11-15
Owner: ChatGPT Work. Issue #504; task: [TIKTOK-ACCOUNT-STATUS-CLARITY](tasks/TIKTOK-ACCOUNT-STATUS-CLARITY.md).
Branch: `fix/tiktok-account-status-clarity`, base `62c942ab81f0c1c70d933eb7938b799ed504bdb7`.
Scope: remove static account-state contradiction from existing accounts view; no backend/credential/publishing changes. Status: MERGED (#505) as e279a96d892e37ea9835f16b2e8cf1e5a1651454; local/hosted gates passed, canonical production READY and health database ok; live UI cleanup verified. TikTok live identity check repeated successfully at16:55 UTC. Owner-private Operations Site refreshed and published with dated evidence; secret installation remains required.

## TikTok connection verification — 2026-11-15
Owner: ChatGPT Work. Issue #502; task: [TIKTOK-CONNECTION-VERIFICATION](tasks/TIKTOK-CONNECTION-VERIFICATION.md).
Branch: `fix/tiktok-connection-verification`, base `8598474dd3cd0fd41fdbb0a27721891bedd2ae9c`.
Scope: existing connector health authority, bounded read-only TikTok identity check, safe audit and mobile verification control. No credentials, refresh/revoke, scopes, schema or publishing activation. Status: MERGED (#503) at 62c942ab81f0c1c70d933eb7938b799ed504bdb7; 1,536 tests/224 files and all hosted gates passed; production READY. Existing TikTok Content Posting account passed actual live identity verification at 2026-11-15 16:40:36 UTC. Both Facebook Pages, Instagram and X also passed fresh existing live checks. Posting remains disabled; gateway secret and Meta/X publishing permissions still required.

## Social gateway configuration failures — 2026-11-15
Owner: ChatGPT Work. Issue #500; task: [SOCIAL-GATEWAY-CONFIGURATION](tasks/SOCIAL-GATEWAY-CONFIGURATION.md).
Branch: `fix/social-gateway-configuration`, base `7c6ef0e5defac773ca86e00d256ab62caada866b`.
Scope: fail-closed gateway startup/request errors, redacted logging and direct handler tests. No credentials, schema, deployments or publishing activation. Separate from PR #497 and merged PR #499. Status: MERGED (#501) at 8598474dd3cd0fd41fdbb0a27721891bedd2ae9c after independent review and exact-head hosted gates; 1,501 tests passed. Original-project edge source deployed and reloaded-source matched; live POST now returns controlled 503 setup-required, GET405/OPTIONS200. Matching secret and authenticated health remain outstanding; no publishing activation.

## Social workspace navigation — 2026-11-15
Owner: ChatGPT Work. Issue #498; task: [SOCIAL-WORKSPACE-NAVIGATION](tasks/SOCIAL-WORKSPACE-NAVIGATION.md).
Branch: `fix/social-workspace-navigation`, base `7c6ef0e5defac773ca86e00d256ab62caada866b`.
Scope: preserve explicit social workspace links and expose existing authorized workspace choices. Prior overlapping PRs #492/#494 are merged. No auth, database, credentials, provider grants or publishing changes. Status: MERGED as 650a5c784df5b10e93be19ccc91a1ee6a40adbfd (#499); local and hosted gates passed, independent review complete; Git-owned production dpl_2jk7v1gT83TfMCBGAtujCP9K6LzT READY; authenticated production chooser, workspace-scoped Facebook navigation and Settings return-link checks passed.

Snapshot: 2026-09-25 UTC. Refresh live GitHub state before mutation.

## Unified Client Workspace OS

| Field | Value |
|---|---|
| TASK | [UNIFIED-WORKSPACE-OS](tasks/UNIFIED-WORKSPACE-OS.md) |
| OWNER | Muse / unified workspace lane |
| SOURCE PR/ISSUE | Owner mandate 2026-09-29; PR #374 |
| BASE SHA | `068a7d093189958d5be06b579b5fa8f40d7bc99d` |
| WORKING BRANCH | `feat/unified-client-workspace-os` |
| OWNED FILES/SCOPE | Capability readiness model + badge; command-center demo-claim remediation; client workspace OS page/components/readiness; admin client-operations control center; service-request lifecycle + admin APIs; additive Prisma models (readiness overrides, lifecycle funnel) + migration; focused tests; this control-plane record |
| FORBIDDEN OVERLAP | Ads bridge, social autopilot, TikTok shop, news scroll, PR #291/#292/#252 files; provider credentials; production data; auth/session core outside owned files; main-branch merge (no merge authorization) |
| STATUS | IMPLEMENTED — 120/120 focused tests pass; tsc/eslint clean on workstream files (Prisma client not generatable in sandbox); pushed as scoped commits; PR #374 open, NOT merged |
| BLOCKER CLASS | CONFIGURATION (Prisma generate needs engine download; preview deploy verifies remainder) |
| NEXT SAFE ACTION | Verify Vercel branch preview; role-specific live testing delegated to browser-capable agent; owner merge decision on PR #374. |


## GEM Ads Bridge

| Field | Value |
|---|---|
| TASK | [ADS-BRIDGE](tasks/ADS-BRIDGE.md) |
| OWNER | Codex / advertising bridge lane |
| SOURCE PR/ISSUE | Issue #366 |
| BASE SHA | `b147dc01b51ce889a082641d12a2d6abce5ff45c` |
| WORKING BRANCH | `codex/zero-spend-ads-bridge` |
| OWNED FILES/SCOPE | Isolated Ads Bridge policy, admin API/UI, creative asset, focused tests, docs, one admin-campaign discoverability link, and this control-plane record |
| FORBIDDEN OVERLAP | Social Autopilot/TokMetric internals; Prisma; provider credentials; billing; production activation |
| STATUS | IMPLEMENTED — FOCUSED GATES PASS; REPOSITORY BASELINE BLOCKED |
| BLOCKER CLASS | CONFIGURATION / SOURCE (full verify); PROVIDER (paid delivery only) |
| LAST VERIFIED HEAD | `9cc11a3df2c0fca5ddc5faba8286f9d10efdad8d` |
| NEXT SAFE ACTION | Review the focused PR, validate the canonical preview, and keep paid delivery fail closed. |

## Canonical Lineage Restore

| Field | Value |
|---|---|
| TASK | [CANONICAL-LINEAGE-RESTORE](tasks/CANONICAL-LINEAGE-RESTORE.md) |
| OWNER | Claude Code / lineage-restore lane |
| SOURCE PR/ISSUE | Owner decision 2026-10-19; `GEM_MIGRATION_INTEGRITY_20261017.md` §5 step 3 |
| BASE SHA | `dccc65810036db830de5c356dce2a8d6f83004f1` |
| WORKING BRANCH | `restore/canonical-lineage` |
| OWNED FILES/SCOPE | Revert delta of `a72f063` on current `main`, conflict resolutions, this record |
| FORBIDDEN OVERLAP | Production database writes; provider credentials; env vars; new features |
| STATUS | IMPLEMENTED — AWAITING EXACT-HEAD CI AND PRODUCTION MIGRATION |
| BLOCKER CLASS | HUMAN_REQUIRED (apply 4 migrations in production before merge) |
| LAST VERIFIED HEAD | Refresh after publication |
| NEXT SAFE ACTION | Verify exact-head CI and Vercel preview; owner applies the four migrations; then merge. |

## Social Autopilot

| Field | Value |
|---|---|
| TASK | [SOCIAL-AUTOPILOT](tasks/SOCIAL-AUTOPILOT.md) |
| OWNER | Codex / social media automation lane |
| SOURCE PR/ISSUE | Owner request dated 2026-09-21 |
| BASE SHA | `338fede0d0e419c31099b72c6753514eb33b3c7a` |
| WORKING BRANCH | `codex/social-autopilot` |
| OWNED FILES/SCOPE | Social autopilot policy/scheduler/service, orchestration approval mode, queue evidence validation, safe cron aliases, Autopilot UI, focused tests, and this control-plane record |
| FORBIDDEN OVERLAP | Telegram credential remediation PR #292; TikTok/TokMetric provider controls; fake engagement/browser automation; provider credentials; unrelated application domains |
| STATUS | IMPLEMENTED — EXACT-HEAD CANONICAL VERCEL BUILD PASSED |
| BLOCKER CLASS | PROVIDER ACCESS / PRODUCTION ACTIVATION |
| LAST VERIFIED HEAD | Exact branch head to be refreshed after this control-plane commit |
| NEXT SAFE ACTION | Open focused PR, verify exact-head canonical deployment and runner evidence, then await separate merge authorization. |

## Social Publishing Queue Console

| Field | Value |
|---|---|
| TASK | [SOCIAL-PUBLISHING-QUEUE-CONSOLE](tasks/SOCIAL-PUBLISHING-QUEUE-CONSOLE.md) |
| OWNER | Codex / social media operations lane |
| SOURCE PR/ISSUE | Owner request dated 2026-09-21 |
| BASE SHA | `d80cd79d71899e33b2bd674e17d671c226528844` |
| WORKING BRANCH | `codex/social-presence-completion` |
| OWNED FILES/SCOPE | Client Social Media calendar, read-only shared publishing queue console, focused suite tests, and this control-plane record |
| FORBIDDEN OVERLAP | Provider credentials; Telegram credential remediation in PR #292; TokMetric/TikTok publishing; Security Posture campaign PR #342; Prisma; production activation |
| STATUS | MERGED — PR #355 |
| BLOCKER CLASS | NONE |
| LAST VERIFIED HEAD | `338fede0d0e419c31099b72c6753514eb33b3c7a` on `main` |
| NEXT SAFE ACTION | Superseded by the Social Autopilot lane for autonomous scheduling and policy-gated queue replenishment. |

## TikTok Shop Seller Sync

| Field | Value |
|---|---|
| TASK | [TIKTOK-SHOP-SELLER-SYNC](tasks/TIKTOK-SHOP-SELLER-SYNC.md) |
| OWNER | Codex / TikTok Shop integration lane |
| SOURCE PR/ISSUE | Owner request dated 2026-09-08 |
| BASE SHA | `5e11055caaeff064aa3e2998899c7b1b7ae2b7de` |
| WORKING BRANCH | `codex/tiktok-shop-seller-sync` |
| OWNED FILES/SCOPE | TikTok Shop OAuth/config/client routes, seller-shop/product read sync UI, focused tests, environment template, and activation docs |
| FORBIDDEN OVERLAP | Existing organic TikTok publishing behavior; unrelated auth; Prisma; production credentials; other active-work files |
| STATUS | IMPLEMENTED — LOCAL GATES PASSED |
| BLOCKER CLASS | PROVIDER ACCESS |
| LAST VERIFIED HEAD | `718f143` (implementation content verified before publication) |
| NEXT SAFE ACTION | Publish the reviewable branch without merging, then configure the Partner Center values and complete owner authorization after TikTok approval. |

## GEM News Scroll Autoplay

| Field | Value |
|---|---|
| TASK | [NEWS-SCROLL-AUTOPLAY](tasks/NEWS-SCROLL-AUTOPLAY.md) |
| OWNER | Codex / GEM News experience lane |
| SOURCE PR/ISSUE | User-directed owner pre-production finishing |
| BASE SHA | `f084e96457ffa8480be9fadfbb0698bf489da5cd` |
| WORKING BRANCH | `codex/news-scroll-autoplay` |
| OWNED FILES/SCOPE | News feed/player coordination, playback URL controls, due-aware gateway ingestion, cadence SQL, focused tests, this task record |
| FORBIDDEN OVERLAP | PR #291/#292/#252 files; auth; Prisma; credentials; PR #334 catalogue files; IWW repository |
| STATUS | IMPLEMENTED — LOCAL GATES PASSED |
| BLOCKER CLASS | PROVIDER ACCESS (Supabase activation only) |
| LAST VERIFIED HEAD | `f084e96457ffa8480be9fadfbb0698bf489da5cd` |
| NEXT SAFE ACTION | Publish the exact frontend/gateway head and validate its canonical Vercel preview; keep Supabase activation blocked until project permission is available. |

## PR #291

| Field | Value |
|---|---|
| TASK | [PR-291-ledger](tasks/PR-291-ledger.md) |
| OWNER | ChatGPT Work / integration lane |
| SOURCE PR/ISSUE | PR #291 |
| BASE SHA | `1128771e2b8dfc767fb50a7394dee4b5de5a8544` |
| WORKING BRANCH | `codex/create-persistent-completion-ledger` |
| OWNED FILES/SCOPE | Four `artifacts/GEM-*` ledger files |
| FORBIDDEN OVERLAP | PR #292 files; application, Prisma, provider, deployment files |
| STATUS | PARTIAL |
| BLOCKER CLASS | SOURCE |
| LAST VERIFIED HEAD | `9e77433495c9aaec690cac904d6f1d033dafde37` |
| NEXT SAFE ACTION | Apply the four-file evidence correction on the existing branch, validate, publish, then bind checks to the resulting head. |

## PR #292

| Field | Value |
|---|---|
| TASK | [PR-292-security](tasks/PR-292-security.md) |
| OWNER | Codex / security implementation lane |
| SOURCE PR/ISSUE | PR #292 |
| BASE SHA | `1128771e2b8dfc767fb50a7394dee4b5de5a8544` |
| WORKING BRANCH | `security/telegram-credential-remediation` |
| OWNED FILES/SCOPE | `.github/workflows/secret-scan.yml`, `scripts/security/scan_tracked_secrets.py`, `docs/security/telegram-credential-remediation.md` |
| FORBIDDEN OVERLAP | PR #291 artifacts; control-plane docs; provider credential operations |
| STATUS | PARTIAL |
| BLOCKER CLASS | SECURITY |
| LAST VERIFIED HEAD | `6229339b36ec3c574b464b55ae77454cf04a36a7` |
| NEXT SAFE ACTION | Diagnose exact-head scanner failure, preserve containment scope, and prove deterministic redacted regression coverage. |

## PR #252

| Field | Value |
|---|---|
| TASK | [PR-252-intake-routing](tasks/PR-252-intake-routing.md) |
| OWNER | Jules / next independent implementation lane |
| SOURCE PR/ISSUE | PR #252 / issue #251 |
| BASE SHA | `1128771e2b8dfc767fb50a7394dee4b5de5a8544` |
| WORKING BRANCH | New focused branch from current `main`; old branch is `fix/251-applicant-routing-readiness` |
| OWNED FILES/SCOPE | Eligibility/intake routing files selected after current-main gap analysis |
| FORBIDDEN OVERLAP | PR #291, PR #292, control-plane files, unrelated auth/onboarding refactors |
| STATUS | BLOCKED |
| BLOCKER CLASS | SOURCE |
| LAST VERIFIED HEAD | Old PR head `3699dd5135acee4b5b1dc2c5c39674a195a5c666`; 41 commits behind current `main` |
| NEXT SAFE ACTION | Compare old intent with current main and reimplement only behavior still missing; do not rebase blindly. |

## Enterprise repository and connected-workspace audit

| Field | Value |
|---|---|
| TASK | [ENTERPRISE-AUDIT-REPAIR](tasks/ENTERPRISE-AUDIT-REPAIR.md) |
| OWNER | Codex / Enterprise audit repair |
| SOURCE | Owner repository audit and repair mandate, 2026-10-02 |
| BASE SHA | `7175341a328b522fdf181bf4f5ee78d6c3376f41` |
| WORKING BRANCH | `codex/enterprise-audit-repair-20261002` |
| OWNED FILES | Product registry; platform configuration routes/evidence; password-reset transaction; focused tests; audit documentation |
| FORBIDDEN OVERLAP | Active social/provider, workspace OS, intake-routing, credential scan, database migration execution; merge |
| STATUS | Local repairs validated; live Market and Command Center hosting made private; application code deployment pending |
| BLOCKERS | Production identity/provider/database evidence; six reproduced base test failures; build errors in existing routes |
| NEXT SAFE ACTION | Review isolated repair commits and coordinate existing build lanes before merge; verify configured stable Sites owner IDs |

## Member Workspace Showcase — 2026-10-11 reconciliation

| Field | Value |
|---|---|
| TASK | [MEMBER-WORKSPACE-SHOWCASE](tasks/MEMBER-WORKSPACE-SHOWCASE.md) |
| SOURCE | Historical PR #390 and issue #389 |
| PREVIOUS BASE | `7175341a328b522fdf181bf4f5ee78d6c3376f41` |
| RECONCILIATION BASE | `0161fdfd05b2754ac677875345a5aba6c979d639` |
| OWNED SCOPE | Public Community, client Community, Community Hub layout, shared standalone workspace links, focused tests and task docs |
| EXCLUDED | Auth/session changes, sensitive member records, fabricated activity, provider connections, migrations, billing |
| STATUS | Isolated source reconciliation; GitHub CI and preview validation required |
| RELEASE CONTROL | Separate ChatGPT sign-in and membership entitlement required; do not present preview members as real |
| NEXT STEP | Validate on hosted CI and preview; check workspace destination before production merge |

## Social connector runtime repair — 2026-11-13

Owner: ChatGPT Work. Task: [SOCIAL-CONNECTOR-RUNTIME](tasks/SOCIAL-CONNECTOR-RUNTIME.md).
Branch: `fix/social-connector-runtime-20261113`. Scope: connector authority error diagnostics and focused tests.
Status: IN_PROGRESS. No overlapping active lane identified; production publishing remains off.

## Meta destination verification — 2026-11-14
Owner: ChatGPT Work. Task: [META-DESTINATION-VERIFICATION](tasks/META-DESTINATION-VERIFICATION.md).
Branch: `fix/meta-account-probes`, base `8b387137f802142d4ca6fd1f3615c9b2cf14c8b6`.
Scope: exact Meta destination probes, existing health/test routes and connector evidence display; focused tests. No credentials, schema, publishing, or other projects. Status: IN_PROGRESS.

## Shared social connections — 2026-11-14
Owner: ChatGPT Work. Task: [SHARED-SOCIAL-CONNECTIONS](tasks/SHARED-SOCIAL-CONNECTIONS.md). Branch: `fix/shared-social-database`. Scope: existing OAuth/account persistence and readiness. No publishing, provider approval claims, schema or other projects. Status: IN_PROGRESS; no overlapping owner identified.
