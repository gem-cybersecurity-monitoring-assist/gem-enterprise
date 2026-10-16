# GEM route and capability inventory

**Scope:** GEM Enterprise repository `support371/gem-enterprise`, production branch `main`, source tree commit `9f1da4f0921ff44b9f895dd911075aba972514ad` (inventory generated 2026-10-15). This is a source-tree inventory, not a claim that each route is operational or publicly reachable.

## How to read this inventory

- **Code route** means a Next.js page or route-handler file exists in this branch.
- **Production-live** is *not inferred* from source existence; it requires deployment/domain smoke verification.
- **Implemented** is not the same as functionally complete, provider-connected, legally approved, or released.
- Dynamic route parameters are shown as `:parameter`; catch-all routes are shown as `*`.
- Crypto Signal Board is a separate project owned by another agent. It is excluded from GEM-owned route counts; add a cross-project reference only after the owner/repository is supplied.

## Source inventory counts

- Total repository tree entries: **2149**
- App Router page files: **254**
- API/route-handler files: **224**
- Page routes and API handlers are listed separately below.

## Core product definition — required whether built or not

The following is the requirements baseline derived from GEM's stated purpose and repository documentation. These are capability requirements, not claims that routes currently exist.

| Domain | Required surface / journey | Minimum completion evidence |
|---|---|---|
| Public brand & market entry | Home, about, company, leadership/team, contact, service catalogue, resources, trust signals, clear calls to action | Public smoke test; accurate claims; accessible responsive layout; working enquiry delivery |
| Business customer journey | Business security needs, business review/assessment request, consultation/demo, proposal, scoped service request, account/workspace onboarding | End-to-end enquiry-to-owner handoff tested; no false service promises |
| Individual customer journey | Personal cyber safety/services, eligibility, enquiry/onboarding, account/profile/settings, support | Distinct messaging and consent; successful account journey; access controls |
| Cybersecurity services | Service details, assessments, monitoring/incident response descriptions, security resources, client security workspace, case/ticket/incident views as approved | Capability evidence; live monitoring claims gated until staffing/tooling verified |
| Threat intelligence | Intelligence landing, news, reports/briefs, categories, saved items/preferences, source and freshness metadata | Source provenance and freshness visible; no fabricated real-time claims |
| Client portal/workspaces | Login, access recovery, dashboard, organization/workspace, profile, documents, requests, meetings, notifications, support, activity/audit as applicable | AuthZ tests by role and tenant; no cross-tenant leakage |
| Identity, eligibility & KYC/KYB | Individual, business, trust/family-office flows where legally justified, upload/review/status/decision, consent, retention/deletion | Privacy/legal review; safe upload/storage; manual review; no automatic approval unless gated |
| Governance, risk & compliance | Privacy, terms, cookies, disclosures, compliance notice, trust/security center, evidence/retention controls, audit trails, complaints/support | Jurisdiction-specific legal review; policies match actual behavior; evidence-backed certifications only |
| Admin and operations | Superadmin/admin entry, user/role/access, customer success, intake, approvals, KYC, campaigns, communications, audit, system/readiness views | Strong MFA/session protections where supported; least privilege; immutable audit evidence; no public exposure |
| Social marketing & content | Account/connector management, content studio, campaign calendar, approvals, queue, analytics, provider readiness, publishing pause/rollback | OAuth scope and tokens protected; dry-run/readiness; approved test; no publishing claims until provider write is proven |
| Revenue & commerce | Service catalogue, request/proposal, pricing/packages where approved, checkout/webhooks/subscription only after business/legal/provider gate | Idempotent payments/webhooks, reconciliation, refunds/terms, accounting evidence; request-only until activated |
| Community | Public overview/access request; authenticated member profile, directory, circles, events, knowledge, opportunities, messages/settings | Clearly distinguish prototype from live network; moderation, privacy and operational ownership proven |
| Alliance Trust Realty (ATR) | Separate division identity, property listings, buy/sell/property management, investment education/plans, enquiries, dashboard, affiliate and resources as approved | ATR ownership/brand boundaries; property data verified; financial promotions and investment functions legally approved before activation |
| Developer/platform integrations | API docs, authentication, API keys, webhooks, SDKs, rate limits, status/readiness, connector administration | Contract tests, scoped credentials, replay protection, rate limits, versioning and incident procedure |
| Video/media production | Content requests, uploads, previews, render jobs, status/finalization, worker controls | Upload validation, job ownership, worker auth, retention and provider readiness tested |
| Support & communications | Tickets, escalation, messages, unsubscribe/preferences, WhatsApp/contact channel where approved | Delivery tests, consent and suppression, clear response expectations |
| Platform reliability | Health/readiness, monitoring, CI checks, deployment/sitemap/robots, backups, recovery, incident/runbook docs | Production-safe probes, alerting, recovery rehearsal, deployment rollback |
| Cross-project boundaries | GEM-owned routes only here; external projects such as Crypto Signal Board tracked in a separate register with owner/repository and integration contract | Explicit ownership, API/data/security boundaries, approved handoff; never merge inventories by assumption |

## Route status fields to maintain

For each route, record: **path; route kind (page/API/static); domain; source file; branch/commit; requirement (required/optional/deferred); implementation (present/partial/missing); behavior (tested/untested); data source (live/mock/manual); auth level; provider dependency; release status (production/preview/not deployed); owner; blocker; acceptance test.**

## A. Next.js page routes in `main`


### Public marketing & company (60)

