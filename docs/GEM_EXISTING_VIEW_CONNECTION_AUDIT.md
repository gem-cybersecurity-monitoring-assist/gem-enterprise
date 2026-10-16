# GEM Existing-View Connection Audit — Baseline Pass

**Audited source:** `support371/gem-enterprise`, branch `main`, commit `9f1da4f0921ff44b9f895dd911075aba972514ad`.
**Purpose:** preserve existing UI and reconcile the current navigation with actual App Router source before changing application code.
**Scope:** static source reconciliation only. No production requests, account logins, database mutations, provider calls, or deployment were performed.

## Executive finding

The repository already contains a substantial established application. At the audited commit there are 254 App Router page files and 224 route-handler files (478 source-file rows, not 477 distinct public URLs). The current primary navigation is implemented in `src/components/Navigation.tsx` and includes Home, Intel, News, Services, Store, Community, Hub, Resources, and Company sections. Existing routes include extensive client/admin workspaces, ATR pages, community pages, social-media operations, store pages, and APIs.

The correct next step is to reconcile and test these existing surfaces—not redesign them or create duplicate replacements.

## Concrete findings

### 1. Existing views are present and should be preserved

The source tree includes, among others:

- Client application: `/app/dashboard`, `/app/profile`, `/app/settings`, `/app/documents`, `/app/requests`, `/app/messages`, `/app/meetings`, `/app/notifications`, `/app/support`, `/app/workspace`.
- Admin/operations: `/app/admin`, `/app/admin/users`, `/app/admin/audit`, `/app/admin/approvals`, `/app/admin/intake`, `/app/admin/kyc`, `/app/admin/market`, `/app/admin/workspace-access`.
- Social operations: `/app/social-media` and account, activity, analytics, approvals, calendar, campaigns, content, queue, settings and video subroutes.
- ATR: `/atr`, `/atr/properties`, `/atr/buy`, `/atr/sell`, `/atr/property-management`, `/atr/investment-plan`, `/atr/packages`, `/atr/portfolio`, `/atr/dashboard`.
- Community: `/community-hub` plus members, circles, events, knowledge, messages, opportunities, profile, requests and settings.
- Store: `/store`, `/store/[slug]`, `/store/products/[slug]/request`, channel pages, and existing provider-specific pages.

Source presence is not evidence that each view's data, authorization or provider calls are operational.

### 2. Existing navigation has an old contradictory audit document

`NAVIGATION_AUDIT.md` says several routes are missing and proposes creating routes. However, many of those views now exist in the current `main` tree. For example, community-hub members/circles/events/knowledge, ATR properties, and extensive application pages are present. Therefore that document must not be used as a literal instruction to create duplicates.

`TESTING_AND_VERIFICATION.md` and `ROLE_BASED_GUIDES.md` contain checkmarked claims about navigation and browser testing. These are documentation claims, not fresh test evidence for the pinned commit. Re-run actual checks before relying on them.

### 3. Navigation targets need a runtime/anchor pass

The current `src/components/Navigation.tsx` includes 52 distinct literal path/href strings in the statically scanned source. This scan is not a complete link inventory because JSX expressions and shared access-portal data can define additional links.

- The Home menu uses `/#highlights`.
- Intel uses `/intel#reports`, `/intel#monitoring`, and `/intel#briefs`.
- Services uses `/services#cyber`, `/services#financial`, `/services#real-estate`, `/services#assessments`, and `/services#consultations`.
- Resources uses `/resources#insights`, `/resources#templates`, `/resources#bots`, and `/resources#faq`.
- Company uses `/company#leadership`, `/company#board`, and `/company#teams`.
- Community uses `/community-hub#overview`.

Static file presence cannot confirm that each corresponding element ID exists or that the browser scrolls correctly. Validate each anchor against the actual rendered page before changing menu targets.

### 4. Store item URLs use dynamic route templates

The navigation links to `/store/24-7-threat-monitoring`, `/store/security-posture-assessment`, `/store/compliance-readiness-review`, and `/store/cybersecurity-consultation`. The tree contains `/store/[slug]`, so these may be handled by the existing dynamic page rather than separate page files. Verify the slug content and unknown-slug behavior; do not create static duplicates merely because the literal paths have no individual files.

### 5. Important navigation implementation detail

Desktop primary navigation renders section-level links; submenu items are rendered in the mobile expandable menu. The desktop header separately exposes Solutions, Contact, WhatsApp, Sign in, and Get Started. Verify expected desktop information architecture against the user's existing design before changing it. This audit does not recommend changing the layout.

## Connection verification plan

For each current route/view, collect evidence for these fields:

| Field | What to verify |
|---|---|
| Source | Page and component file, exact branch and commit |
| Navigation | Where linked from; target resolves; anchor ID exists |
| Data | Database-backed, provider-backed, manual, seeded, or mock; show provenance |
| API | Actual handler, request/response schema, validation, error behavior |
| Authentication | Anonymous/client/team/admin/superadmin behavior |
| Authorization | Object- and tenant-level checks on the server, not only hidden UI |
| Integration | Provider, OAuth scopes, callback URL, token storage, webhook/cron, health |
| Runtime | Preview and production status checked at canonical URL |
| Acceptance test | Repeatable test and observed result |
| Disposition | Keep as-is, connect existing code, fix bug, gate/defer, or remove only with explicit approval |

## Safe execution order

1. Run the existing package verification scripts on a clean local checkout and capture exit codes.
2. Test current navigation targets and anchor IDs against the local application; do not rewrite UI yet.
3. Trace login/session/route protection and role enforcement in page and API handlers.
4. Trace each high-priority customer journey from UI through API and database, using disposable test data.
5. Verify provider readiness separately from the UI; keep live writes, ads, payments, investment activity, and social publishing disabled unless explicitly authorized and acceptance-tested.
6. Fix only evidenced gaps in the existing implementation. Keep changes small, covered by tests, and reversible.
7. Re-test preview before promoting changes to production.

## Not yet verified

- Live production status for all routes.
- Whether each anchor ID exists in the rendered DOM.
- Whether all client/team/admin roles are enforced correctly at every API and object boundary.
- Whether social OAuth accounts and publishing providers are connected and approved.
- Whether all cron jobs are registered and healthy.
- Whether real-time dashboards use fresh provider/database data.
- Whether contact, newsletter, uploads, webhooks and external handoffs work end to end.

**Conclusion:** keep the existing views. The next engineering pass should produce test evidence and repair existing connections, not create a replacement website.
