# GEM Enterprise public personnel and functional team publishing

## Site

- Public directory: https://www.gemcybersecurityassist.com/personnel
- Public role detail routes: `/personnel/teams/[slug]` (19 nonrestricted, role-only functions)
- Future publication-approved person detail routes: `/personnel/profile/[id]`
- Internal gallery and editorial review: `/app/admin/team-gallery`
- Authority: [GEM Production Directory & Verification Registry](https://app.notion.com/p/bf3c7474ecb44ded94544bfb8eddceb3)
- Governance: [GEM Enterprise Production Publishing, Roles & Private Sessions Standard](https://app.notion.com/p/3b0b5b56eac281aaa04ff6df173120d8)

## Audited production state (November 10, 2026)

- Public page responds, but publication adapter reports `not_configured`.
- The Notion production registry exists and has data source ID `7b16d9de-a86e-4aed-8ab7-7c9b937d3abc`.
- Ten historic named people/function records are in the registry.
- **All 10 records have `Publish Approved=false` and `Website Visibility=Hidden`**. None can be published to an anonymous visitor.
- The primary Vercel project originally had neither `NOTION_API_TOKEN` nor `NOTION_PERSONNEL_DATA_SOURCE_ID`.
- `NOTION_PERSONNEL_DATA_SOURCE_ID` was configured for Production and Preview on `support371-gem-enterprise` (canonical Vercel project). `NOTION_API_TOKEN` is still absent.
- The Notion schema did not match the previous website parser. It is now reconciled.

## Completed feature work

- Redesigned the public Personnel page around four organizational groups and 19 publicly describable **departmental functions** (not named/hired people). The restricted VIP relationship desk is intentionally excluded.
- Added mobile-responsive searchable/filterable functional team cards, team profile detail routes, approval status explanations and a qualified-engagement contact action.
- Kept individual verified-person cards and added a dedicated page route, which returns **404 unless that particular profile is approved by the authoritative registry**.
- The fallback no longer overwhelms the public page with backend configuration warnings. A compact informational block explains why named people are not yet shown.
- Fixed the Notion adapter to use real properties (`Profile / Function`, `Public Bio`, `Audience` multi_select, `Licensing Authority`, and `Public License Display` select). Uses `Profile / Function` for the public name, never the auto-increment `Profile ID`.
- Requires independent public-only visibility, explicit publication checkbox, CEO approval, verified status, reviewer, verification date and an unexpired record; AI, VIP, internal, archived and unapproved records stay hidden.
- Independently re-screens API results server-side and supports paginated approved profile results. Fails closed on provider/response/pagination errors, returning no partial profiles.
- Never returns private evidence files, internal notes, license numbers, reviewer details or private source links to public visitors.

## One remaining connection task (requires a Notion integration secret)

There is **no reusable Notion token** stored in the reviewed primary Vercel projects and the ChatGPT Notion connector cannot provide its secret to Vercel. Do not copy a random API key or paste any credential into a public chat or repository.

1. In the authorized GEM Firm Notion workspace, create or identify a Notion **internal integration** with only the permissions necessary to read the verification registry.
2. In the Notion registry, grant that integration access to **GEM Production Directory & Verification Registry** (database and data source).
3. In the **primary admin Vercel account**, open project `support371-gem-enterprise` and add its secret under environment variable key `NOTION_API_TOKEN`, as **encrypted/sensitive**, scoped to Production and Preview.
4. Redeploy after the variable is saved. Test the authorized read; successful configuration should show zero publicly approved human profiles until a reviewer authorizes one.

The data-source ID alone is not a token. Avoid creating duplicate data sources or disabling the publication gates to make the website appear populated.

## Publishing an actual staff profile

An authorized reviewer must verify each record in the production Notion registry:
- Current legal identity and written consent; correct relationship and role.
- Professional credential and issuing authority where applicable.
- Authentic portrait and usage approval (or no portrait).
- Reviewer assigned and `Last Verified` recorded.
- Current `Verification Status = Verified`; `CEO Approval = Approved`.
- `Audience` must **include Public and exclude Internal/VIP/Super Admin**. `Website Visibility = Public`.
- Record is not expired; `Publish Approved = checked` last.
- `Public Bio` contains the approved public statement. Only display professional license details if `Public License Display = Verified` is separately approved.

Only then may a named person appear on `/personnel` and the dedicated individual route. If the person is revoked, hidden, expires or loses evidence, the public route must immediately fail closed.

## Verification required for release

- Run `pnpm run db:generate` with local placeholder database URL values for Prisma client generation; do not migrate production.
- Run `pnpm run verify:preview` and GitHub CI build.
- Check public `/personnel`, representative `/personnel/teams/[slug]` and no-index/404 status for a non-approved `/personnel/profile/[id]`.
- Check iPhone visual layout, filtering, and absence of private Notion/legacy roster data in public responses.
- Confirm primary Vercel production deployment SHA. Only claim live readiness when the deployment is READY and its public HTML renders the new Teams sections.
