# GEM Deep Build Blueprint, Connected Systems, and Command-Automation Plan

**Prepared:** 2026-10-15  
**Canonical application repository:** `support371/gem-enterprise`  
**Inspected branch:** `main`  
**Inspected commit:** `9f1da4f0921ff44b9f895dd911075aba972514ad`  
**Canonical production domain:** `https://www.gemcybersecurityassist.com`  
**Canonical Vercel project:** `support371-gem-enterprise` — `prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z`  
**Companion source inventory:** [GEM_COMPLETE_ROUTE_AND_CAPABILITY_INVENTORY.md](./GEM_COMPLETE_ROUTE_AND_CAPABILITY_INVENTORY.md)

> This is a source-grounded build blueprint. A repository route, configuration value, connector page, scheduled job, or external URL is evidence of a code/configuration relationship—not proof that the production service is reachable, authorized, healthy, correctly secured, or fully operational.

## 1. Executive assessment

GEM is not a simple brochure website. The canonical repository contains a Next.js application, client and admin surfaces, onboarding and review flows, service and intelligence content, ATR real-estate surfaces, a community preview, store/request-only commerce, social publishing orchestration, TokMetric, agent/API bridges, evidence controls, scheduled jobs, and operations tooling.

The repository tree at the inspected commit contains **2,149 entries**, **254 page files** and **224 route-handler files** under the source App Router scan. These are file counts, not unique URLs or proof of completeness. Dynamic routes can serve many URL instances; route handlers are API endpoints; aliases, rewrites and redirects can cause multiple paths to resolve to the same page.

The correct build target is therefore not “make every source file live.” It is to reconcile:
1. the business capability that must exist;
2. its canonical route and owner;
3. implementation and persistence;
4. identity/permission requirements;
5. external dependencies and their actual status;
6. automated test evidence;
7. production deployment and release approval.

## 2. Evidence and source hierarchy

Use these sources in this order when preparing automation:

1. **Runtime code on `main`** — `src/app/**/page.*`, `src/app/**/route.*`, layouts, middleware/proxy, domain logic and tests.
2. **Deployment/configuration** — `vercel.json`, `next.config.js`, `.env.example`, `package.json`, Prisma schema/migrations, GitHub workflows.
3. **Current operational docs** — `README.md`, `DEPLOYMENT.md`, `docs/VERCEL_CANONICAL_PROJECT.md`, `docs/AGENT_BUILD_FLOW.md`, `docs/routes.md`, `docs/social-automation/route-inventory.md`, `docs/tokmetric/**`, `docs/controls/**`.
4. **Older navigation maps/audits** — useful for product intent and historical pages, but they must be reconciled with current source. Some older documents claim 59 menu items and contain “missing” routes that may since have been created, renamed, redirected or removed.
5. **External platform/account dashboards** — required to confirm provider authorization, deployed URLs, credentials, DNS, billing and account-level settings. Repository code cannot establish these facts.

## 3. Core business definition: required platform domains

Every domain below belongs in the build register even when no route is currently present.

### 3.1 Public company and acquisition
- Home and canonical brand positioning.
- About/company, mission, leadership/team and contact.
- Clear business and individual customer paths.
- Cybersecurity service catalogue and service detail pages.
- Business security/operations review, demo/consultation and service enquiry.
- Resources, threat-intelligence publications, newsletter consent and FAQs.
- Trust/security information and truthful capability claims.
- Privacy, terms, cookies, compliance notices and accessible contact for privacy issues.
- Analytics, consent, SEO metadata, sitemap, robots/indexing rules and redirects.

### 3.2 Separate customer journeys
**Business:** discovery → service detail → security review/intake → consent → owner handoff → eligibility/identity review if required → proposal → contract/approved service activation → organization/workspace → requests, documents, support, reporting and renewal.

**Individual:** discovery → personal security needs → eligibility/service enquiry → consent → account invitation/login where approved → profile/settings → approved service or resources → support and privacy requests.

Do not force both audiences through identical copy or an investor-oriented funnel. The business journey should prioritize security posture, operational risk, response expectations and service scope. The individual journey should prioritize personal cyber safety, account protection and clear limits.

