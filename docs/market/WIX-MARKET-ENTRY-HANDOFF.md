# Wix market-entry handoff — GEM Enterprise

## Purpose and ownership

- Public acquisition property: **Gem Assist 1**, `https://firmgem.wixsite.com/gem-assist-1` (Wix site ID `fcfea988-421b-4278-b5e5-dfbb7ee1532d`).
- Primary commercial authority: GEM Enterprise at `https://www.gemcybersecurityassist.com`.
- Wix provides discovery, brand education, basic consultations, and an optional low-sensitivity inquiry path. **It must not grant entitlements, approve scope, accept sensitive incident evidence, or act as the canonical lead/CRM record.**
- The user already has a separate cybersecurity Wix site. Do not modify its pages when updating Gem Assist 1.

## Canonical tracked conversion URL

`https://www.gemcybersecurityassist.com/business-review?lead=referral&campaign=founding-first-20&utm_source=wix-gem-assist-1&utm_medium=organic&utm_campaign=founding-first-20`

This is constructed by `buildWixMarketEntryReviewUrl` using the existing `buildBusinessReviewCampaignUrl` helper; the `wix-gem-assist-1` source and existing `organic` medium are explicit approved values in `utmContract`.

The destination is the existing bounded **$199 founding GEM Business Security & Operations Review**. All booking fees shown separately by Wix continue to be whatever the existing Wix Bookings listing says. **Do not assume Wix consultation payments and the founding GEM review are the same product.** Do not generate a payment or entitlement on click.

The published Wix Blog article **GEM Enterprise Security Readiness: First Steps for Business Owners** already includes a real button to the $199 Business Review and a second button to the free readiness checklist. The published Business Review link uses this exact attribution contract; preserve it rather than adding a separate campaign identity. The checklist link uses the same `utm_source` and `utm_campaign` with `utm_medium=organic`.

## Website conversion placement

Place the tracked canonical conversion link in the Wix homepage primary action, Services/Review section, selected blog article, and Contact/Review secondary action after visual editor access is available. Use clear CTA wording: **Request a GEM Business Security & Operations Review**. The page should communicate that submitting a request is not approval, activation, or a charge.

Optional general inquiry without GEM application: `https://firmgem.wixforms.com/f/7515843603776668706`. This Wix Forms record is **not synchronized to the GEM intake queue**. A direct customer who needs the governed commercial onboarding flow should use the canonical GEM Business Review link, not the standalone general form.

## Design parity

Use the current main-platform token contract in `src/app/globals.css`: charcoal base, off-white foreground, electric cyan emphasis, night plum supporting accent, Inter typography, rounded cards, WCAG-conscious contrast and semantic heading hierarchy. Prefer the verified existing GEM brand logo. Avoid certification, penetration test, guaranteed protection, or 24/7 monitoring claims unless those capabilities and relevant service scope are verified.

The current Wix classic-editor layout cannot be changed through the connected public Wix REST API. This change adds **attribution contract and operational integration guidance**, not a deployed Wix visual redesign.

## Marketing tools: reuse before adding

- GEM: governed public Business Review landing, enterprise intake, opportunities/proposals, Social Media Studio, content approvals and consent-gated email campaigns.
- Metricool: linked account with a GEM website entry and Facebook, Instagram, TikTok, YouTube and Google Business Profile references. Independently validate authorization and publishing rights by provider before posting.
- Wix: business marketing and email/social apps can exist without activated campaigns or authenticated social publisher accounts; read account readiness before use.
- Do not send marketing emails, schedule/post social media, or activate paid ad spending without the relevant consent, authorization and content approval. Do not install paid services.

## Acceptance gates

1. Verify the tracked CTA resolves to GEM's actual Business Review application and preserves source, medium, campaign and the privacy/consent UI.
2. Test a true Wix-to-GEM submission with consent using approved test data; verify GEM intake attribution, not just Wix Forms submission.
3. Review legal/privacy links, booking price distinctions and visitor routing.
4. Complete Wix Editor visual changes and rerun its accessibility scan before treating the Wix site as production redesigned. The confirmed baseline scan `1eab0625-6908-4140-93de-27faeb79d2df`, completed 2026-10-13 at 23:12 UTC, processed all 20 pages with no failed pages and found 15 serious issues across 10 pages (6 alternative-text, 4 contrast, 5 heading-structure). This supersedes the older 40-findings/31-pages figure; it is not evidence that the draft redesign passes.
5. Reconcile individual provider authorizations and check the existing GEM Social Media Studio release gates before distribution.
6. Never auto-merge or deploy this integration solely because a GitHub pull request exists.
