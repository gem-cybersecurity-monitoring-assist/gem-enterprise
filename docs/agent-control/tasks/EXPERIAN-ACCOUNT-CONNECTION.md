# Experian Account Connection

## Objective

Add a production-safe Experian connector to Financial Shield. The connector must support Experian's documented developer-service authentication and a provider-approved consumer authorization-code flow when Experian supplies that product contract.

## Scope

- `src/lib/experian/**`
- `src/app/api/integrations/experian/**`
- `src/components/financial/ExperianConnectionPanel.tsx`
- `src/app/app/products/financial/credit-readiness/**`
- a Financial Shield entry point to the new surface
- additive Experian authorization-store migration
- Experian environment contract, activation runbook, and focused tests

## Safety invariants

- The application never asks for or stores Experian credentials in browser state, chat, source control, logs, or audit metadata.
- Developer Portal credentials are server-only deployment secrets.
- "Connected" is recorded only after token issuance and a configured Experian read/identity endpoint both succeed.
- Consumer authorization uses a short-lived, signed, one-use state value and PKCE.
- Experian endpoints must use HTTPS on an `experian.com` host.
- Response bodies from the identity/read verification request are never persisted; only a keyed opaque identity reference, fixed non-sensitive display label, capability metadata, and a keyed response digest are stored.
- No consumer credit data, report contents, scores, or other sensitive payloads are written to the connector tables or audit log.
- No generic write operation is exposed. Write capability is reported only when an exact provider-approved product contract and scope are configured.
- The repository default remains disabled and fail closed.

## Activation gates

- Create an Experian Developer Portal application and select the approved API product.
- Obtain the exact sandbox/production authentication and identity/read endpoints from Experian.
- For consumer delegation, obtain the hosted authorization endpoint, callback approval, scopes, and token exchange contract from Experian.
- Provision the database migration and server-only Vercel environment values.
- Enable the connector only after the sandbox read test passes.
- UAT/production access requires Experian subscription/manual approval; code completion does not imply that approval.

## Validation evidence

- focused Experian unit tests
- lint and typecheck
- repository verification/build where executable
- pull request and preview evidence bound to the exact head commit