- `/` — `src/app/page.tsx`
- `/about` — `src/app/about/page.tsx`
- `/access/continue` — `src/app/access/continue/page.tsx`
- `/admin-access/authorize` — `src/app/admin-access/authorize/page.tsx`
- `/admin-access` — `src/app/admin-access/page.tsx`
- `/admin-login` — `src/app/admin-login/page.tsx`
- `/admin` — `src/app/admin/page.tsx`
- `/alliance-trust-realty` — `src/app/alliance-trust-realty/page.tsx`
- `/api-explorer` — `src/app/api-explorer/page.tsx`
- `/architecture` — `src/app/architecture/page.tsx`
- `/assets` — `src/app/assets/page.tsx`
- `/atr` — `src/app/atr/page.tsx`
- `/business-review` — `src/app/business-review/page.tsx`
- `/client-login` — `src/app/client-login/page.tsx`
- `/community-hub` — `src/app/community-hub/page.tsx`
- `/community/apply` — `src/app/community/apply/page.tsx`
- `/community` — `src/app/community/page.tsx`
- `/company-controlled` — `src/app/company-controlled/page.tsx`
- `/company` — `src/app/company/page.tsx`
- `/compliance-notice` — `src/app/compliance-notice/page.tsx`
- `/contact` — `src/app/contact/page.tsx`
- `/cookie-policy` — `src/app/cookie-policy/page.tsx`
- `/developers` — `src/app/developers/page.tsx`
- `/docs` — `src/app/docs/page.tsx`
- `/eligibility` — `src/app/eligibility/page.tsx`
- `/eligibility/status` — `src/app/eligibility/status/page.tsx`
- `/enterprise-demo` — `src/app/enterprise-demo/page.tsx`
- `/enterprise-demo/watch` — `src/app/enterprise-demo/watch/page.tsx`
- `/enterprise-solutions` — `src/app/enterprise-solutions/page.tsx`
- `/forbidden` — `src/app/forbidden/page.tsx`
- `/forgot-password` — `src/app/forgot-password/page.tsx`
- `/get-started` — `src/app/get-started/page.tsx`
- `/intel` — `src/app/intel/page.tsx`
- `/login` — `src/app/login/page.tsx`
- `/news` — `src/app/news/page.tsx`
- `/newsletter` — `src/app/newsletter/page.tsx`
- `/operator-invitation` — `src/app/operator-invitation/page.tsx`
- `/personnel` — `src/app/personnel/page.tsx`
- `/portal` — `src/app/portal/page.tsx`
- `/preview` — `src/app/preview/page.tsx`
- `/privacy` — `src/app/privacy/page.tsx`
- `/products/cyber` — `src/app/products/cyber/page.tsx`
- `/products/financial` — `src/app/products/financial/page.tsx`
- `/products/real-estate` — `src/app/products/real-estate/page.tsx`
- `/request-access-controlled` — `src/app/request-access-controlled/page.tsx`
- `/request-access` — `src/app/request-access/page.tsx`
- `/reset-password` — `src/app/reset-password/page.tsx`
- `/resources` — `src/app/resources/page.tsx`
- `/review/verification` — `src/app/review/verification/page.tsx`
- `/services` — `src/app/services/page.tsx`
- `/store` — `src/app/store/page.tsx`
- `/super-admin-login` — `src/app/super-admin-login/page.tsx`
- `/team-login` — `src/app/team-login/page.tsx`
- `/terms` — `src/app/terms/page.tsx`
- `/tokmetric` — `src/app/tokmetric/page.tsx`
- `/trust-center` — `src/app/trust-center/page.tsx`
- `/unauthorized` — `src/app/unauthorized/page.tsx`
- `/unsubscribe` — `src/app/unsubscribe/page.tsx`
- `/whatsapp` — `src/app/whatsapp/page.tsx`
- `/workspace-invitation` — `src/app/workspace-invitation/page.tsx`

### Cybersecurity, intelligence & resources (29)

- `/developers/security` — `src/app/developers/security/page.tsx`
- `/developers/webhooks` — `src/app/developers/webhooks/page.tsx`
- `/docs/api/analytics` — `src/app/docs/api/analytics/page.tsx`
- `/docs/api/assets` — `src/app/docs/api/assets/page.tsx`
- `/docs/api/compliance` — `src/app/docs/api/compliance/page.tsx`
- `/docs/api/identity` — `src/app/docs/api/identity/page.tsx`
- `/docs/api/threats` — `src/app/docs/api/threats/page.tsx`
- `/docs/api/webhooks` — `src/app/docs/api/webhooks/page.tsx`
- `/docs/architecture` — `src/app/docs/architecture/page.tsx`
- `/docs/authentication` — `src/app/docs/authentication/page.tsx`
- `/docs/changelog` — `src/app/docs/changelog/page.tsx`
- `/docs/errors` — `src/app/docs/errors/page.tsx`
- `/docs/guides` — `src/app/docs/guides/page.tsx`
- `/docs/quickstart` — `src/app/docs/quickstart/page.tsx`
- `/docs/rate-limits` — `src/app/docs/rate-limits/page.tsx`
- `/docs/sdk/dotnet` — `src/app/docs/sdk/dotnet/page.tsx`
- `/docs/sdk/go` — `src/app/docs/sdk/go/page.tsx`
- `/docs/sdk/java` — `src/app/docs/sdk/java/page.tsx`
- `/docs/sdk/node` — `src/app/docs/sdk/node/page.tsx`
- `/docs/sdk/python` — `src/app/docs/sdk/python/page.tsx`
- `/docs/sdk/ruby` — `src/app/docs/sdk/ruby/page.tsx`
- `/docs/security` — `src/app/docs/security/page.tsx`
- `/docs/webhooks` — `src/app/docs/webhooks/page.tsx`
- `/intel/news/:slug` — `src/app/intel/news/[slug]/page.tsx`
- `/intel/news` — `src/app/intel/news/page.tsx`
- `/intel/news/preferences` — `src/app/intel/news/preferences/page.tsx`
- `/intel/news/saved` — `src/app/intel/news/saved/page.tsx`
- `/intel/news/videos` — `src/app/intel/news/videos/page.tsx`
- `/resources/business-readiness-checklist` — `src/app/resources/business-readiness-checklist/page.tsx`

### Client application & admin (80)