### 3.3 Cybersecurity operations
- Service detail: threat monitoring, incident response, dark-web exposure, red-team/assessment, asset recovery and compliance support only where these are genuinely offered and evidence-backed.
- Security review intake, evidence collection, scoped assessment, findings, remediation tasks, customer communications and closure.
- Threat-intelligence/news pages with source, timestamp, freshness and provenance.
- Client service requests, tickets, documents, meetings, notifications and audit history.
- Any continuous-monitoring or response-time promise must remain disabled until telemetry, staffing, on-call procedures, coverage and evidence are approved.

### 3.4 Identity, onboarding and access
- Client login, logout/session lifecycle, password recovery/reset and access continuation.
- Invite/provisioning and eligibility gates; no open self-registration unless intentionally approved.
- Individual, business, trust and family-office KYC/KYB journeys only to the extent justified by the actual service and jurisdiction.
- Upload, review, decision, status, correction, consent, retention and deletion.
- Explicit access boundaries for user, organization member, organization admin, support/operator, admin and superadmin.
- Every protected API must independently enforce authentication, resource authorization and tenant isolation; a protected page alone is insufficient.

### 3.5 Client workspace and platform operations
- Dashboard, profile, settings, workspace/org selection, members and entitlements.
- Documents, service requests, tickets, messages, meetings, notifications and activity/audit.
- Admin user management, intake handoff, approvals, KYC review, campaign/content operations, news management, audit, access invitations, workspace provisioning and safe operational controls.
- Admin and superadmin entry must not rely on obscure URL paths as the security control. Require verified role/session enforcement and audit logging.

### 3.6 Community and knowledge
- Public community explanation and access request.
- Authenticated member directory/profile, circles, events, knowledge/playbooks, opportunities, messages and settings.
- Clearly disclose whether the network is a live service or a preview. The current README says `/community` redirects to `/community-hub`, and `/community-hub` is a fictional/non-indexed interface preview rather than a live member network. Do not market mock members, messages, events or deal flow as real.

### 3.7 Alliance Trust Realty (ATR)
- ATR identity and division boundary, landing/about, property listings, buy/sell, property management, education and investment-planning information, enquiries and any approved dashboard.
- Keep ATR real-estate operations distinct from GEM cybersecurity services.
- Property data must be verified and dated.
- Fractional ownership, funds, REITs, investment packages or financial returns require appropriate legal/product approval before promotional copy, account flows, transactions or collection of funds are enabled.
- `/alliance-trust-realty` is an alias that redirects to `/atr` in the inspected code.

### 3.8 Commerce and revenue
- Service catalogue and request-only store surfaces.
- Business review package, proposals and follow-up workflows.
- Google/TikTok storefront destination information, Shopify/Wix-related surfaces where actually supported.
- Payment, subscription, invoicing, refunds, reconciliation, webhooks and entitlements only after business, provider, legal and test gates pass.
- Current README describes store pages as request-only: they do not create orders, subscriptions, payment obligations, inventory commitments or SLAs.
- The ads bridge is explicitly preview-only: the campaign budget is USD 0 and paid status is paused. It does not call an external ads provider or spend funds.

### 3.9 Social/content operations
- Content calendar, content drafts, media assets, channel variants, approval workflow, provider connectors, credential health, publishing queue, retry/idempotency, pause controls, analytics sync and audit.
- Account authorization and production provider publishing are separate milestones.
- Content-generation UI and scheduler presence do not prove provider authorization or successful publishing.
- The current configuration sets provider write/publishing flags false, including TikTok, Meta, X, LinkedIn, YouTube and Nextdoor. Live publishing remains gated.
- Social automation code/docs exist in the canonical repo; docs explicitly state Zoho Catalyst is not the implementation dependency for this control plane.

### 3.10 Developer and integration surface
- OpenAPI documentation, agent API, public storefront API, authorized agent API, API key rotation, scoped operations, webhooks, idempotency and rate limits.
- Integration contracts must define owner, base URL, authentication, scopes, request/response schema, retries, timeout, replay defense, logging, data classification, deletion and incident procedure.
- No secrets in source, URL parameters, client-side bundles, logs, build artifacts or the automation report.

### 3.11 Reliability and governance
- Health/readiness, logs, error reporting, scheduled jobs, backup/restore, incident runbooks, deployment rollback, schema migration safety and public-claim checks.
- Build/test evidence must identify the exact commit and canonical Vercel project.
- Production should not be modified by broad one-shot scripts without a clean Git status, backup/rollback plan, test environment, and explicit release gate.

## 4. Current source inventory: canonical route and file register

