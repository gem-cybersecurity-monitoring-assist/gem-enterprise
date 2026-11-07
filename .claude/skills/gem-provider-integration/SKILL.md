---
name: gem-provider-integration
description: Add or extend a third-party provider integration in GEM Enterprise (social networks, TikTok/TokMetric, payments, email, AI, logistics, identity, any external API), including providers whose accounts, keys or approvals do not exist yet. Use when a request involves OAuth, API keys, webhooks or an external service.
---

# Add a provider integration

Build the integration completely even when the account, keys or provider approval do not exist yet. It ships fail-closed and becomes live when the owner adds configuration.

## Pattern used across the repository

Follow an existing integration before inventing a new shape:

| Kind | Reference implementation |
|---|---|
| OAuth with PKCE, encrypted tokens | `src/lib/social-media/oauth/config.ts`, `src/app/api/social-media/oauth/[provider]/` |
| Provider with app review and sandbox | `src/lib/tokmetric/` |
| Email | `src/lib/mail/` |
| AI generation | `src/lib/orchestration/` |

## Steps

1. **Config module**: read every value from `process.env`, trimmed. Expose `enabled` (flag `=== "true"`), a `missing[]` list, and a validate function. Never hard-code keys.
2. **Fail closed**: when disabled or misconfigured, routes return 503 with a stable code such as `<PROVIDER>_NOT_CONFIGURED`. Never fake a success or a connected state.
3. **Secrets**: tokens are stored encrypted (follow `SOCIAL_TOKEN_ENCRYPTION_KEY` usage). Never log tokens, never return them to the browser, never commit values.
4. **Readiness**: add the provider to the relevant readiness route so admins see exactly which variables are missing. Anonymous callers get minimal fields only.
5. **Webhooks**: verify signatures, and reject replays with idempotency keys.
6. **Tests**: mock `fetch` and the provider; cover disabled, misconfigured, success and provider-error paths.
7. **Docs**: add variable names (empty) to `.env.example` and a row to `docs/social-media/PROVIDER_ACTIVATION_CHECKLIST.md` or the matching activation doc: console URL, redirect URL on `https://www.gemcybersecurityassist.com`, variables, approval needed.

## Owner activation (not agent work)

Creating the provider account, entering keys in Vercel, passing app review, paying for an API tier, and turning on live publishing or payments. The pull request lists these steps.
