# GEM Ads Bridge

## Purpose

The GEM Ads Bridge preserves an approved advertising package when paid delivery
is unavailable. It validates copy, destination, creative reference, market,
status, and zero-spend controls, then produces two bounded handoffs:

1. an Ads Manager preview-only manifest; and
2. an organic social package that remains subject to the existing compliance,
   approval, connector, and publishing gates.

The bridge does not bypass provider billing, minimum budget, identity review,
account policy, or authorization requirements.

## Current campaign

- Advertiser: GEM Enterprise
- Offer: GEM Business Security & Operations Review
- Headline: `Know What to Fix First`
- Body: `Qualified teams: $199 review and 30-day plan.`
- Destination: `https://www.gemcybersecurityassist.com/business-review`
- Market: United States
- Paid status: paused, preview-only
- Budget: USD 0

## Routes

- `GET /api/admin/ads-bridge` returns the canonical package and readiness state.
- `POST /api/admin/ads-bridge` validates a supplied package against the strict
  zero-spend contract.
- `/app/admin/ads-bridge` shows the campaign package and provider boundary.
- `POST /api/v1/ads-bridge` exposes the same bounded service to an authorized
  machine client using `ADS_BRIDGE_AUTH_TOKEN`.

All routes are admin-only. The API does not store credentials, call an external
advertising provider, publish content, configure billing, or create a paid
campaign.

## Machine connection

`openapi/gem-ads-bridge.openapi.yaml` is the connection contract for a custom
GPT or another approved API client. Configure a random bearer token of at least
32 characters in the deployment secret store as `ADS_BRIDGE_AUTH_TOKEN`, then
configure the same value in the client connection. The token is never stored in
the repository.

The machine route supports `get_default` and `validate`. Both are read-only
planning operations. Neither operation can call Ads Manager, publish an organic
post, activate billing, or spend money.

## Fail-closed rules

The service rejects:

- any status other than `PAUSED`;
- any budget other than `0`;
- billing configuration;
- provider-write requests;
- billing-bypass requests;
- non-GEM destinations;
- provider-owned tracking parameters in the destination; and
- unapproved organic destinations.

Paid delivery remains `BLOCKED` until the provider's billing, positive budget,
and activation requirements are completed separately by the owner.