The detailed page/API list is in the companion source inventory. This section records special routing behavior and important route families that an automation plan must not miss.

### 4.1 Public marketing and content routes observed in the repository/docs
- `/`, `/about`, `/company`, `/contact`, `/services`
- `/services/threat-monitoring`, `/services/incident-response`, `/services/dark-web`, `/services/red-team`, `/services/asset-recovery`, `/services/federal-compliance`
- `/business-review`, `/enterprise-solutions`, `/get-started`, `/eligibility`
- `/intel`, `/intel/news`, `/resources`, `/resources/business-readiness-checklist`, `/newsletter`
- `/store`, `/store/main`, `/store/campaign-hub`, `/store/tiktok`, `/store/shopify`, `/store/google`, `/store/wix`
- `/whatsapp`, `/assets`, `/hub`, `/trust-center`
- Legal/policy: `/privacy`, `/terms`, `/cookie-policy`, `/compliance-notice`

The source-generated sitemap explicitly lists the above routes plus selected subpaths. That sitemap is a curated SEO list, **not** the complete application route inventory.

### 4.2 Identity, onboarding and decisions
- `/client-login`, `/portal`, `/access/continue`
- `/kyc/start`, `/kyc/individual`, `/kyc/business`, `/kyc/trust`, `/kyc/family-office`, `/kyc/upload`, `/kyc/review`, `/kyc/status`
- `/decision/pending`, `/decision/manual-review`, `/decision/approved`, `/decision/rejected`
- `/eligibility/status`, access and invitation flows, password reset/recovery paths
- `/register` permanently redirects to `/get-started`; it does not enable self-registration.

### 4.3 Application and administration
- `/app/**` includes dashboard, profile/settings, documents, support, requests, messages, meetings, notifications, products/services, portfolios, compliance/security, community and admin.
- Admin-related pages include user management, campaigns, news, KYC, approvals, allocations, audit, intake and workspace/access controls.
- `/command-center` and `/admin-command` redirect to `/app/command-center` in the inspected Next config.
- Check each admin route's actual role enforcement and production reachability. Do not assume a route is secure because its name includes `admin`.

### 4.4 ATR and investment-related routes
- `/atr`, `/atr/about`, `/atr/properties`, `/atr/dashboard`, `/atr/demo/dashboard`
- `/atr/invest`, `/atr/buy`, `/atr/sell`, `/atr/investment-plan`, `/atr/packages`
- `/atr/for-beginners`, `/atr/for-beginners/strategy-framework`, `/atr/enterprise`, `/atr/affiliate`, `/atr/qfs`
- `/alliance-trust-realty` → `/atr`
- These are source inventory items, not authorization to offer investments or financial products.

### 4.5 Community and Digital Hub
- `/community` → `/community-hub` temporary redirect.
- `/community-hub/**` has a preview interface and must not be described as a live network without separate evidence.
- `/hub` is rewritten to `/hub-controlled`; `/company` to `/company-controlled`; `/request-access` to `/request-access-controlled`. Inspect the rewrite targets before editing the visible source paths, because the served implementation may be in a different route folder.

### 4.6 TokMetric, social and ads
- `/tokmetric` and subroutes cover controlled TikTok/content operations and review flows.
- `/app/admin/ads-bridge` and admin/API bridge endpoints expose only preview/validation behavior.
- `/api/social-media/**` covers connector, health, pause, publishing, analytics and orchestration operations; use `docs/social-automation/route-inventory.md` as a starting reference, but reconcile its branch/commit to current `main` before treating it as authoritative.
- Cron configuration includes recovery-readiness monitoring, social orchestration, analytics sync, and hourly publishing job processors for a range of hours. Confirm actual Vercel cron registration and authorization before running or changing schedules.

### 4.7 API surface
The source inventory lists all 224 route-handler files from the inspected commit. Major API families include:
- `/api/auth/**`, `/api/admin/**`, `/api/agent/**`, `/api/assistant/**`
- `/api/kyc/**`, `/api/atr/**`, `/api/digital-hub/community/**`, `/api/portfolios/**`
- `/api/documents/**`, `/api/notifications/**`, `/api/meetings/**`, `/api/support/**`
- `/api/social-media/**`, `/api/tokmetric/**`, `/api/store/**`, `/api/market/** (checkout/webhook routes)`
- `/api/verify/**`, `/api/internal/**`, OpenAPI and status/readiness endpoints.

