# Channel Readiness — Commerce (PREP ONLY)

No store is built here. No product syncing, no orders, no webhooks, no fake
catalog entries. This document fixes the truth table every future channel
connector must satisfy, per the contract in
`src/lib/commerce/connector-contract.ts`.

## Canonical-catalog principle

GEM keeps **ONE canonical catalog**. Today that is the TypeScript data in:

- `src/lib/storeCatalog.ts` — `StoreProduct` / `CommerceChannel` types and the
  `storeProducts` array (GEM service offerings: monitoring, assessments,
  compliance, consultations; `purchaseMode` is `checkout` | `quote` | `booking`).
- `src/lib/storefrontCatalog.ts` — storefront definitions and products.
- `src/app/api/store/catalog/route.ts` — serves the merged catalog as JSON
  (brand, storefronts, product counts).
- `src/app/api/tokmetric/shop/catalog/route.ts` — TikTok shop catalog endpoint.

Each channel gets a **projection** of that canonical catalog
(`ChannelProductProjection` in the contract): the connector translates the
canonical product into the channel's schema and eligibility rules. Connectors
never fork the catalog.

## Truth table

Every channel is `NOT_CONFIGURED` today. "Eligibility" is a plausibility
assessment only — GEM's catalog is services (consulting, assessments,
monitoring), and most goods-oriented channels do not sell services.

| Channel | Requires (all HUMAN_REQUIRED) | GEM product eligibility | Status |
|---|---|---|---|
| TikTok Shop | TikTok Shop seller account; Partner Center approval; app key/secret + access token (OAuth); region support | Low — TikTok Shop sells physical goods; GEM service products are generally not listable. Planning-only reference exists in `tiktokPlanningCatalog`. | NOT_CONFIGURED |
| Google Merchant Center | Google account; Merchant Center account; product feed or Content API credentials; website verification; tax/shipping config | Medium — services can appear via Local Services / structured listings, not standard Shopping product feeds. | NOT_CONFIGURED |
| Shopify | Shopify store (owner-created); Admin API custom app or OAuth app; API key/secret + access token; webhook secrets | High — Shopify sells services/digital products well via product + booking/quote flows. | NOT_CONFIGURED |
| Meta commerce (Facebook/Instagram Shops) | Meta Business Manager; Commerce Manager account; catalog; domain verification; checkout or website-link setup | Medium — service listings possible; checkout approval is goods-oriented. | NOT_CONFIGURED |
| Amazon | Amazon Seller Central account (Professional); marketplace approval; SP-API app authorization (OAuth); tax identity | Low — Amazon is goods-first; professional services exist only via Amazon Home Services (US, invite/category approval). | NOT_CONFIGURED |
| eBay | eBay seller account; developer program app (client id/secret); OAuth consent; store subscription for volume | Low — goods marketplace; services heavily restricted. | NOT_CONFIGURED |
| Etsy | Etsy seller account; API key + OAuth token | Very low — handmade/vintage/digital goods only; GEM services not eligible. | NOT_CONFIGURED |
| WooCommerce | Owner-hosted WordPress + WooCommerce; REST API keys (consumer key/secret); webhook secrets | High — self-hosted, sells services and bookings natively; owner controls the stack. | NOT_CONFIGURED |

## What remains before any channel goes live

1. HUMAN_REQUIRED: owner creates/approves each channel account and completes
   the channel's seller/merchant approval.
2. HUMAN_REQUIRED: owner supplies API credentials; all secrets server-side only,
   never in the browser or repo.
3. Implement the `StoreConnector` for the channel (all 13 operations), with
   unimplemented operations failing closed via `notConfiguredStoreConnector`.
4. Map canonical service products to channel projections, including honest
   `ChannelEligibility` with rejection reasons where services are not sellable.
5. Webhook signature verification and order reconciliation design, per channel.

Until then: every channel reports `NOT_CONFIGURED` from `readChannelStatus`.