- `/app/admin/ads-bridge` — `src/app/app/admin/ads-bridge/page.tsx`
- `/app/admin/allocations` — `src/app/app/admin/allocations/page.tsx`
- `/app/admin/api/:domain` — `src/app/app/admin/api/[domain]/page.tsx`
- `/app/admin/api` — `src/app/app/admin/api/page.tsx`
- `/app/admin/approvals` — `src/app/app/admin/approvals/page.tsx`
- `/app/admin/audit` — `src/app/app/admin/audit/page.tsx`
- `/app/admin/campaigns/new` — `src/app/app/admin/campaigns/new/page.tsx`
- `/app/admin/campaigns` — `src/app/app/admin/campaigns/page.tsx`
- `/app/admin/client-operations` — `src/app/app/admin/client-operations/page.tsx`
- `/app/admin/communications` — `src/app/app/admin/communications/page.tsx`
- `/app/admin/customer-success` — `src/app/app/admin/customer-success/page.tsx`
- `/app/admin/gem-verify/evidence/governance` — `src/app/app/admin/gem-verify/evidence/governance/page.tsx`
- `/app/admin/gem-verify/evidence` — `src/app/app/admin/gem-verify/evidence/page.tsx`
- `/app/admin/gem-verify/evidence/scanner` — `src/app/app/admin/gem-verify/evidence/scanner/page.tsx`
- `/app/admin/gem-verify/operators` — `src/app/app/admin/gem-verify/operators/page.tsx`
- `/app/admin/gem-verify` — `src/app/app/admin/gem-verify/page.tsx`
- `/app/admin/intake` — `src/app/app/admin/intake/page.tsx`
- `/app/admin/kyc` — `src/app/app/admin/kyc/page.tsx`
- `/app/admin/market/activation` — `src/app/app/admin/market/activation/page.tsx`
- `/app/admin/market/operations` — `src/app/app/admin/market/operations/page.tsx`
- `/app/admin/market/outreach` — `src/app/app/admin/market/outreach/page.tsx`
- `/app/admin/market` — `src/app/app/admin/market/page.tsx`
- `/app/admin/market/proposal` — `src/app/app/admin/market/proposal/page.tsx`
- `/app/admin/market/research` — `src/app/app/admin/market/research/page.tsx`
- `/app/admin/news` — `src/app/app/admin/news/page.tsx`
- `/app/admin/organization-reports` — `src/app/app/admin/organization-reports/page.tsx`
- `/app/admin` — `src/app/app/admin/page.tsx`
- `/app/admin/plan-workspaces` — `src/app/app/admin/plan-workspaces/page.tsx`
- `/app/admin/users` — `src/app/app/admin/users/page.tsx`
- `/app/admin/verification-pilot/evidence` — `src/app/app/admin/verification-pilot/evidence/page.tsx`
- `/app/admin/verification-pilot` — `src/app/app/admin/verification-pilot/page.tsx`
- `/app/admin/workspace-access` — `src/app/app/admin/workspace-access/page.tsx`
- `/app/command-center/:section` — `src/app/app/command-center/[section]/page.tsx`
- `/app/command-center/integrations/news` — `src/app/app/command-center/integrations/news/page.tsx`
- `/app/command-center/integrations` — `src/app/app/command-center/integrations/page.tsx`
- `/app/command-center` — `src/app/app/command-center/page.tsx`
- `/app/command-center/social-media/content-studio` — `src/app/app/command-center/social-media/content-studio/page.tsx`
- `/app/command-center/social-media` — `src/app/app/command-center/social-media/page.tsx`
- `/app/command-center/tokmetric` — `src/app/app/command-center/tokmetric/page.tsx`
- `/app/community` — `src/app/app/community/page.tsx`
- `/app/compliance` — `src/app/app/compliance/page.tsx`
- `/app/dashboard` — `src/app/app/dashboard/page.tsx`
- `/app/documents` — `src/app/app/documents/page.tsx`
- `/app/meetings` — `src/app/app/meetings/page.tsx`
- `/app/messages` — `src/app/app/messages/page.tsx`
- `/app/my-portfolio` — `src/app/app/my-portfolio/page.tsx`
- `/app/notifications` — `src/app/app/notifications/page.tsx`
- `/app/platform-products` — `src/app/app/platform-products/page.tsx`
- `/app/portfolios/:portfolioId` — `src/app/app/portfolios/[portfolioId]/page.tsx`
- `/app/portfolios` — `src/app/app/portfolios/page.tsx`
- `/app/products/cyber` — `src/app/app/products/cyber/page.tsx`
- `/app/products/financial` — `src/app/app/products/financial/page.tsx`
- `/app/products` — `src/app/app/products/page.tsx`
- `/app/products/real-estate` — `src/app/app/products/real-estate/page.tsx`
- `/app/profile` — `src/app/app/profile/page.tsx`
- `/app/profiles` — `src/app/app/profiles/page.tsx`
- `/app/requests` — `src/app/app/requests/page.tsx`
- `/app/savings-vault` — `src/app/app/savings-vault/page.tsx`
- `/app/security` — `src/app/app/security/page.tsx`
- `/app/services` — `src/app/app/services/page.tsx`
- `/app/settings` — `src/app/app/settings/page.tsx`
- `/app/social-media/accounts` — `src/app/app/social-media/accounts/page.tsx`
- `/app/social-media/activity` — `src/app/app/social-media/activity/page.tsx`
- `/app/social-media/analytics` — `src/app/app/social-media/analytics/page.tsx`
- `/app/social-media/approvals` — `src/app/app/social-media/approvals/page.tsx`
- `/app/social-media/autopilot` — `src/app/app/social-media/autopilot/page.tsx`
- `/app/social-media/calendar` — `src/app/app/social-media/calendar/page.tsx`
- `/app/social-media/campaigns` — `src/app/app/social-media/campaigns/page.tsx`
- `/app/social-media/content` — `src/app/app/social-media/content/page.tsx`
- `/app/social-media/create` — `src/app/app/social-media/create/page.tsx`
- `/app/social-media` — `src/app/app/social-media/page.tsx`
- `/app/social-media/queue` — `src/app/app/social-media/queue/page.tsx`
- `/app/social-media/settings` — `src/app/app/social-media/settings/page.tsx`
- `/app/social-media/tokmetric` — `src/app/app/social-media/tokmetric/page.tsx`
- `/app/social-media/video` — `src/app/app/social-media/video/page.tsx`
- `/app/support/operations` — `src/app/app/support/operations/page.tsx`
- `/app/support` — `src/app/app/support/page.tsx`
- `/app/whatsapp` — `src/app/app/whatsapp/page.tsx`
- `/app/workspace` — `src/app/app/workspace/page.tsx`
- `/app/workspace/projects/:projectId/*` — `src/app/app/workspace/projects/[projectId]/[[...environment]]/page.tsx`

### Identity, onboarding & compliance (12)

