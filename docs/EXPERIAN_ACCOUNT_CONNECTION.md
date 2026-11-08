# Experian Account Connection

## What is built

Financial Shield now has a fail-closed Experian connector with:

- server-only Experian credentials;
- the documented Developer Portal password-grant token request;
- an optional authorization-code + PKCE flow that remains unavailable until Experian approves and supplies that consumer-delegation contract;
- encrypted token storage using AES-256-GCM;
- signed, short-lived, single-use callback state;
- workspace authorization, connector permission, emergency-lock, origin, and audit controls;
- an Experian-hosted read/identity request that must pass before the state becomes `CONNECTED`;
- read re-verification, token rotation, provider revocation when available, and local disconnect;
- storage of safe metadata only. Credit reports, scores, identity responses, and other response payloads are never persisted.

The Financial Shield surface is `/app/products/financial/credit-readiness`.

## Important account boundary

An Experian Developer Portal account authorizes an API application. It does not automatically grant the application access to the developer's personal Experian membership, credit file, dispute center, or other consumer-account features.

Personal consumer data requires an Experian product whose contract includes consumer permission and the exact API operations needed. The application intentionally has no generic write endpoint: a product name, provider-approved scope, request schema, consent language, and audit/rollback behavior are required before any write action can be implemented.

## Sandbox activation

1. In the Experian Developer Portal, create an app and select the approved product.
2. Obtain the Client ID and Client Secret for that app.
3. Confirm the exact product endpoint that can safely act as the connection's identity/read test. It must return a stable account identifier either in the response path configured by `EXPERIAN_IDENTITY_ID_PATH` or in the access-token subject.
4. Provision `20260925150000_experian_account_connection` in the target database using the repository's controlled migration workflow.
5. Add the server-only values documented in `.env.example` to the Vercel Preview environment. Do not prefix any secret with `NEXT_PUBLIC_` and do not send secret values through chat, tickets, or source control.
6. Set `EXPERIAN_CONNECTION_ENABLED=true` only after every required value is present.
7. Open the Preview Financial Shield page, choose the workspace, connect, and confirm the status reads `Connected + read verified`.
8. Run **Verify read access** once more and confirm a successful audit event.

For the documented Developer Portal flow, use:

```text
EXPERIAN_AUTH_MODE=DEVELOPER_PASSWORD
EXPERIAN_TOKEN_URL=https://sandbox-us-api.experian.com/oauth2/v1/token
```

The developer username and password are deployment secrets. They are never entered in the GEM browser UI.

## Consumer-delegation activation

Use this only if Experian explicitly approves a hosted authorization-code flow for the selected product. Do not infer its endpoint or scopes from the general Developer Portal token documentation.

Register this production callback:

```text
https://gemcybersecurityassist.com/api/integrations/experian/callback
```

Then configure the exact Experian-issued authorization URL, token URL, scopes, redirect URI, and token-client authentication method (`BODY` or `BASIC`), and set:

```text
EXPERIAN_AUTH_MODE=AUTHORIZATION_CODE
EXPERIAN_CONSUMER_DELEGATION_APPROVED=true
```

The connector uses PKCE, validates a signed state value, consumes the authorization attempt once, requires the initiating authenticated session, exchanges the code server-side, runs the read/identity test, and only then persists `CONNECTED`.

## Production gate

Experian documents sandbox as generally self-service, while UAT and production access require a subscription/manual verification. Production activation therefore requires:

- the approved product and commercial agreement;
- UAT/production credentials and endpoints supplied by Experian;
- product-specific privacy, permissible-purpose, consent, retention, and deletion review;
- successful Preview and UAT read verification;
- owner-approved database migration and Vercel environment changes.

## Rollback

First use the UI **Disconnect** action for every connected workspace so GEM deletes encrypted credentials and calls the configured Experian revocation endpoint when one exists. Then disable `EXPERIAN_CONNECTION_ENABLED`.

If the feature must be removed from the database, after confirming there are no required records, run the controlled rollback in this order:

```sql
DROP TABLE IF EXISTS "experian_authorization_attempts";
DROP TABLE IF EXISTS "experian_connection_credentials";
DROP TABLE IF EXISTS "experian_connections";
```

Remove the Experian server secrets from Vercel and revoke/rotate the application credentials in Experian.

## Official references

- [Experian Quick Start Guide](https://developer.experian.com/tutorials/quick-start-guide)
- [Experian OAuth 2.0 Tutorial](https://developer.experian.com/tutorials/oauth-20-tutorial)
- [Experian Connect API](https://www.experian.com/connect/api/)
- [Experian Developer FAQs](https://developer.experian.com/faqs)
