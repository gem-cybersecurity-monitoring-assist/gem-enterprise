# Metricool Integration — Honest Status

Status: **documented interface only; nothing wired**. Metricool is not a social
scheduling provider in GEM Enterprise today.

## What Metricool is today

`public/metricool-init.js` is a **website visitor-analytics tracker snippet**.
It injects the Metricool tracker and identifies this site to Metricool:

- Tracker script: `https://tracker.metricool.com/resources/be.js`
- Site hash: `3d19f1c1f08799a08dca4eaa5a85e91`
- It runs `window.beTracker.t({ hash: "3d19f1c1f08799a08dca4eaa5a85e91" })`
  after load.

That is all it does: page-view/visitor telemetry. It is deployed on the site
and unrelated to the social publishing queue.

## What Metricool is NOT

- It is **not wired** to the social publishing worker or any provider adapter.
- It does **not** schedule, autopost, or read social content today.
- No Metricool API token exists in the codebase, and no autoposting/metrics
  endpoint is called anywhere in this repository.

## Defined integration point (future, HUMAN_REQUIRED)

If the owner later wants Metricool's API (autoposting, analytics) wired in, the
integration point is defined as follows. Nothing below is implemented.

**Proposed adapter surface** (would live under
`src/lib/social-media/providers/metricool/` and implement
`SocialPublishingAdapter`):

- `publish(input)` → Metricool autoposting endpoint for the connected brand,
  returning the Metricool post identifier.
- Idempotency via `job.idempotencyKey` (same pre-check pattern as Telegram).
- Metrics read path (separate, read-only): pull post performance for the
  analytics lane (WS-C owns analytics; coordinate before building).

**Config keys (all HUMAN_REQUIRED, owner-supplied):**

| Key | Purpose |
|---|---|
| `METRICOOL_API_TOKEN` | Metricool API token (premium plan required) — server-side secret only |
| `metricoolBrandId` | Connector safe metadata: the Metricool brand/account to post as |

**Blockers before any build:**

1. HUMAN_REQUIRED: owner supplies a Metricool API token and confirms the plan
   includes API access (autoposting is a premium feature).
2. HUMAN_REQUIRED: owner connects the social accounts inside Metricool.
3. Confirm the Metricool API contract against Metricool's current docs —
   do not guess endpoints.

Until those are met, this file must not be read as claiming Metricool
publishing capability.
