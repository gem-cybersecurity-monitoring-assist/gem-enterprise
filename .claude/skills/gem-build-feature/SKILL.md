---
name: gem-build-feature
description: Build any feature, page, API route, integration or business line the owner requests for GEM Enterprise, including features for services, providers or products that are not live yet. Use for every new build or extension request in this repository, before deciding that a request cannot be built.
---

# Build a GEM Enterprise feature

## Build first, activate later

GEM separates **building** a capability from **activating** it.

- **Building** means code, UI, API routes, tests, docs and a pull request. Any owner-approved request can be built, including one for a provider, product or business line that is planned, unpaid, unapproved by the provider, or not yet real. "The service is not live yet" is never a reason to refuse or shrink a build.
- **Activating** means turning it on for real users or real money: production credentials, paid plans, provider approval, live publishing, payments, regulated data, production database changes, public claims. Activation stays with the owner.

So when a request depends on something that does not exist yet, build the whole feature and ship it **disabled or labelled**, never refuse it.

## How to ship a not-yet-live capability

1. Gate it with an environment flag that defaults to off (pattern: `<AREA>_<CAPABILITY>_ENABLED`, read as `process.env.X === "true"`). Add the name, empty or `false`, to `.env.example`.
2. Missing configuration fails closed: return a clear 503 with a stable error code, not a crash and not fake success.
3. Show the real state in the UI with the shared readiness vocabulary in `src/lib/capabilityReadiness.ts`: `SURFACE_AVAILABLE`, `SETUP_REQUIRED`, `PROVIDER_NOT_CONFIGURED`, `AUTHORIZATION_REQUIRED` and so on. Never label sample or seeded data as live.
4. Mock the provider in tests, so the feature is fully tested before any account exists.
5. Public wording about it goes through `src/lib/publicClaims.ts` (`pnpm run claims:check`). Describe planned capability as planned.

## Where code goes

| Need | Location | Pattern |
|---|---|---|
| Page in client portal | `src/app/app/<name>/page.tsx` | Protected by `src/proxy.ts`; fetch from your API route |
| Admin page | `src/app/app/admin/<name>/page.tsx` | Server checks still required in the API |
| Public page | `src/app/<name>/page.tsx` | Must pass the claims check |
| API route | `src/app/api/<area>/<name>/route.ts` | Gate with `requireSession` / `requireAdmin` / `requireStaff` / `requirePlatformOwner` from `src/lib/api/auth-helpers.ts`; validate with Zod; `emitAuditLog` after sensitive mutations |
| Domain logic | `src/lib/<area>/` | Pure functions where possible, so they are unit-testable |
| Data model | `prisma/schema.prisma` | Use the `gem-database-change` skill |
| Third-party provider | `src/lib/<area>/` + env flags | Use the `gem-provider-integration` skill |
| Tests | `src/__tests__/<feature>.test.ts` | Vitest; mock `@/lib/db` and providers |

`CLAUDE.md` has the full application map and the API and page templates. Next.js here is 16.x with breaking changes: read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Procedure

1. Check `docs/agent-control/ACTIVE-WORK.md` for a lane that already owns the files; do not overlap it. Add your own lane entry for large work.
2. Branch from current `main`.
3. Build the smallest complete version: route, logic, UI, flags, readiness state, tests, `.env.example` names, short doc.
4. Run the checks in the `gem-verify-and-ship` skill.
5. Open a pull request using `.github/pull_request_template.md`. State plainly what is built, what is disabled, and which owner action activates it.

## What still needs the owner

Do the build, then list these as activation steps instead of doing them: production credentials or secrets, paid plans, provider accounts and app review, applying database migrations to production, enabling live publishing or payments, and public claims marked `block`. Asking for them is not a refusal; it is the hand-off.
