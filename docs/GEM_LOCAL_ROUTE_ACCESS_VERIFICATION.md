# GEM Local Route-Access Verification — Anonymous Boundary Pass

**Source:** `support371/gem-enterprise`, branch `docs/gem-complete-route-inventory-20261015` at `2bf8d8b1e9029afe6ac1a0ab95529c0224458493`. Fixes were verified on local branch `fix/gem-route-runtime-access` (`f2291ad`, `43f7514`).
**Date:** 2026-10-17.
**Method:** `pnpm run build`, then `next start` on 127.0.0.1 inside a network namespace that had only loopback. There was no outbound network, no database, placeholder secrets only, and GET requests only with no cookies. The probe is `scripts/verify-local-route-access.mjs`.
**Scope:** anonymous visitors only. Authenticated, role, tenant and object-isolation behavior is **not** covered (runbook Gate B still open).

## Findings

| # | Finding | Evidence | Status |
|---|---|---|---|
| 1 | `next start` answered nearly every request with HTTP 500. | Server log: `You cannot use different slug names for the same dynamic path ('id' !== 'provider')`. The cause was sibling folders `src/app/api/social-media/connectors/[id]` and `[provider]` (added in #416). `next build` passes, so CI never caught it. Probe before the fix: 253/258 pages returned 500. | Fixed in `f2291ad`: the pause handler moved to `[id]/pause`, so URLs are unchanged, and a regression test was added. `main` at `1c07a42` does not contain these folders. Whether the Vercel deployment of this lineage is affected was **not verified**. |
| 2 | Dotted paths skipped the proxy's session gate on protected routes. | `isStaticOrApiPath()` treats any `.` as a static asset. Anonymous `GET /app/portfolios/verify.sample` returned 200 with the full portfolio page (hardcoded sample holdings; no user data). `/app/command-center/x.y`, `/app/admin/api/x.y` and `/app/workspace/projects/x.y` returned 200 but rendered their own 404/redirect, leaking only a slug-echoing `<title>`. | Fixed in `43f7514`: the static shortcut now applies only outside protected prefixes. Proxy behavior tests were added. After the fix: 258/258 page probes pass. |
| 3 | 82 of 102 protected pages have no server-side guard of their own. | Static source scan. These pages rely only on `src/proxy.ts`. | Acceptable once finding 2 is fixed; keep proxy tests in place. |
| 4 | Identity headers are not stripped on `/api/*` and public routes. | Only `src/app/access/continue/page.tsx` reads `x-user-*`, and it sits under a protected prefix where the proxy overwrites them. `layout.tsx` reads `x-is-portal`/`x-is-protected` for chrome only. | No current exploit path; any new reader of these headers must sit under a protected prefix. |
| 5 | Anonymous configuration-posture disclosure. | `/api/system/bootstrap-status` and `/api/auth/recovery-readiness` return auth source, readiness booleans and missing SMTP variable names (no values). | bootstrap-status restricted locally; recovery-readiness needs an owner decision. See `docs/GEM_SECURITY_VERIFICATION_20261017.md`. |

## API results (anonymous GET, after fixes)

| Result | Count | Notes |
|---|---|---|
| 401/403 (denies anonymous) | 94 | |
| 2xx/3xx served anonymously | 26 | Health, OpenAPI, agent/public context, catalogs, sitemap/robots, newsletter/referral redirects, status/readiness diagnostics. Review list in finding 5. |
| 503 fail-closed | 20 | Unconfigured in the sandbox (no DB/secrets). **Auth on these is unverified** and needs a configured non-production environment. |
| 400/404 for sample input | 7 | Expected for placeholder ids. |
| No GET export (not probed) | 77 | POST/PUT/DELETE handlers need authenticated tests. |

## Re-run

```bash
node scripts/generate-gem-route-inventory.mjs
# start the built app on loopback with non-production configuration, then:
node scripts/verify-local-route-access.mjs --base http://127.0.0.1:3000             # pages only
node scripts/verify-local-route-access.mjs --base http://127.0.0.1:3000 --include-api # disposable server only
```

The probe exits 1 when a protected page is served anonymously. Output is `docs/generated/GEM_ROUTE_ACCESS.local.csv` (gitignored).

## Not yet verified

- Authenticated and per-role access, tenant and object isolation, and all non-GET handlers.
- The 20 fail-closed endpoints under real configuration.
- Navigation anchor IDs in the rendered DOM.
- Any preview or production deployment.
