# Active Work

Snapshot: 2026-09-21 UTC. Refresh live GitHub state before mutation.

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