- `/decision/approved` — `src/app/decision/approved/page.tsx`
- `/decision/manual-review` — `src/app/decision/manual-review/page.tsx`
- `/decision/pending` — `src/app/decision/pending/page.tsx`
- `/decision/rejected` — `src/app/decision/rejected/page.tsx`
- `/kyc/business` — `src/app/kyc/business/page.tsx`
- `/kyc/family-office` — `src/app/kyc/family-office/page.tsx`
- `/kyc/individual` — `src/app/kyc/individual/page.tsx`
- `/kyc/review` — `src/app/kyc/review/page.tsx`
- `/kyc/start` — `src/app/kyc/start/page.tsx`
- `/kyc/status` — `src/app/kyc/status/page.tsx`
- `/kyc/trust` — `src/app/kyc/trust/page.tsx`
- `/kyc/upload` — `src/app/kyc/upload/page.tsx`

### Alliance Trust Realty (separate division) (21)

- `/atr/about` — `src/app/atr/about/page.tsx`
- `/atr/affiliate` — `src/app/atr/affiliate/page.tsx`
- `/atr/buy` — `src/app/atr/buy/page.tsx`
- `/atr/contact` — `src/app/atr/contact/page.tsx`
- `/atr/dashboard` — `src/app/atr/dashboard/page.tsx`
- `/atr/demo/dashboard` — `src/app/atr/demo/dashboard/page.tsx`
- `/atr/enterprise` — `src/app/atr/enterprise/page.tsx`
- `/atr/for-beginners` — `src/app/atr/for-beginners/page.tsx`
- `/atr/for-beginners/strategy-framework` — `src/app/atr/for-beginners/strategy-framework/page.tsx`
- `/atr/invest` — `src/app/atr/invest/page.tsx`
- `/atr/investment-plan` — `src/app/atr/investment-plan/page.tsx`
- `/atr/login` — `src/app/atr/login/page.tsx`
- `/atr/packages` — `src/app/atr/packages/page.tsx`
- `/atr/portfolio` — `src/app/atr/portfolio/page.tsx`
- `/atr/properties` — `src/app/atr/properties/page.tsx`
- `/atr/property-management` — `src/app/atr/property-management/page.tsx`
- `/atr/qfs` — `src/app/atr/qfs/page.tsx`
- `/atr/register` — `src/app/atr/register/page.tsx`
- `/atr/resources` — `src/app/atr/resources/page.tsx`
- `/atr/sell` — `src/app/atr/sell/page.tsx`
- `/atr/status` — `src/app/atr/status/page.tsx`

### Community & Digital Hub (11)

- `/community-hub/circles` — `src/app/community-hub/circles/page.tsx`
- `/community-hub/events` — `src/app/community-hub/events/page.tsx`
- `/community-hub/knowledge` — `src/app/community-hub/knowledge/page.tsx`
- `/community-hub/members` — `src/app/community-hub/members/page.tsx`
- `/community-hub/messages` — `src/app/community-hub/messages/page.tsx`
- `/community-hub/opportunities` — `src/app/community-hub/opportunities/page.tsx`
- `/community-hub/profile` — `src/app/community-hub/profile/page.tsx`
- `/community-hub/requests` — `src/app/community-hub/requests/page.tsx`
- `/community-hub/settings` — `src/app/community-hub/settings/page.tsx`
- `/digital-hub` — `src/app/digital-hub/page.tsx`
- `/hub` — `src/app/hub/page.tsx`

### Social, marketing operations & commerce (37)

- `/business-review/payment/success` — `src/app/business-review/payment/success/page.tsx`
- `/business-review/proposal` — `src/app/business-review/proposal/page.tsx`
- `/facebook/analytics` — `src/app/facebook/analytics/page.tsx`
- `/facebook/approvals` — `src/app/facebook/approvals/page.tsx`
- `/facebook/content` — `src/app/facebook/content/page.tsx`
- `/facebook/operations` — `src/app/facebook/operations/page.tsx`
- `/store/:slug` — `src/app/store/[slug]/page.tsx`
- `/store/campaign-hub` — `src/app/store/campaign-hub/page.tsx`
- `/store/channels/:slug` — `src/app/store/channels/[slug]/page.tsx`
- `/store/facebook` — `src/app/store/facebook/page.tsx`
- `/store/google/operations` — `src/app/store/google/operations/page.tsx`
- `/store/google` — `src/app/store/google/page.tsx`
- `/store/google/readiness` — `src/app/store/google/readiness/page.tsx`
- `/store/main` — `src/app/store/main/page.tsx`
- `/store/products/:slug/request` — `src/app/store/products/[slug]/request/page.tsx`
- `/store/shopify` — `src/app/store/shopify/page.tsx`
- `/store/tiktok` — `src/app/store/tiktok/page.tsx`
- `/store/wix` — `src/app/store/wix/page.tsx`
- `/tokmetric/accounts` — `src/app/tokmetric/accounts/page.tsx`
- `/tokmetric/agents` — `src/app/tokmetric/agents/page.tsx`
- `/tokmetric/analytics` — `src/app/tokmetric/analytics/page.tsx`
- `/tokmetric/app-review` — `src/app/tokmetric/app-review/page.tsx`
- `/tokmetric/app` — `src/app/tokmetric/app/page.tsx`
- `/tokmetric/approvals` — `src/app/tokmetric/approvals/page.tsx`
- `/tokmetric/compliance` — `src/app/tokmetric/compliance/page.tsx`
- `/tokmetric/content-studio` — `src/app/tokmetric/content-studio/page.tsx`
- `/tokmetric/dashboard` — `src/app/tokmetric/dashboard/page.tsx`
- `/tokmetric/developer` — `src/app/tokmetric/developer/page.tsx`
- `/tokmetric/privacy-policy` — `src/app/tokmetric/privacy-policy/page.tsx`
- `/tokmetric/publishing` — `src/app/tokmetric/publishing/page.tsx`
- `/tokmetric/readiness` — `src/app/tokmetric/readiness/page.tsx`
- `/tokmetric/review-demo` — `src/app/tokmetric/review-demo/page.tsx`
- `/tokmetric/setup-status` — `src/app/tokmetric/setup-status/page.tsx`
- `/tokmetric/terms-of-service` — `src/app/tokmetric/terms-of-service/page.tsx`
- `/tokmetric/tiktok-setup` — `src/app/tokmetric/tiktok-setup/page.tsx`
- `/tokmetric/workspace-id` — `src/app/tokmetric/workspace-id/page.tsx`
- `/tokmetric/workspace` — `src/app/tokmetric/workspace/page.tsx`

### Other / shared (4)