Do not execute write endpoints during reconnaissance. Use GET/HEAD/read-only smoke checks first and use isolated test credentials and test data for write-path verification.

## 5. Connected systems and external origins found in code/configuration

The following connections were observed in repository configuration or code. “Observed” does not mean a successful live connection has been confirmed.

| System / origin | Evidence in repository | Purpose | Required verification |
|---|---|---|---|
| `https://www.gemcybersecurityassist.com` and apex `https://gemcybersecurityassist.com` | README, Vercel canonical project doc, metadata, sitemap, redirects | Canonical public site; prefer `www` for agent/OpenAPI calls because docs warn apex redirect can strip bearer authorization | DNS, TLS, redirect chain, canonical project attachment, public smoke tests |
| `https://support371-gem-enterprise.vercel.app` | `vercel.json`, `.env.example`, agent bridge/OpenAPI | Stable application/API origin used by GEM agent bridge | Confirm it is attached to canonical project, route is reachable, auth headers survive |
| Vercel project `prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z` | `docs/VERCEL_CANONICAL_PROJECT.md` | Sole authorized production deploy target | Check live project/domain association and deployment SHA; avoid duplicate project deployments |
| Supabase/PostgreSQL | Prisma/schema, `.env.example`, database and social docs | Persistent application data, workspace and provider state | Confirm project URL, migrations, RLS, backups, gateway compatibility, production credentials in secret store |
| TikTok OAuth / TikTok Shop | `docs/tokmetric/**`, `.env.example`, callback paths | Account authorization, content operations, shop/storefront integration | Register exact redirect URI and scopes; obtain platform approvals; verify token encryption; keep publishing disabled until owner approves |
| Google Merchant | `vercel.json`, store/agent schema, readiness docs; `GOOGLE_MERCHANT_ACCOUNT_CONNECTED=false` | Feed/storefront integration candidate; account is not recorded as connected or approved | Verify account ownership, connection state, merchant eligibility and product feed; do not label it approved until evidence exists |
| Meta / Facebook Page / Instagram Professional | social provider configuration and orchestration | Social publishing and analytics | OAuth scopes, business/page ownership, test post/read-only checks, production approval |
| X, LinkedIn Company, YouTube, Nextdoor | social provider configuration and orchestrator | Social content distribution | Per-provider OAuth/scopes, account authorization, limits, sandbox/read-only verification |
| Metricool tracker | `src/app/layout.tsx` loads `/metricool-init.js`, which references `https://tracker.metricool.com` | Source-present web analytics/tracking integration; production delivery is unverified | Verify consent/privacy disclosures, runtime loading, non-protected-page behavior and account owner; source presence alone does not prove production delivery |
| OpenAI-hosted Sites command center | `src/lib/enterpriseInquiryHandoff.ts` hardcodes `https://gem-social-command-center.p6kwdvjbpp.chatgpt.site/api/internal/enterprise-inquiry` | Signed, consent-checked enterprise inquiry handoff to external lead intake | Confirm owner/admin access, API contract, signature validation, replay/idempotency, PII retention, availability, and approved processing agreement |
| OpenAI/Custom GPT or agent client | `openapi/**`, `docs/platform-operations-agent-*.md` | Read-only GEM platform operations and TokMetric action schemas | Check deployed OpenAPI URLs, bearer scopes, no write operations accidentally exposed, and exact canonical server URL |
| SMTP provider | `.env.example`, `docs/RELEASE3_SMTP_ACTIVATION.md` | Intake notifications, password/reset and business communications | Verify sender/domain, SPF/DKIM/DMARC, deliverability, reply-to, suppression, credentials; never reuse historical exposed credentials |
| GitHub Actions / CodeQL / secret scan | `.github/workflows/**` | CI, code scanning, tracked-secret scanning, read-only smoke | Confirm workflows actually run on current SHA; a configured workflow that did not start is not a pass |
| Vercel Cron | `vercel.json` | Recovery readiness, social orchestration, analytics and publishing queue processing | Confirm registered schedules, CRON_SECRET, concurrency/idempotency, pause controls, provider gates, run logs |
| Video rendering worker | `scripts/video-render-worker.ts`, worker API/config docs | Asynchronous video/media generation | Validate worker auth, queue durability, storage, retries, output validation and shutdown |
| Zoho Catalyst | social automation architecture doc explicitly says not used | Not a current social control-plane dependency | Do not build a duplicate integration unless the owner explicitly changes architecture |
| Cloudflare Worker/D1/R2/KV in Crypto Signal Bot | separate repository README | Separate Crypto Signal Bot infrastructure, not GEM runtime | Track in separate project register; no shared database/credentials assumed |

