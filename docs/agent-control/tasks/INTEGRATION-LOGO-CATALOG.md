# Integration Logo Catalogue — 300+ Governed Connectors

## TASK ID
INTEGRATION-LOGO-CATALOG

## TITLE
Complete the Workspace OS connector catalogue with consistent live logos

## OWNER
Codex / Workspace OS integrations lane

## SOURCE PR/ISSUE
User-directed product completion

## CURRENT MAIN SHA
`f084e96457ffa8480be9fadfbb0698bf489da5cd`

## SOURCE HEAD SHA
`f084e96457ffa8480be9fadfbb0698bf489da5cd`

## WORKING BRANCH
`codex/integration-logo-catalog`

## OBJECTIVE
Preserve the approved Integration Command Center flow while expanding the
central Workspace OS directory to at least 300 distinct provider applications.
Every connector card and preview must use a consistent logo frame, a live
provider-derived logo, and a controlled fallback without implying that catalogue
availability grants provider authorization.

## NON-GOALS

- Do not configure provider credentials or activate external services.
- Do not move the global marketplace into an individual product such as IWW.
- Do not claim catalogue entries are connected, healthy, or production-ready.
- Do not change Prisma, authentication, billing, or deployment ownership.

## KNOWN CURRENT STATE
The implementation now supplies 340 provider applications across 15 categories,
merges them behind GEM operational surfaces, and renders uniform lazy-loaded
logos with controlled fallbacks and focus-managed previews.

## KNOWN DEFECT / MISSING CAPABILITY
Cards do not show provider logos and the directory does not yet meet the 300-app
catalogue requirement.

## OWNED FILES

- `src/lib/workspaceIntegrationCatalog.ts`
- `src/components/command-center/WorkspaceIntegrationCatalog.tsx`
- `src/app/app/command-center/integrations/page.tsx`
- `src/__tests__/workspace-integration-catalog.test.ts`
- `src/__tests__/workspace-integration-catalog-ui.test.tsx`
- `src/__tests__/workspace-os-phase3.test.ts`
- `docs/agent-control/tasks/INTEGRATION-LOGO-CATALOG.md`
- `docs/agent-control/ACTIVE-WORK.md` (this entry only)

## FORBIDDEN FILES

- Prisma schema and migrations
- Authentication and authorization implementation
- Provider credentials and Vercel environment configuration
- IWW repository files
- Files owned by PR #291, PR #292, or PR #252

## IMPLEMENTATION REQUIREMENTS

- At least 300 unique catalogue entries with stable IDs and provider domains.
- Fixed card and logo dimensions across categories and responsive breakpoints.
- Lazy-loaded live logos with accessible labels and resilient fallbacks.
- Operational GEM surfaces remain distinguishable from available catalogue apps.
- Search includes provider, description, category, and status.
- Inspection dialog preserves focus management and workspace/project context.

## SECURITY BOUNDARIES
Catalogue visibility is discovery only. Connections remain server-authorized,
credential-free in browser code, scoped to the current workspace, and fail closed.

## TEST PLAN

### CONFIGURATION-INDEPENDENT TESTS

- Catalogue integrity, uniqueness, size, valid domains, and category coverage.
- Focused Workspace OS tests, lint, typecheck, unit tests, build, diff check, and
  tracked-secret scan through canonical verification commands.

### CONFIGURATION-DEPENDENT TESTS

- Exact-head Vercel preview and responsive browser inspection when Git-integrated
  preview deployment becomes available.

## ACCEPTANCE CRITERIA

- 300+ real provider entries are searchable in the approved catalogue flow.
- Every visible connector has a uniform logo shell and provider-derived preview.
- Broken logo responses degrade to a stable, readable fallback.
- No entry is represented as connected solely because it is listed.
- Configuration-independent verification passes at the exact implementation head.

## ROLLBACK POINT
`f084e96457ffa8480be9fadfbb0698bf489da5cd`

## HUMAN GATES
Provider OAuth authorization, credentials, commercial contracts, and production
activation remain human-controlled.

## RETURN FORMAT
Exact head, changed files, catalogue count, checks, preview URL, blockers, and
next safe action.

## SUPERSESSION CONDITIONS
Superseded only by a newer task contract that explicitly owns these files and
preserves the same catalogue security boundary.

## MERGE GATE
All configuration-independent checks and exact-head preview checks must pass;
production remains owned by the canonical Vercel Git integration.

## LOCAL VERIFICATION

- Focused catalogue, interaction, and Workspace OS tests: 11 passed.
- Repository lint and TypeScript: passed.
- Full test suite: 115 files and 681 tests passed.
- Prisma schema validation and client generation: passed.
- Next.js production build: passed; 358 static pages generated.
- `git diff --check`: passed.
