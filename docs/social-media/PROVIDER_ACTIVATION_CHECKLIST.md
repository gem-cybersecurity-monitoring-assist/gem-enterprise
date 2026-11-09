# Social and TikTok provider activation checklist

How to connect each social account to the enterprise site. Variable names come from `src/lib/social-media/oauth/config.ts`, `src/lib/tokmetric/oauth/config.ts` and `.env.example`.

**Status on 2026-10-20:** no social or TikTok connector exists in production (0 rows in `social_connectors` and `tokmetric_connectors`). Accounts connected on outside builder sites (ChatGPT Sites, Base44) are not connected here and must be connected again through the routes below.

## Rules for every provider

- Values go only in Vercel → project `support371-gem-enterprise` → Settings → Environment Variables (Production). Never in code, docs or chat.
- Register the redirect URL in the provider console **exactly** as set in Vercel. Use `https://www.gemcybersecurityassist.com/...`, because the apex domain redirects to `www`.
- `*_ENABLED` flags must be the string `true`; anything else counts as off.
- Publishing flags (`*_PUBLISHING_ENABLED`, `SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED`, `TOKMETRIC_LIVE_PUBLISHING_ENABLED`) stay `false` until the owner approves going live. Connecting an account does not publish anything.
- After changing variables, redeploy production so the new values load.

## Shared secrets (set once)

| Variable | Value |
|---|---|
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | New random 32-byte key (`openssl rand -base64 32`) |
| `SOCIAL_OAUTH_STATE_SECRET` | New random secret (`openssl rand -hex 32`) |
| `TOKMETRIC_TOKEN_ENCRYPTION_KEY` | New random 32-byte key, different from the social key |
| `SOCIAL_GATEWAY_ADAPTER_SECRET` | New random secret (`openssl rand -hex 32`), same value in Vercel and Supabase — the machine secret the Next.js runtime sends to the `gem-social-publishing-gateway` edge function |
| `SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED` | `false` until the adapter is verified live (see below), then `true` in Vercel production only |

Losing an encryption key makes stored tokens unreadable, and every account must then be reconnected. Keep a copy in the company password manager.

## Gateway publishing adapter (social publishing worker on Supabase)

The publishing worker runs against the Supabase gateway only when the adapter is fully deployed and verified. The code ships flag-gated and off by default.

| Step | Detail |
|---|---|
| Target project | Live gateway project `slzdjoqpzbkwzuaexlkj` (NOT the repo-linked project in `supabase/config.toml`). Deploy with `--project-ref slzdjoqpzbkwzuaexlkj`. |
| Tables first | Confirm the `social_*` tables exist in that project (dashboard SQL editor). If any is missing, port the Prisma social migrations first — the RPC migration creates no tables. |
| RPCs | Apply `supabase/migrations/20261108050000_social_publishing_gateway_rpcs.sql` (12 phase-1 RPCs + the health RPC), then confirm with `select routine_name from information_schema.routines where routine_name like 'gem_social_%'`. |
| Edge function | `supabase functions deploy gem-social-publishing-gateway --project-ref slzdjoqpzbkwzuaexlkj`. |
| Machine secret | Set `SOCIAL_GATEWAY_ADAPTER_SECRET` in Supabase (`supabase secrets set ... --project-ref slzdjoqpzbkwzuaexlkj`) and in Vercel (production, sensitive type) — same value. |
| Flag | Set `SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED=true` in Vercel production ONLY after the live verification (health probe passes, claim/mark/idempotency checks) — then redeploy. Until then the cron gate stays 503 and readiness stays `BLOCKED_GATEWAY_BACKEND`. |

## Social OAuth and daily scheduling with gateway sign-in

The worker adapter can process queued jobs, but does not create OAuth attempts
or run the daily content planner by itself. To use the existing transactional
connector store and daily planner with gateway sign-in:

1. Configure the canonical Vercel project with a Prisma connection to the
   **same Supabase project** as `GEM_SUPABASE_GATEWAY_BASE_URL`. Use the
   provider-issued direct or pooler URL for the `postgres` database, with
   `sslmode=require&sslaccept=strict` and its trusted CA if needed.
2. Verify the existing connector, authorization-attempt, credential, workspace
   and queue tables and verify the worker gateway adapter above. Set
   `SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED=true` in the test environment.
   Leave the live publication flags off during connection and queue checks.
3. With an active account and explicit active workspace membership, open
   Accounts and authorize each destination. Verify the provider-returned
   identity and test credential health. Meta can return separate Page and
   Instagram Professional destinations from the same grant.
4. Verify daily planning and queue processing against the same workspace.
   A connected account alone does not release a post. Before live activation,
   confirm the exact destination and approved content, schedule, provider
   access, and workspace locks. Verify delivery by the provider post ID.