### Important external handoff
The enterprise inquiry code sends eligible, consented submissions to the external command-center endpoint above with HMAC signature and an `OAI-Sites-Authorization` bearer header. This is a real code-level dependency and must be treated as a data-processing boundary. Do not remove it blindly, and do not assume it works until a controlled test returns a validated receipt. Confirm separate contact permission; the source sets `contactPermission: "unknown"` and says contact authorization requires separate review.

## 6. Other repositories discovered in the connected GitHub account

The GitHub account has multiple projects with overlapping names and scopes. They are not all confirmed dependencies of the canonical GEM site. This list is a **candidate related-project register** for deliberate review, not permission to merge or deploy them.

| Repository | Initial classification | Relationship to canonical GEM | Action |
|---|---|---|---|
| `support371/gem-enterprise` | Canonical app | Main source and production deployment | Primary build target |
| `support371/GEM-Cybersecurity-Monitoring-Assist` | Archived historical candidate | Name resembles GEM but README describes gemstone identification rather than cybersecurity; likely name collision or unrelated build | Do not import routes until repository owner confirms purpose |
| `support371/GEM-Cybersecurity-Assist` | AI Studio app candidate | README points to Google AI Studio app | Inspect for reusable features and live domain only if owner confirms it belongs to this platform |
| `support371/Gem-Cybersecurity-Assist-Enterprise-` | Older enterprise website candidate | README describes enterprise website, GitHub Pages/Replit history | Compare routes, assets, redirects, and deployment before migration |
| `support371/gem-assist-enterprise` | Separate Flask portal candidate | Described as a professional security/trust portal | Identify whether active, archived-in-practice, or independent |
| `support371/gem-sentinel-trust` | Lovable trust project candidate | Could relate to trust/security surfaces; README contains placeholder Lovable project ID | Treat as unverified until project ID/domain is confirmed |
| `support371/Gem-Assist` | Separate repository name candidate | A prior name exists, but current fetch did not resolve README through the connector | Recheck repository metadata/tree; do not infer it is canonical |
| `support371/GemAlliance` / `support371/Gem-Alliance` | Alliance/ATR candidate | Names may relate to Alliance or partnership assets | Confirm exact owner/business purpose before importing |
| `support371/crypto-signal-bot` | Separate crypto project | README describes React/Vite + Cloudflare Worker/D1/R2/KV; production contract is paper/certification/testnet-only | Keep separate from GEM; inventory its routes/integration later with the owning agent |
| `support371/remix-of-crypto-signal-bot` | Private derivative candidate | Lovable-style README; not proven to be the project the user calls Crypto Signal Board | Do not treat as canonical crypto project without owner confirmation |
| `support371/Gem-news-feed`, `support371/Gemfeed`, `support371/Gemfeed2`, `support371/Gem-News-automation`, `support371/News-Automate`, `support371/News-automation`, `support371/RSS-feed-automation-` | News/feed automation candidates | Potential source feeds, dashboards or automation builders | Inspect ingestion formats, cron ownership, API contracts, licenses and duplicate jobs before connecting |
| `support371/My_Gem_Cyber_Builder_Agent`, `support371/GEM-Assist_AI_Autonomous_Agent`, `support371/GemAiAgent`, `support371/Agent-Extend`, `support371/foundry-agent-webapp` | Agent/build automation candidates | Potential build/run agents, not proven to be production dependencies | Compare capabilities and security boundaries; avoid multiple agents deploying to production |
| `support371/It-cybersecurity-legal-assist` | Legal-assistance candidate | Could support legal content/workflow; not confirmed connected | Review for approved use and disclaimers; do not expose legal advice as professional counsel |
| `support371/gem-fortress-shield` | Security product candidate | Potentially related to GEM cybersecurity product set | Inspect API/route ownership and deployment before linking |
| `support371/investment-portfolio-platform`, `support371/nexus-financial-platform`, `support371/fintech-microservices-core` | Financial platform candidates | Separate investment/fintech builds; not GEM route inventory unless explicitly integrated | Require legal/business owner approval and an explicit integration contract |
| `support371/Team-members-board-management` | Personnel/team candidate | May relate to personnel board functionality | Compare with canonical `/personnel` and approved Notion publishing registry |
| `support371/my-client-and-admin-portal`, `support371/My-client-portal-` | Client portal candidates | Potential duplicate portal builds | Canonical GEM already has `/app/**`; do not create a second auth/database system without a migration decision |
| `support371/MymainEnterprisewebsite`, `support371/MymainEmterpriseWebsite`, `support371/MymainEnterprisewebsite` | Historical website candidates | Possible prior versions/agent work | Compare commits, domains and unique features before treating as source of truth |

