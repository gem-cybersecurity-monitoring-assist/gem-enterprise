# GEM Enterprise — Full Team and Department Directory

**Implementation branch:** `feat/enterprise-teams-complete-20261110` (created in a separate worktree inside the user's existing active Codespace, preserving social activation PR #479).

## Source reconciliation

- The original Notion staff-media page supplied **nine source photographs and one Advertising video record**. Its role labels are not evidence of current staffing or identity.
- GEM + ATR's original [Organizational Structure](https://app.notion.com/p/393b5b56eac281d186bdfd5d254ef2e9) identifies three overarching groupings: CEO/executive governance, GEM Cybersecurity and Monitoring Assist, and Alliance Trust Realty.
- The historic [Staff Directory](https://app.notion.com/p/393b5b56eac281ddb84ae0f57a2122a0) names six people and four desks/functions. Its records also identify outstanding employment, credential, license, image and approval evidence. No automatic person-to-photo assignment is justified.
- The company's existing app includes operational capabilities beyond these three groups. The new catalog expands this into a **fourth UI grouping for cross-division shared services**, not a new legal division.

## Completed pages

- Admin Teams Gallery: `/app/admin/team-gallery`, with the original role media gallery and a new searchable/filterable twenty-function organizational directory.
- Twenty native protected departmental profile routes: `/app/admin/team-gallery/teams/[slug]`.
- Four division and shared-service overview routes: `/app/admin/team-gallery/divisions/[division]`.
- Ten source-based historical personnel/desk **review** routes: `/app/admin/team-gallery/roster/[slug]`.
- Ten original media professional role routes remain: `/app/admin/team-gallery/[slug]`.
- Twenty new Notion departmental child pages within [Enterprise Department & Functional Team Profiles](https://app.notion.com/p/414b5b56eac281a08791f4d49cb3a263) and linked to platform routes.
- The public `/company` page now describes functional leadership without fictitious named executives, fabricated team headcounts, or unsupported association memberships. Its personnel link still points to the independently approval-gated `/personnel`.

## How statuses are represented

- `documented`: a function is recorded in the original organizational sources, but not independently established as currently staffed or active.
- `planned`: a proposed service function suggested by the enterprise's documented platform and organizational requirements, not an operational claim.
- `restricted`: an internal service function intended for limited authorized visibility (e.g. VIP Desk).
- Historic roster records: independent review profiles with source links and explicit verification tasks; **not** verified employee biographies.

## Privacy, compliance and publication

- These pages inherit `/app/admin/**` authentication and permission handling; they are not published as a public staff list.
- No unsupported professional licenses, employee portraits, client projects, staff counts, executive appointments or organizational memberships are asserted.
- No staff media are reassigned to a named person without evidence and image permission.
- Existing `/personnel` publication gates and its source configuration remain unchanged.
- No funds, production secrets, paid services or production database changes were needed.
- Newly created Notion team pages are editorial documentation, not evidence of a hired or operational team.
- The ten-image variation concepts on the **original photographed roles** remain planned, **not generated**.

## Acceptance checklist

1. Verify source manifest and all 20 department links, 4 divisions, 10 legacy review routes, and original media routes.
2. Run `pnpm run db:generate` with safe placeholder database URLs only for offline Prisma client generation; do not run database migrations or push against production credentials.
3. Run `pnpm run verify:preview`: schema/claims, lint, TypeScript, and full test suite.
4. Run a Next.js production build with a valid environment, preferably GitHub CI or a permitted Vercel preview.
5. Inspect the authenticated gallery and at least representative functional/roster routes on iPhone/desktop. Confirm direct navigation is denied to unauthorized users.
6. Verify public `/company` and `/personnel` show no restricted roster content or fictional credentials.
7. Obtain real user/company records and authorized photo assets before any public employee profile or generated variants are published.

**No automatic Notion two-way sync or verified named staff headshots were added.**