To stop the new gateway transaction path, turn the flag off and redeploy.
To stop outbound work, use the existing workspace emergency or provider pause
controls. This configuration does not change TokMetric's separate live gates.

## Per provider

Connect URL pattern (sign in as an admin first): `https://www.gemcybersecurityassist.com/api/social-media/oauth/<provider>/start`

| Provider | Developer console | Redirect URL to register | Variables | Platform approval |
|---|---|---|---|---|
| Meta (Facebook Page, Instagram) | developers.facebook.com → Create app (Business) | `https://www.gemcybersecurityassist.com/api/social-media/oauth/meta/callback` | `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`, `META_GRAPH_API_VERSION` (for example `v23.0`, required), `META_SOCIAL_OAUTH_ENABLED=true` | App Review for the scopes in `META_SOCIAL_SCOPES`, then `META_APP_REVIEW_APPROVED=true` |
| X | developer.x.com → Project → App → User authentication (OAuth 2.0, confidential client) | `https://www.gemcybersecurityassist.com/api/social-media/oauth/x/callback` | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_OAUTH_REDIRECT_URI`, `X_SOCIAL_OAUTH_ENABLED=true` | Paid API tier needed for posting |
| LinkedIn (Company Page) | linkedin.com/developers → Create app, linked to the company page | `https://www.gemcybersecurityassist.com/api/social-media/oauth/linkedin/callback` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_REDIRECT_URI`, `LINKEDIN_API_VERSION` (for example `202510`), `LINKEDIN_SOCIAL_OAUTH_ENABLED=true` | Community Management API access, then `LINKEDIN_COMMUNITY_MANAGEMENT_ACCESS_APPROVED=true` |
| YouTube | console.cloud.google.com → OAuth client (Web), YouTube Data API v3 enabled | `https://www.gemcybersecurityassist.com/api/social-media/oauth/youtube/callback` | `GOOGLE_SOCIAL_CLIENT_ID`, `GOOGLE_SOCIAL_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI`, `YOUTUBE_SOCIAL_OAUTH_ENABLED=true` | Google OAuth verification and API audit, then `YOUTUBE_DATA_API_AUDIT_APPROVED=true` |
| Nextdoor (Business) | Nextdoor partner / developer programme | `https://www.gemcybersecurityassist.com/api/social-media/oauth/nextdoor/callback` | `NEXTDOOR_CLIENT_ID`, `NEXTDOOR_CLIENT_SECRET`, `NEXTDOOR_OAUTH_REDIRECT_URI`, `NEXTDOOR_OAUTH_ENABLED=true` | Publish API access, then `NEXTDOOR_PUBLISH_API_ACCESS_APPROVED=true` |

## TikTok (TokMetric only)

TikTok connects only through TokMetric. See `docs/tokmetric/activation-runbook.md` for sandbox and production details.

| Step | Detail |
|---|---|
| Console | developers.tiktok.com → app with Login Kit and Content Posting API |
| Redirect URL | `https://www.gemcybersecurityassist.com/api/tokmetric/oauth/callback` |
| Variables | `TOKMETRIC_TIKTOK_CLIENT_KEY`, `TOKMETRIC_TIKTOK_CLIENT_SECRET`, `TOKMETRIC_TIKTOK_OAUTH_REDIRECT_URL`, `TOKMETRIC_TIKTOK_OAUTH_ENABLED=true`, `TIKTOK_ENVIRONMENT=sandbox` until app review passes |
| Connect | `https://www.gemcybersecurityassist.com/api/tokmetric/oauth/start`, then check `/tokmetric/accounts` |
| TikTok Shop (optional) | Partner Center app credentials and approval; set `TIKTOK_SHOP_REDIRECT_URI=https://www.gemcybersecurityassist.com/api/tokmetric/shop/oauth/callback`; connect at `https://www.gemcybersecurityassist.com/api/tokmetric/shop/oauth/start` |

## Verify after each connection

1. Open `/app/social-media/accounts` (or `/tokmetric/accounts` for TikTok) and confirm the account shows as connected.
2. Open `/api/social-media/readiness` or `/api/tokmetric/readiness` while signed in as an admin; the provider should report no missing configuration.
3. Record the result in `docs/GEM_EXECUTION_RECORD.md`.

## Revoke access granted to outside builder sites

Remove any app access granted to the old ChatGPT-hosted site or Base44 apps:

| Platform | Where |
|---|---|
| Meta | Facebook Settings → Business Integrations; Instagram → Apps and websites |
| X | Settings → Security and account access → Apps and sessions → Connected apps |
| LinkedIn | Settings → Data privacy → Permitted services |
| Google / YouTube | https://myaccount.google.com/permissions |
| TikTok | Settings → Security → Manage app permissions |
| Nextdoor | Settings → Connected apps |