### Cross-project boundary for Crypto Signal Board
The user has explicitly said Crypto Signal Board belongs to another project/agent. For this GEM build:
- Do not copy crypto routes into GEM or treat them as GEM-owned.
- Do not enable real-money trading or imply exchange execution.
- Maintain a separate integration record with repository, deployed URL, owner, API contract, authentication, permitted data, rate limits, failure behavior and security review.
- Only add a GEM-facing link or API integration when the owner supplies the canonical repository/domain and approves the interface.
- The separately discovered `crypto-signal-bot` README lists `https://crypto-signal-bot-indol.vercel.app` and `https://crypto-signal-bot-api.analyzer-d94.workers.dev`, and explicitly says paper/certification/testnet-only with no real exchange orders or fund movement. This is evidence for that repository only; it does **not** prove it is the same project called Crypto Signal Board.

## 7. Routing, domain, and navigation risks to resolve

1. **Sitemap is partial by design.** `src/app/sitemap.xml/route.ts` hardcodes a curated list; it does not enumerate all 254 page files. Compare sitemap entries with approved public/indexable pages, not all app/admin/API routes.
2. **Rewrites alter served implementation.** `/hub`, `/company`, and `/request-access` are rewritten to controlled variants. Trace rewrite targets before changing visible route files.
3. **Redirect aliases create route duplicates.** `/community`, `/register`, `/blog`, `/enterprise-demo`, `/preview`, `/tokmetric/review-demo`, `/command-center`, `/admin-command` and `/alliance-trust-realty` have redirect/alias behavior. Maintain one canonical URL per user task.
4. **Root domains differ.** Canonical site uses `www` and apex. The OpenAPI docs specifically warn that an apex redirect can strip bearer authorization headers; machine calls should use the canonical `www` host unless a tested API subdomain is approved.
5. **Separate Vercel projects exist historically.** Only the documented canonical project is authorized to deploy `support371/gem-enterprise`. A green status from a duplicate project does not certify the production build.
6. **Current route docs disagree.** The old navigation audit contains “missing” items, while newer code may implement or rename them. Regenerate from the current tree and test behavior.
7. **Source presence is not production presence.** A path can fail due to deployment lag, SSO protection, auth redirects, database unavailability, or provider gating.

## 8. Required master register columns

Use CSV or JSON as the machine-readable source of truth, with one row per concrete route and separate rows for external systems and capabilities.

- `record_id`
- `record_type` = PAGE | API | STATIC | REDIRECT | REWRITE | CRON | EXTERNAL_SYSTEM | CAPABILITY | REPOSITORY
- `canonical_path_or_origin`
- `method` (API only)
- `source_file`
- `source_branch`
- `source_commit`
- `business_domain`
- `customer_journey` = BUSINESS | INDIVIDUAL | ADMIN | OPERATOR | PUBLIC | CROSS_PROJECT
- `requirement_status` = REQUIRED | OPTIONAL | DEFERRED | OUT_OF_SCOPE
- `implementation_status` = PRESENT | PARTIAL | MISSING | LEGACY | DUPLICATE
- `behavior_status` = TESTED | UNTESTED | FAILING | BLOCKED
- `data_mode` = LIVE | SEEDED | MOCK | STATIC | UNKNOWN
- `auth_level` and `permission_boundary`
- `provider_or_external_dependency`
- `deployment_status` = PRODUCTION_VERIFIED | PREVIEW_VERIFIED | SOURCE_ONLY | NOT_DEPLOYED | UNKNOWN
- `public_indexing` = INDEX | NOINDEX | PRIVATE | UNKNOWN
- `owner`, `blocker`, `evidence_link`, `acceptance_test`, `rollback_plan`

## 9. Acceptance criteria for calling the inventory complete

