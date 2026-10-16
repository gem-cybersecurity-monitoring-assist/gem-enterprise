# GEM Existing-Platform Verification Runbook (PowerShell)

**Purpose:** verify and complete the existing GEM application without redesigning or replacing existing views.
**Repository:** `support371/gem-enterprise`
**Safety:** these commands start with read-only checks and local validation. Do not run database promotion/push/migration, publish social posts, send campaigns, charge payments, or deploy until the relevant acceptance gate is passed and explicitly approved.

## 0. Confirm the correct checkout

Open PowerShell in the existing repository folder. Do not create a new project folder if the real checkout already exists.

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

Invoke-CheckedNative "Repository root" { git rev-parse --show-toplevel }
Invoke-CheckedNative "Repository remote" { git remote -v }
Invoke-CheckedNative "Current branch" { git branch --show-current }
Invoke-CheckedNative "Current commit" { git log -1 --format="%H%n%cs%n%s" }
Invoke-CheckedNative "Working-tree status" { git status --short --branch }
Invoke-CheckedNative "Node.js version" { node --version }
Invoke-CheckedNative "Corepack version" { corepack --version }
Invoke-CheckedNative "pnpm version" { corepack pnpm --version }
```

Expected: the remote identifies `support371/gem-enterprise`, the working-tree status is understood, Node matches the repository's declared Node 24.x requirement, and Corepack/pnpm are available. Keep this PowerShell session open so `Invoke-CheckedNative` remains defined. If the checkout is dirty, preserve those changes; do not reset or clean them. Do not switch branches or build until dirty files are reviewed.

## 1. Create a safe working branch

Only after confirming the correct repository and preserving existing work:

```powershell
git switch -c audit/gem-existing-view-connections
```

If that branch already exists, switch to it instead of creating a duplicate. Do not force-push.

## 2. Generate a fresh local route and connection inventory

Use the generator after the inventory pull request is merged or after the generator file is present in the checked-out branch:

```powershell
Invoke-CheckedNative "Generate route and connection inventory" { node scripts/generate-gem-route-inventory.mjs }
```

Record the generated files and review them. Confirm that local environment secret files are not included. Compare the fresh route list with the committed inventory and document any differences; source counts are not live URL counts.

## 3. Install dependencies without changing application data

```powershell
Invoke-CheckedNative "Frozen-lockfile install" { corepack pnpm install --frozen-lockfile }
```

If this fails, capture the full error and stop. Do not delete the lockfile or change dependency versions as a workaround.

## 4. Run local verification in read-only / non-production mode

Check that the required environment variables point only to local or dedicated non-production services before running application tests. Do not paste secrets into logs, tickets or chat.

```powershell
Invoke-CheckedNative "Schema checks" { corepack pnpm run db:schema:check }
Invoke-CheckedNative "Public-claims check" { corepack pnpm run claims:check }
Invoke-CheckedNative "Lint" { corepack pnpm run lint }
Invoke-CheckedNative "Typecheck" { corepack pnpm run typecheck }
Invoke-CheckedNative "Tests" { corepack pnpm run test }
```

Record each command's exit code and output. Stop at the first failure, diagnose it, and repair the underlying existing implementation on the working branch. Do not mask failures or skip checks merely to get a green build.

Build only after the checks pass:

```powershell
Invoke-CheckedNative "Production bundle build" { corepack pnpm run build }
```

The repository's build script may require environment configuration; use non-production test credentials only. This runbook intentionally avoids `pnpm run verify`: the current script invokes `db:generate`, which chains schema-promotion scripts. Do not run `db:generate`, `db:schema:promote`, `db:push`, or `db:migrate` during the baseline. Never run a production database migration or schema push as part of this pass.

## 5. Validate existing views and route behavior

Start the local app only with safe non-production configuration:

```powershell
pnpm run dev
```

Use the local browser and record evidence for the existing views, preserving layout and content. Test:
- Primary navigation, desktop/mobile menu, every submenu link, and all in-page anchors.
- Dynamic store slugs, valid and invalid slugs, and expected not-found behavior.
- Public contact/demo flows using synthetic test data and non-production email.
- Anonymous versus authenticated access for client, team, admin and superadmin routes.
- API-level object/tenant isolation; hiding a link in the UI is not authorization.
- Error, loading, empty, stale-data and provider-disconnected states.

Do not use real customer records or production credentials in local tests.

## 6. Evidence format for each route or feature

Create one record per view/flow with:
- Route and source commit
- Entry point / referring navigation item
- UI component and server handler
- Data source (database, provider, static, seeded, or mock)
- Authentication and authorization expectation
- Dependencies and provider readiness
- Exact test steps, expected result, observed result, and evidence
- Status: `verified`, `implemented-unverified`, `broken`, or `blocked`
- Minimal corrective change and regression test

Do not mark a feature complete just because a file exists or the page renders.

## 7. Release gates

- **Gate A — Inventory:** route inventory regenerated and reconciled with navigation, dynamic routes, redirects, rewrites and sitemap.
- **Gate B — Security:** role matrix and tenant/object isolation tests pass; secrets are not exposed; audit controls are checked.
- **Gate C — Customer journeys:** business and individual acquisition, contact, onboarding and support journeys pass end to end.
- **Gate D — Providers/compliance:** OAuth scopes, callback URLs, webhooks, email deliverability, consent, claims and applicable legal requirements verified.
- **Gate E — Production:** preview acceptance, backups/restore, monitoring, rollback, and post-deploy smoke checks are evidenced.

Keep social publishing, advertising spend, payment activation, investment transactions and destructive database operations disabled until their specific gate has passed and the authorized owner approves activation.

## Current known limits

This runbook is not proof that any command has been run on the user's desktop. It is an executable plan. The assistant can inspect repository files and connected GitHub resources available to the current session; local PowerShell execution and private provider-account checks require their own outputs/access. Report exact blockers rather than claiming they passed.
