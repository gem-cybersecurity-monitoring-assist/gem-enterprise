# CI Provider Independence

GEM Enterprise must not depend on one hosted CI vendor being billable or available in order to establish release evidence.

## Release principle

A provider outage, account restriction, runner-startup failure, or billing lock is classified as `INFRA_BLOCKED`, not as an application test failure. It must never be converted into a false green result, and it must not trigger weakening or deletion of existing security checks.

## Authoritative validation path while GitHub-hosted Actions is unavailable

For each candidate pull-request head:

1. Record the exact Git commit SHA.
2. Require an exact-head deployment from the authoritative Vercel project `support371-gem-enterprise`.
3. Require the Vercel Preview build to reach `READY`.
4. Confirm the build executed the repository preview-verification chain before the Next.js production build.
5. Run the dependency-free deployment smoke verifier against the exact-head deployment.
6. Check preview runtime errors/fatal logs for the release window.
7. Record the deployment ID, target URL, smoke result, and merge decision in the pull-request evidence.

The repository's preview build path already executes `pnpm run verify:preview`, which covers Prisma/schema structural checks, public-claims validation, ESLint, TypeScript, and Vitest before `next build` completes.

## Deployment smoke verifier

Run:

```bash
SMOKE_BASE_URL=https://<exact-head-preview> node scripts/deployment-smoke.mjs
```

For a Vercel preview protected by Deployment Protection, provide the approved bypass secret only as a runtime environment variable:

```bash
SMOKE_BASE_URL=https://<exact-head-preview> \
VERCEL_AUTOMATION_BYPASS_SECRET=<runtime-secret> \
node scripts/deployment-smoke.mjs
```

Never commit, log, or place the bypass secret in a URL.

The smoke verifier checks:

- public homepage availability and the Request Access path;
- the `/get-started` controlled onboarding route;
- the client sign-in surface;
- the eligibility status/authentication gate;
- baseline public security headers on the root response.

The verifier emits machine-readable JSON containing the target origin, observed commit SHA when supplied by the environment, per-route results, and the final pass/fail result. It uses only Node.js platform APIs and therefore does not require Chromium, Docker, GitHub runners, or another paid CI service.

## GitHub Actions posture

Keep the following workflows in the repository:

- Build Verification;
- CodeQL Analysis;
- Copilot Setup Steps;
- Browser E2E;
- Copilot Patch Validate and Publish.

When GitHub-hosted Actions can allocate runners, these checks resume as additive defense-in-depth gates. Until then, a run that terminates before allocating any workflow step is recorded as `INFRA_BLOCKED` and must not be described as a lint, test, CodeQL, Playwright, Prisma, or build failure.

An actual workflow step failure remains a release failure and must be corrected before merge.

## Avoiding secondary barriers

- Keep one authoritative GEM Vercel project for release evidence; do not treat duplicate linked Vercel projects as release authorities.
- Do not create no-op commits solely to force builds.
- Do not install Playwright browsers inside the Vercel build path. Browser E2E remains available for normal CI, while the dependency-free deployment smoke gate covers the provider-independent fallback.
- Do not introduce Kubernetes/ARC, paid Docker runners, or another hosted CI subscription solely to work around an account billing restriction.
- Do not enable automatic database push/seed during validation unless a separately approved migration/bootstrap procedure requires it.
- A Vercel build that does not correspond to the exact candidate SHA is not acceptable release evidence.

## Minimum merge evidence during `INFRA_BLOCKED`

A candidate can be considered technically release-ready only when all of the following are recorded:

- exact candidate SHA;
- authoritative Vercel deployment ID;
- Vercel state `READY`;
- preview verification/build success for that exact SHA;
- deployment smoke result `PASS`;
- no release-window fatal/error signal attributable to the candidate;
- unresolved security review findings: none;
- GitHub Actions state explicitly documented as `INFRA_BLOCKED` if runners still cannot start.

Human merge authorization remains separate from technical readiness.