The inventory is complete only when:
1. All page and route-handler files are represented from a pinned commit.
2. Redirects, rewrites, sitemap, robots, middleware/proxy rules, static assets, cron jobs and custom domains are included.
3. External origins, callbacks, webhook targets, OAuth redirect URIs, API base URLs, mail senders and connected product/provider accounts are recorded.
4. Every related repository is explicitly categorized as canonical, integration, historical, duplicate, separate project or owner-confirmation-required.
5. Every business requirement maps to an existing route or a clearly described missing capability.
6. Every route has an owner and an acceptance test.
7. Production status is supported by exact URL/status/redirect behavior and deployment commit evidence.
8. No route is marked “complete” based solely on file presence or old documentation.
9. The Crypto Signal Board remains a separate project boundary until its owner provides the integration contract.

## 10. Desktop PowerShell command-automation plan

The target is repeatable automation that produces the same build result from a clean checkout. The first automation pass must **inventory and test**, not immediately mutate production.

### Phase A — Safe workspace and baseline
1. Confirm PowerShell version, Git, Node.js 24, Corepack, pnpm 10.28.0.
2. Clone or use the canonical repo; check current branch, HEAD SHA, and `git status --short`.
3. Never overwrite a dirty workspace. Create a named backup branch or commit local work before switching.
4. Install exactly from lockfile with `pnpm install --frozen-lockfile`.
5. Create a local-only `.env.local` from `.env.example` using test credentials; never print secret values or copy production secrets into scripts.
6. Run read-only checks and baseline tests before changes.

### Phase B — Generate machine-readable inventory
1. Enumerate `src/app/**/page.*` and `src/app/**/route.*`.
2. Parse `next.config.js` redirects and rewrites.
3. Parse `src/proxy.ts` public/protected prefixes, admin/review role gates, static/API/dot-path bypasses, host-dependent ATR rewrite and identity-header forwarding into a separate proxy-routing CSV; these are source rules, not runtime authorization proof.
4. Parse `vercel.json` domains/env keys/crons (do not output secret values).
5. Extract OAuth callbacks, webhook destinations, external API origins and email sender domains from source/docs.
6. Generate JSON + CSV with path, method, file, route family, auth hint, dependencies and unknown status, plus `GEM_PROXY_ROUTING.local.csv`.
7. Compare generated routes with sitemap, navigation config and docs/routes.md; produce drift report.
8. Generate a separate list of all external repositories and origins requiring owner confirmation.

### Phase C — Verification, no production writes
1. Run Prisma/schema checks, claims check, lint, typecheck and Vitest.
2. Build the production bundle.
3. Run route-level tests against local preview using disposable database and fake provider adapters.
4. Test redirects, rewrite targets, public routes, anonymous access, normal user, organization admin, platform admin and superadmin.
5. Test APIs for validation, authentication, authorization, tenant isolation, rate limiting, replay/idempotency, audit and error behavior.
6. Run a read-only production smoke test using approved public URLs; do not invoke write endpoints or cron processors.
7. Save results by commit SHA; no green result without the command output/exit code.

### Phase D — Fix the build in bounded batches
1. P0: deployment identity, secrets, authentication/authorization, data isolation, public false claims, broken redirects, privacy/consent, backup/recovery.
2. P1: business and individual acquisition journeys, working intake/handoff, service catalogue, legal links, responsive behavior, client support and admin handoff.
3. P2: complete route/nav mapping, resource/intel publishing, community disclosure, ATR information architecture, account/settings and customer workspace.
4. P3: provider integrations and social publishing only after account approvals and test evidence.
5. P4: payments, investment/financial features, crypto integration and other regulated capabilities only after explicit legal, product and owner approvals.
6. Each batch uses a separate branch/PR, scoped tests, canonical preview, review and rollback plan.

### Phase E — Release gates
- **Gate 0: Inventory locked** — source SHA pinned, route lists reconciled, related projects classified.
- **Gate 1: Build quality** — `pnpm run verify` passes.
- **Gate 2: Security** — role matrix, API authorization, secret scan, dependency/security checks, upload controls and tenant isolation pass.
- **Gate 3: Business acceptance** — each target journey reaches a real owner and has a tested handoff.
- **Gate 4: Provider readiness** — credentials, account permissions, callback registration, scopes, audit, pause/rollback and test result verified.
- **Gate 5: Release candidate** — canonical Vercel preview is READY for exact commit; smoke tests pass; owner approves.
- **Gate 6: Production** — merge to `main`, verify canonical Vercel deployment and production smoke tests, monitor logs, rollback if acceptance fails.