- `/enterprise/apply` — `src/app/enterprise/apply/page.tsx`
- `/hub-controlled` — `src/app/hub-controlled/page.tsx`
- `/news/newsletter` — `src/app/news/newsletter/page.tsx`
- `/services/:slug` — `src/app/services/[slug]/page.tsx`

## B. API / route-handler endpoints in `main`


### /api/admin (23)

- `/api/admin/ads-bridge` — `src/app/api/admin/ads-bridge/route.ts`
- `/api/admin/audit` — `src/app/api/admin/audit/route.ts`
- `/api/admin/campaigns/:id/reconcile` — `src/app/api/admin/campaigns/[id]/reconcile/route.ts`
- `/api/admin/campaigns/:id` — `src/app/api/admin/campaigns/[id]/route.ts`
- `/api/admin/campaigns/:id/send` — `src/app/api/admin/campaigns/[id]/send/route.ts`
- `/api/admin/campaigns` — `src/app/api/admin/campaigns/route.ts`
- `/api/admin/communications/preferences` — `src/app/api/admin/communications/preferences/route.ts`
- `/api/admin/customer-success` — `src/app/api/admin/customer-success/route.ts`
- `/api/admin/intake/:id` — `src/app/api/admin/intake/[id]/route.ts`
- `/api/admin/intake/handoff` — `src/app/api/admin/intake/handoff/route.ts`
- `/api/admin/intake` — `src/app/api/admin/intake/route.ts`
- `/api/admin/kyc` — `src/app/api/admin/kyc/route.ts`
- `/api/admin/market/proposal-link` — `src/app/api/admin/market/proposal-link/route.ts`
- `/api/admin/news/ingest` — `src/app/api/admin/news/ingest/route.ts`
- `/api/admin/news/sources` — `src/app/api/admin/news/sources/route.ts`
- `/api/admin/operator-invitations` — `src/app/api/admin/operator-invitations/route.ts`
- `/api/admin/plan-workspaces` — `src/app/api/admin/plan-workspaces/route.ts`
- `/api/admin/requests/:id` — `src/app/api/admin/requests/[id]/route.ts`
- `/api/admin/requests` — `src/app/api/admin/requests/route.ts`
- `/api/admin/stats` — `src/app/api/admin/stats/route.ts`
- `/api/admin/users` — `src/app/api/admin/users/route.ts`
- `/api/admin/workspace-access` — `src/app/api/admin/workspace-access/route.ts`
- `/api/admin/workspace-invitations` — `src/app/api/admin/workspace-invitations/route.ts`

### /api/admin-access (2)

- `/api/admin-access` — `src/app/api/admin-access/route.ts`
- `/api/admin-access/validate` — `src/app/api/admin-access/validate/route.ts`

### /api/agent (13)

- `/api/agent/catalog` — `src/app/api/agent/catalog/route.ts`
- `/api/agent/commerce` — `src/app/api/agent/commerce/route.ts`
- `/api/agent/context` — `src/app/api/agent/context/route.ts`
- `/api/agent/google-store` — `src/app/api/agent/google-store/route.ts`
- `/api/agent/health` — `src/app/api/agent/health/route.ts`
- `/api/agent/instructions` — `src/app/api/agent/instructions/route.ts`
- `/api/agent/openapi` — `src/app/api/agent/openapi/route.ts`
- `/api/agent/public/commerce` — `src/app/api/agent/public/commerce/route.ts`
- `/api/agent/public/context` — `src/app/api/agent/public/context/route.ts`
- `/api/agent/public/health` — `src/app/api/agent/public/health/route.ts`
- `/api/agent/storefront` — `src/app/api/agent/storefront/route.ts`
- `/api/agent/tiktok-shop` — `src/app/api/agent/tiktok-shop/route.ts`
- `/api/agent/tiktok-store` — `src/app/api/agent/tiktok-store/route.ts`

### /api/assistant (2)

- `/api/assistant/message` — `src/app/api/assistant/message/route.ts`
- `/api/assistant/session` — `src/app/api/assistant/session/route.ts`

### /api/atr (1)

- `/api/atr/status` — `src/app/api/atr/status/route.ts`

### /api/auth (11)

- `/api/auth/forgot-password` — `src/app/api/auth/forgot-password/route.ts`
- `/api/auth/login` — `src/app/api/auth/login/route.ts`
- `/api/auth/logout` — `src/app/api/auth/logout/route.ts`
- `/api/auth/operator-invitation/accept` — `src/app/api/auth/operator-invitation/accept/route.ts`
- `/api/auth/operator-invitation/status` — `src/app/api/auth/operator-invitation/status/route.ts`
- `/api/auth/recovery-readiness` — `src/app/api/auth/recovery-readiness/route.ts`
- `/api/auth/recovery-readiness/verify` — `src/app/api/auth/recovery-readiness/verify/route.ts`
- `/api/auth/reset-password` — `src/app/api/auth/reset-password/route.ts`
- `/api/auth/session` — `src/app/api/auth/session/route.ts`
- `/api/auth/workspace-invitation/accept` — `src/app/api/auth/workspace-invitation/accept/route.ts`
- `/api/auth/workspace-invitation/status` — `src/app/api/auth/workspace-invitation/status/route.ts`

### /api/booking (1)

- `/api/booking/create` — `src/app/api/booking/create/route.ts`

### /api/command-center (2)

- `/api/command-center/export` — `src/app/api/command-center/export/route.ts`
- `/api/command-center/snapshot` — `src/app/api/command-center/snapshot/route.ts`

### /api/communications (1)

- `/api/communications/unsubscribe` — `src/app/api/communications/unsubscribe/route.ts`

### /api/contact (1)

- `/api/contact` — `src/app/api/contact/route.ts`

### /api/cron (1)

- `/api/cron/news-ingest` — `src/app/api/cron/news-ingest/route.ts`

### /api/dashboard (1)

- `/api/dashboard/summary` — `src/app/api/dashboard/summary/route.ts`

### /api/developers (3)

- `/api/developers/keys/:id` — `src/app/api/developers/keys/[id]/route.ts`
- `/api/developers/keys` — `src/app/api/developers/keys/route.ts`
- `/api/developers/webhooks` — `src/app/api/developers/webhooks/route.ts`

### /api/digital-hub (10)

