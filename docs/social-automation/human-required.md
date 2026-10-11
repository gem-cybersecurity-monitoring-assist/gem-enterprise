# Social Automation — Human-Required Actions

Everything below needs the repository owner (or an authorized operator) to act.
WS-F performed no live provider calls, no production deployment, and no merge to `main`.

## Provider app registrations & approvals

1. **TikTok** — Complete TikTok Login Kit app setup; add the production callback URL to the
   allow-list; obtain Content Posting API approval before any TikTok publishing.
   Code hooks: `src/lib/social-media/oauth/tiktok-adapter.ts`, `TIKTOK_SOCIAL_REDIRECT_URI`.
2. **Meta (Facebook Page / Instagram Professional)** — App review for the scopes in
   `META_SOCIAL_SCOPES` (publishing + metrics scopes as configured).
3. **X** — API tier that supports metrics read-back and media-capable auth for the
   two-phase media upload flow.
4. **YouTube** — OAuth consent with `youtube.upload` scope, quota allocation, first-upload
   certification (`isYoutubeUploadCertified` gates uploads until certified), and re-auth
   for `youtubeAnalytics.readonly` for metrics.
5. **LinkedIn** — Organization media permissions for the company page; decide the
   restricted-metrics partner question (metrics endpoints may need partner approval).
6. **Nextdoor** — Obtain the approved Publish API endpoint and approve it per workspace via
   `PUT /api/social-media/publishing/providers/nextdoor/config` (this PUT *is* the
   human approval that unblocks Nextdoor dispatch; the URL template stays server-side).
7. **Telegram** — Create the bot via @BotFather, make it an admin of the target channel,
   and record the channel chat ID for adapter configuration. See `docs/integrations/telegram.md`.
8. **Metricool** — API token + plan that permits the API (currently documented honestly as
   website-tracker only). See `docs/integrations/metricool.md`.

## Secrets & runtime configuration (owner sets in Vercel / secret store)

9. `CRON_SECRET` — Bearer secret for publishing worker and analytics sync routes.
10. `CONTENT_ORCHESTRATOR_CRON_SECRET` (falls back to `CRON_SECRET`) — Bearer secret for
    the daily orchestrator; plus `CONTENT_ORCHESTRATOR_WORKSPACE_ID` and
    `CONTENT_ORCHESTRATOR_ACTOR_ID` (service actor) — without all three the scheduled
    run returns 503 `CONTENT_ORCHESTRATOR_NOT_CONFIGURED` by design.
11. `SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED=true` — explicit enablement of live provider
    dispatch (defaults off; the readiness endpoint reports it).
12. `SOCIAL_AUTOPILOT_ENABLED` and `SOCIAL_AUTOPILOT_AUTO_APPROVAL_ENABLED` — explicit
    enablement decisions. Code truth: both are **opt-in** (default off unless set to
    `"true"` in `src/lib/social-media/autopilot/policy.ts`); the owner must set them
    deliberately, not leave them ambiguous.
13. Provider OAuth credentials (client IDs/secrets, redirect URIs) for each provider the
    workspace will connect.

## Content & data governance decisions

14. **Approved news sources** for autopilot signal ingestion — the orchestrator records
    signal provenance and falls back to GEM-approved evergreen themes when no fresh
    signals exist; the owner must approve the source list.
15. **Production migration execution** — apply `20260929120000_social_provider_tiktok_and_pause`
    and `20260929121500_social_metric_snapshots` via the owner-approved path before first use.

## Commerce prep (not active — contract only)

16. Store/marketplace accounts, approvals, and API credentials for TikTok Shop, Google
    Merchant Center, Shopify, Meta commerce, Amazon, eBay, Etsy, WooCommerce — only when
    the owner decides to activate the `StoreConnector` contract in
    `src/lib/commerce/connector-contract.ts`. See `docs/commerce/channel-readiness.md`.

## Platform access (optional)

17. **Zoho Catalyst console/API access for project 939258801** — optional future use only;
    **not required** for this implementation (see `architecture.md`).

## Deployment & merge

18. Review and **merge this PR** (`feat/social-automation-control-plane` → `main`) —
    WS-F was not authorized to merge. Vercel Git integration then owns production deployment.
