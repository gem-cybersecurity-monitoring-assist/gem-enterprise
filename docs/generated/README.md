# GEM inventory generator

Run from the root of a local checkout of `support371/gem-enterprise`:

```powershell
node scripts/generate-gem-route-inventory.mjs
```

This is a local, read-only reconnaissance tool. It makes no network calls, does not deploy, does not call provider APIs, does not execute API write endpoints, and does not mutate databases. It skips `.env` and `.env.local`; it reads only variable names from `.env.example`, never values.

Outputs:
- `docs/generated/GEM_ROUTE_INVENTORY.local.json`: page and route-handler files plus metadata.
- `docs/generated/GEM_ROUTE_INVENTORY.local.csv`: spreadsheet-friendly route rows.
- `docs/generated/GEM_EXTERNAL_ORIGINS.local.csv`: external origins found in source/docs with evidence files and sample contexts.
- `docs/generated/GEM_REDIRECT_REWRITE_CRON.local.json`: redirects/rewrites detected in Next config and cron entries from Vercel config.
- `docs/generated/GEM_PROXY_ROUTING.local.csv`: proxy public/protected prefixes, role gates, bypasses, ATR host rewrites and identity-header rules derived from `src/proxy.ts`.

Limitations:
- URL extraction is a discovery aid; it can include documentation links, examples, and obsolete endpoints. Every origin needs classification.
- Redirect/rewrite parsing is conservative and is not a full JavaScript parser.
- Proxy records are source-derived rule descriptions, not runtime proof. The `/api/*` bypass means each handler still needs its own authorization test; dotted-path bypass behavior should be explicitly covered by the route security audit.
- Dynamic routes are templates, not every possible URL.
- Source file existence does not prove a working route, provider connection, safe authorization, or production deployment.
- Output marks behavior and deployment as unverified. Change those fields only with test evidence tied to an exact commit and URL.
- This script scans only the current checkout, not all GitHub repositories. Related repositories require owner classification before linking or merging.