- `/api/digital-hub/community` — `src/app/api/digital-hub/community/route.ts`
- `/api/digital-hub/ecosystem` — `src/app/api/digital-hub/ecosystem/route.ts`
- `/api/digital-hub/events` — `src/app/api/digital-hub/events/route.ts`
- `/api/digital-hub/health` — `src/app/api/digital-hub/health/route.ts`
- `/api/digital-hub/market/:sourceId` — `src/app/api/digital-hub/market/[sourceId]/route.ts`
- `/api/digital-hub/profiles/:profileId` — `src/app/api/digital-hub/profiles/[profileId]/route.ts`
- `/api/digital-hub/referral/btcc` — `src/app/api/digital-hub/referral/btcc/route.ts`
- `/api/digital-hub` — `src/app/api/digital-hub/route.ts`
- `/api/digital-hub/services/:serviceId` — `src/app/api/digital-hub/services/[serviceId]/route.ts`
- `/api/digital-hub/wallet` — `src/app/api/digital-hub/wallet/route.ts`

### /api/documents (1)

- `/api/documents` — `src/app/api/documents/route.ts`

### /api/entitlements (1)

- `/api/entitlements` — `src/app/api/entitlements/route.ts`

### /api/facebook (8)

- `/api/facebook/analytics` — `src/app/api/facebook/analytics/route.ts`
- `/api/facebook/approval` — `src/app/api/facebook/approval/route.ts`
- `/api/facebook/audit` — `src/app/api/facebook/audit/route.ts`
- `/api/facebook/connector` — `src/app/api/facebook/connector/route.ts`
- `/api/facebook/content` — `src/app/api/facebook/content/route.ts`
- `/api/facebook/emergency` — `src/app/api/facebook/emergency/route.ts`
- `/api/facebook/publishing` — `src/app/api/facebook/publishing/route.ts`
- `/api/facebook/verify` — `src/app/api/facebook/verify/route.ts`

### /api/google-merchant (3)

- `/api/google-merchant/activation-status` — `src/app/api/google-merchant/activation-status/route.ts`
- `/api/google-merchant/feed-health` — `src/app/api/google-merchant/feed-health/route.ts`
- `/api/google-merchant/readiness` — `src/app/api/google-merchant/readiness/route.ts`

### /api/health (1)

- `/api/health` — `src/app/api/health/route.ts`

### /api/intake (4)

- `/api/intake/community` — `src/app/api/intake/community/route.ts`
- `/api/intake/enterprise` — `src/app/api/intake/enterprise/route.ts`
- `/api/intake/product` — `src/app/api/intake/product/route.ts`
- `/api/intake/submit` — `src/app/api/intake/submit/route.ts`

### /api/intel (3)

- `/api/intel/news/:slug` — `src/app/api/intel/news/[slug]/route.ts`
- `/api/intel/news/categories` — `src/app/api/intel/news/categories/route.ts`
- `/api/intel/news` — `src/app/api/intel/news/route.ts`

### /api/internal (4)

- `/api/internal/admin-e2e` — `src/app/api/internal/admin-e2e/route.ts`
- `/api/internal/gem-verify/scan-timeouts` — `src/app/api/internal/gem-verify/scan-timeouts/route.ts`
- `/api/internal/intake-gateway/verify` — `src/app/api/internal/intake-gateway/verify/route.ts`
- `/api/internal/recovery-readiness-watch` — `src/app/api/internal/recovery-readiness-watch/route.ts`

### /api/kyc (3)

- `/api/kyc/documents` — `src/app/api/kyc/documents/route.ts`
- `/api/kyc` — `src/app/api/kyc/route.ts`
- `/api/kyc/submit` — `src/app/api/kyc/submit/route.ts`

### /api/market (2)

- `/api/market/checkout` — `src/app/api/market/checkout/route.ts`
- `/api/market/stripe/webhook` — `src/app/api/market/stripe/webhook/route.ts`

### /api/meetings (2)

- `/api/meetings/:id` — `src/app/api/meetings/[id]/route.ts`
- `/api/meetings` — `src/app/api/meetings/route.ts`

### /api/newsletter (2)

- `/api/newsletter/confirm` — `src/app/api/newsletter/confirm/route.ts`
- `/api/newsletter/subscribe` — `src/app/api/newsletter/subscribe/route.ts`

### /api/notifications (1)

- `/api/notifications` — `src/app/api/notifications/route.ts`

### /api/openapi (1)

- `/api/openapi` — `src/app/api/openapi/route.ts`

### /api/operations (1)

- `/api/operations/registry` — `src/app/api/operations/registry/route.ts`

### /api/platform-products (1)

- `/api/platform-products` — `src/app/api/platform-products/route.ts`

### /api/portfolios (1)

- `/api/portfolios` — `src/app/api/portfolios/route.ts`

### /api/requests (1)

- `/api/requests` — `src/app/api/requests/route.ts`

### /api/routes (1)

- `/api/routes` — `src/app/api/routes/route.ts`

### /api/social-media (17)

- `/api/social-media/analytics` — `src/app/api/social-media/analytics/route.ts`
- `/api/social-media/analytics/sync` — `src/app/api/social-media/analytics/sync/route.ts`
- `/api/social-media/autopilot/cancel` — `src/app/api/social-media/autopilot/cancel/route.ts`
- `/api/social-media/connectors/:id/test` — `src/app/api/social-media/connectors/[id]/test/route.ts`
- `/api/social-media/connectors/:provider/pause` — `src/app/api/social-media/connectors/[provider]/pause/route.ts`
- `/api/social-media/connectors/health` — `src/app/api/social-media/connectors/health/route.ts`
- `/api/social-media/connectors` — `src/app/api/social-media/connectors/route.ts`
- `/api/social-media/oauth/:provider/callback` — `src/app/api/social-media/oauth/[provider]/callback/route.ts`
- `/api/social-media/oauth/:provider/start` — `src/app/api/social-media/oauth/[provider]/start/route.ts`
- `/api/social-media/orchestrator/daily/process` — `src/app/api/social-media/orchestrator/daily/process/route.ts`
- `/api/social-media/orchestrator/daily` — `src/app/api/social-media/orchestrator/daily/route.ts`
- `/api/social-media/publishing/jobs/process/:slot` — `src/app/api/social-media/publishing/jobs/process/[slot]/route.ts`
- `/api/social-media/publishing/jobs/process` — `src/app/api/social-media/publishing/jobs/process/route.ts`
- `/api/social-media/publishing/jobs` — `src/app/api/social-media/publishing/jobs/route.ts`
- `/api/social-media/publishing/providers/capabilities` — `src/app/api/social-media/publishing/providers/capabilities/route.ts`
- `/api/social-media/publishing/providers/nextdoor/config` — `src/app/api/social-media/publishing/providers/nextdoor/config/route.ts`
- `/api/social-media/readiness` — `src/app/api/social-media/readiness/route.ts`