### Phase F — Production commands must remain explicit and guarded
- Do not run `prisma db push` against production.
- Do not enable payment, KYC automation, social publishing, ads, live monitoring, shop writes or real-money investment/trading from a general automation script.
- Do not run PowerShell as Administrator unless the operation genuinely requires elevated machine privileges. Most Git/Node builds should run as a normal user; elevation increases the impact of mistakes.
- Do not delete legacy Vercel projects or domains until ownership, environment variables, deployment history, domains and dependencies are checked.
- Never run broad `git clean -xfd`, force-push, mass route deletion or automated migration against production without a reviewed backup/rollback plan.
- Use an allowlist of expected domains, repo and project IDs; fail closed on unknown target.

## 11. Initial commands for the desktop baseline

Run from PowerShell in the canonical local repository. These commands inspect state and run validation; they do not deploy or modify production data.

```powershell
$ErrorActionPreference = "Stop"

function Invoke-CheckedNative {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )
    & $Command
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "$Label failed with exit code $code. Stop here."
    }
}

Write-Host "=== Environment ===" -ForegroundColor Cyan
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Invoke-CheckedNative "Git version" { git --version }
Invoke-CheckedNative "Node.js version" { node --version }
Invoke-CheckedNative "Corepack version" { corepack --version }

Write-Host "=== Repository identity ===" -ForegroundColor Cyan
Invoke-CheckedNative "Repository root" { git rev-parse --show-toplevel }
Invoke-CheckedNative "Repository remote" { git remote -v }
Invoke-CheckedNative "Current branch" { git branch --show-current }
Invoke-CheckedNative "Current commit" { git log -1 --format="%H%n%cs%n%s" }
Invoke-CheckedNative "Working-tree status" { git status --short --branch }

Write-Host "=== Package manager ===" -ForegroundColor Cyan
Invoke-CheckedNative "pnpm version" { corepack pnpm --version }

Write-Host "=== Install locked dependencies ===" -ForegroundColor Cyan
Invoke-CheckedNative "Frozen-lockfile install" { corepack pnpm install --frozen-lockfile }

Write-Host "=== Read-only / non-production verification ===" -ForegroundColor Cyan
Invoke-CheckedNative "Schema checks" { corepack pnpm run db:schema:check }
Invoke-CheckedNative "Public-claims check" { corepack pnpm run claims:check }
Invoke-CheckedNative "Lint" { corepack pnpm run lint }
Invoke-CheckedNative "Typecheck" { corepack pnpm run typecheck }
Invoke-CheckedNative "Tests" { corepack pnpm run test }

Write-Host "=== Build after checks pass ===" -ForegroundColor Cyan
Invoke-CheckedNative "Production bundle build" { corepack pnpm run build }

Write-Host "All listed local checks exited successfully. This is not production-release approval." -ForegroundColor Green
```

Run only after confirming the current directory is the canonical `support371/gem-enterprise` checkout and reviewing the working-tree status. If it is dirty, stop and preserve the changes before installing/building. This sequence deliberately avoids `pnpm run verify`: the current package script invokes `db:generate`, which chains schema-promotion scripts. Do not run `db:generate`, `db:schema:promote`, `db:push`, or `db:migrate` until side effects are reviewed and the operation is specifically approved. No deployment or production mutation is part of this sequence.

## 12. Unresolved owner/external inputs

These cannot be safely guessed from source:
- Whether each candidate repository listed above is owned by the GEM platform, a separate agent, a historical experiment or a different product.
- Canonical repository/domain for the project the user calls Crypto Signal Board.
- Current DNS, third-party OAuth approvals, live provider account permissions, email domain authentication and external command-center access.
- Production data provider, database/RLS state and backup/recovery evidence.
- Final legal wording and jurisdictional requirements for ATR investments, KYC/KYB, financial services, advertising, and privacy.
- Whether the social publishing transaction gateway is production-ready; the repository docs explicitly describe a missing/required transactional gateway backend for certain TokMetric operations, and the live publishing gates are false.

## 13. Definition of done for the build blueprint

The build blueprint is ready for command automation when the companion route list and this document are reviewed against the exact current `main` SHA, the related repository register has owner classifications, external integrations have explicit contracts, missing capability routes are prioritized, and the automation generates a reproducible CSV/JSON drift report. Only then should command automation implement the remaining work in bounded, tested batches.
