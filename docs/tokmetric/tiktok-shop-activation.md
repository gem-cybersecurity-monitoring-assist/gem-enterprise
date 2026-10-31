# TikTok Shop Seller activation

TikTok Shop Seller authorization is provided by TikTok Shop Partner Center. It is separate from the TikTok for Developers app used by Login Kit and Content Posting API.

## Provider setup

1. Sign in to TikTok Shop Partner Center with the shop's main seller account.
2. Choose the correct Partner Center developer type before creating the app: use a seller-developer custom app only when GEM is connecting its own shop; use the eCommerce system-integrator/SaaS path if GEM will authorize shops belonging to other businesses. Create the corresponding Shop application/service.
3. Request the minimum read scopes required for initial activation:
   - seller authorization/shop information
   - seller product basic/read
4. Set the redirect URL exactly to:

   `https://www.gemcybersecurityassist.com/api/tokmetric/shop/oauth/callback`

5. Complete TikTok Shop testing/review and record the approved service ID, app key, and app secret.

## Production configuration

Set the following only in the approved Vercel secret store for Production. Never put values in Git, screenshots, support messages, or review text.

```text
TIKTOK_SHOP_OAUTH_ENABLED=true
TIKTOK_SHOP_API_ACCESS_APPROVED=true
TIKTOK_SHOP_ENVIRONMENT=production
TIKTOK_SHOP_REGION=US
TIKTOK_SHOP_APP_KEY=<Partner Center app key>
TIKTOK_SHOP_APP_SECRET=<Partner Center app secret>
TIKTOK_SHOP_SERVICE_ID=<Partner Center service ID>
TIKTOK_SHOP_REDIRECT_URI=https://gemcybersecurityassist.com/api/tokmetric/shop/oauth/callback
```

Keep the global workspace `shopWriteDisabled` control enabled during connection and read-sync verification.

## Owner authorization

Open `/tokmetric/accounts`, select the correct workspace, and choose **Connect Shop**. The main seller account must approve the requested access on TikTok Shop. Then choose **Sync products** to read the authorized shops and approved catalog.

This implementation performs no product, inventory, price, order, fulfillment, or advertising writes. Product creation and approval remain inside TikTok Shop Seller Center.