### /api/store (1)

- `/api/store/catalog` — `src/app/api/store/catalog/route.ts`

### /api/support (7)

- `/api/support/escalate` — `src/app/api/support/escalate/route.ts`
- `/api/support/message` — `src/app/api/support/message/route.ts`
- `/api/support/operations` — `src/app/api/support/operations/route.ts`
- `/api/support` — `src/app/api/support/route.ts`
- `/api/support/session/consent` — `src/app/api/support/session/consent/route.ts`
- `/api/support/session/start` — `src/app/api/support/session/start/route.ts`
- `/api/support/tickets/:ticketId/messages` — `src/app/api/support/tickets/[ticketId]/messages/route.ts`

### /api/system (1)

- `/api/system/bootstrap-status` — `src/app/api/system/bootstrap-status/route.ts`

### /api/ticket (2)

- `/api/ticket/create` — `src/app/api/ticket/create/route.ts`
- `/api/ticket` — `src/app/api/ticket/route.ts`

### /api/tiktok (1)

- `/api/tiktok/oauth/callback` — `src/app/api/tiktok/oauth/callback/route.ts`

### /api/tokmetric (18)

- `/api/tokmetric/agents` — `src/app/api/tokmetric/agents/route.ts`
- `/api/tokmetric/connectors/health` — `src/app/api/tokmetric/connectors/health/route.ts`
- `/api/tokmetric/connectors` — `src/app/api/tokmetric/connectors/route.ts`
- `/api/tokmetric/gpt-credentials` — `src/app/api/tokmetric/gpt-credentials/route.ts`
- `/api/tokmetric/oauth/callback` — `src/app/api/tokmetric/oauth/callback/route.ts`
- `/api/tokmetric/oauth/start` — `src/app/api/tokmetric/oauth/start/route.ts`
- `/api/tokmetric/publish-queue` — `src/app/api/tokmetric/publish-queue/route.ts`
- `/api/tokmetric/publishing/cancel` — `src/app/api/tokmetric/publishing/cancel/route.ts`
- `/api/tokmetric/publishing/context` — `src/app/api/tokmetric/publishing/context/route.ts`
- `/api/tokmetric/publishing/creator-info` — `src/app/api/tokmetric/publishing/creator-info/route.ts`
- `/api/tokmetric/publishing/init` — `src/app/api/tokmetric/publishing/init/route.ts`
- `/api/tokmetric/publishing/status` — `src/app/api/tokmetric/publishing/status/route.ts`
- `/api/tokmetric/publishing/upload-complete` — `src/app/api/tokmetric/publishing/upload-complete/route.ts`
- `/api/tokmetric/readiness` — `src/app/api/tokmetric/readiness/route.ts`
- `/api/tokmetric/shop/catalog` — `src/app/api/tokmetric/shop/catalog/route.ts`
- `/api/tokmetric/shop/oauth/callback` — `src/app/api/tokmetric/shop/oauth/callback/route.ts`
- `/api/tokmetric/shop/oauth/start` — `src/app/api/tokmetric/shop/oauth/start/route.ts`
- `/api/tokmetric/workflow` — `src/app/api/tokmetric/workflow/route.ts`

### /api/users (2)

- `/api/users/password` — `src/app/api/users/password/route.ts`
- `/api/users/profile` — `src/app/api/users/profile/route.ts`

### /api/v1 (14)

- `/api/v1/admin/bootstrap/status` — `src/app/api/v1/admin/bootstrap/status/route.ts`
- `/api/v1/admin/roles` — `src/app/api/v1/admin/roles/route.ts`
- `/api/v1/admin/users` — `src/app/api/v1/admin/users/route.ts`
- `/api/v1/ads-bridge` — `src/app/api/v1/ads-bridge/route.ts`
- `/api/v1/agent/instructions` — `src/app/api/v1/agent/instructions/route.ts`
- `/api/v1/notifications` — `src/app/api/v1/notifications/route.ts`
- `/api/v1/platform/access-requests` — `src/app/api/v1/platform/access-requests/route.ts`
- `/api/v1/platform/deployment-plan` — `src/app/api/v1/platform/deployment-plan/route.ts`
- `/api/v1/platform/environment` — `src/app/api/v1/platform/environment/route.ts`
- `/api/v1/platform/repository` — `src/app/api/v1/platform/repository/route.ts`
- `/api/v1/platform/repository/sync` — `src/app/api/v1/platform/repository/sync/route.ts`
- `/api/v1/production/health` — `src/app/api/v1/production/health/route.ts`
- `/api/v1/security/audit-logs` — `src/app/api/v1/security/audit-logs/route.ts`
- `/api/v1/support/tickets` — `src/app/api/v1/support/tickets/route.ts`

### /api/verify (24)

- `/api/verify/applications/consent` — `src/app/api/verify/applications/consent/route.ts`
- `/api/verify/applications` — `src/app/api/verify/applications/route.ts`
- `/api/verify/applications/submit` — `src/app/api/verify/applications/submit/route.ts`
- `/api/verify/evidence/:id/deletion-request` — `src/app/api/verify/evidence/[id]/deletion-request/route.ts`
- `/api/verify/evidence/:id/legal-hold` — `src/app/api/verify/evidence/[id]/legal-hold/route.ts`
- `/api/verify/evidence/complete` — `src/app/api/verify/evidence/complete/route.ts`
- `/api/verify/evidence/deletion-requests/:id/action` — `src/app/api/verify/evidence/deletion-requests/[id]/action/route.ts`
- `/api/verify/evidence/deletion-requests` — `src/app/api/verify/evidence/deletion-requests/route.ts`
- `/api/verify/evidence/internal-scanner` — `src/app/api/verify/evidence/internal-scanner/route.ts`
- `/api/verify/evidence/internal-scanner/self-test` — `src/app/api/verify/evidence/internal-scanner/self-test/route.ts`
- `/api/verify/evidence/items` — `src/app/api/verify/evidence/items/route.ts`
- `/api/verify/evidence/operations` — `src/app/api/verify/evidence/operations/route.ts`
- `/api/verify/evidence/readiness` — `src/app/api/verify/evidence/readiness/route.ts`
- `/api/verify/evidence/retention-policies/:id/action` — `src/app/api/verify/evidence/retention-policies/[id]/action/route.ts`
- `/api/verify/evidence/retention-policies` — `src/app/api/verify/evidence/retention-policies/route.ts`
- `/api/verify/evidence/retention/dry-run` — `src/app/api/verify/evidence/retention/dry-run/route.ts`
- `/api/verify/evidence/review-url` — `src/app/api/verify/evidence/review-url/route.ts`
- `/api/verify/evidence/scanner-callback` — `src/app/api/verify/evidence/scanner-callback/route.ts`
- `/api/verify/evidence/status` — `src/app/api/verify/evidence/status/route.ts`
- `/api/verify/evidence/upload-intent` — `src/app/api/verify/evidence/upload-intent/route.ts`
- `/api/verify/pilot-evidence` — `src/app/api/verify/pilot-evidence/route.ts`
- `/api/verify/pilot-readiness` — `src/app/api/verify/pilot-readiness/route.ts`
- `/api/verify/review` — `src/app/api/verify/review/route.ts`
- `/api/verify/system` — `src/app/api/verify/system/route.ts`

### /api/video (14)

- `/api/video/campaign/:campaignId/render` — `src/app/api/video/campaign/[campaignId]/render/route.ts`
- `/api/video/content/:contentId/finalize` — `src/app/api/video/content/[contentId]/finalize/route.ts`
- `/api/video/content/:contentId/preview` — `src/app/api/video/content/[contentId]/preview/route.ts`
- `/api/video/content/:contentId/render` — `src/app/api/video/content/[contentId]/render/route.ts`
- `/api/video/jobs/:promptId` — `src/app/api/video/jobs/[promptId]/route.ts`
- `/api/video/jobs` — `src/app/api/video/jobs/route.ts`
- `/api/video/readiness` — `src/app/api/video/readiness/route.ts`
- `/api/video/uploads/verify` — `src/app/api/video/uploads/verify/route.ts`
- `/api/video/worker/dispatch/:renderJobId/complete` — `src/app/api/video/worker/dispatch/[renderJobId]/complete/route.ts`
- `/api/video/worker/dispatch/:renderJobId/fail` — `src/app/api/video/worker/dispatch/[renderJobId]/fail/route.ts`
- `/api/video/worker/dispatch` — `src/app/api/video/worker/dispatch/route.ts`
- `/api/video/worker/finalize` — `src/app/api/video/worker/finalize/route.ts`
- `/api/video/worker/jobs/:renderJobId/status` — `src/app/api/video/worker/jobs/[renderJobId]/status/route.ts`
- `/api/video/worker/jobs` — `src/app/api/video/worker/jobs/route.ts`

### /api/workspace (4)

- `/api/workspace/members` — `src/app/api/workspace/members/route.ts`
- `/api/workspace/overview` — `src/app/api/workspace/overview/route.ts`
- `/api/workspace/projects` — `src/app/api/workspace/projects/route.ts`
- `/api/workspace/weekly-updates` — `src/app/api/workspace/weekly-updates/route.ts`

### /api/workspaces (1)

- `/api/workspaces` — `src/app/api/workspaces/route.ts`

### /functions (3)

- `/functions/:action` — `src/app/functions/[action]/route.ts`
- `/functions/tokmetric/agent-plan` — `src/app/functions/tokmetric/agent-plan/route.ts`
- `/functions/tokmetric/context` — `src/app/functions/tokmetric/context/route.ts`

### /robots.txt (1)

- `/robots.txt` — `src/app/robots.txt/route.ts`

### /sitemap.xml (1)

- `/sitemap.xml` — `src/app/sitemap.xml/route.ts`

## C. Known product domains requiring explicit release verification

- Public marketing and customer acquisition
- Cybersecurity services and client security workspace
- Threat intelligence / news / reporting
- Individual and business onboarding, access, and KYC/KYB
- Client app, workspace, portfolios, documents, support, meetings and notifications
- Admin / superadmin / user and access administration
- Compliance, privacy, terms, cookies, trust center, audit and evidence governance
- Community and Digital Hub
- Alliance Trust Realty (ATR)
- Social media, content studio, provider OAuth, publishing and analytics
- TokMetric/TikTok and other provider integrations
- Store/product catalogue, business review, proposal, checkout and payment/webhook paths
- Developer documentation, keys, webhooks and SDK guides
- Video/media workflow and worker endpoints
- Platform health/readiness, deployment, sitemap/robots and recovery

## D. Known route-inventory cautions from repository documents

- Existing navigation documents conflict with the current source tree and are dated; they must be reconciled to this generated route list rather than treated as the definitive route count.
- `/community` is documented in README as redirecting to `/community-hub`; `/community-hub` is described as a non-indexed interface preview, not a live member network.
- `/register` is documented as a permanent redirect to `/get-started`; self-registration is disabled.
- Store pages are request-only and do not create orders, subscriptions, payments, inventory commitments, or SLAs.
- Provider-dependent publishing, ads, shop writes, KYC, payments, threat intelligence and continuous monitoring must remain gated until their activation evidence is verified.
- Source code alone cannot establish deployed HTTP status, access-control correctness, provider connection, data persistence, or public readiness.

## E. Release audit next steps

1. Reconcile duplicate/overlapping public paths and redirect rules.
2. Map each required capability to one canonical route/journey; mark missing routes separately from existing routes that need nav exposure.
3. Test every public page on production and preview; record HTTP status, redirect destination, auth behavior, and mobile render.
4. Test authenticated pages with anonymous, ordinary-client, organization-admin, and superadmin roles.
5. Test APIs independently for method, auth, tenant isolation, validation, rate limits, persistence and failure modes.
6. Confirm provider status for social publishing, email, payment, storage, analytics, KYC and any intelligence feed; do not infer connectivity from a settings page or schema.
7. Build the final requirements-to-code-to-production matrix and prioritize only evidenced gaps.

**This document is an inventory baseline. It intentionally does not label routes “finished” without behavior and production evidence.**
