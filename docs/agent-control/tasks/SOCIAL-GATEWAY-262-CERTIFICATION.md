# Original Supabase owner-only gateway certification — #262

This is a **read-only, fail-closed diagnostic**. It does not activate publishing,
modify database records, issue credentials, submit OAuth approvals, or call any
provider. It is intentionally independent of the public Vercel `/api/health`
route, whose `gateway_ok` result is **not** authenticated social RPC evidence.

## Target and safety

- Original production Supabase: `slzdjoqpzbkwzuaexlkj` **only**.
- Reject `dusqdnebwkoycdtjkhyy` (isolated development) and the unrelated ref
  currently in `supabase/config.toml`, `zplnwkgxkovepqplhohx`.
- Never infer the production target from the local Supabase CLI link/config.
- Never print, copy to an issue, or store the anonymous key or adapter secret
  in source, PR text, CI logs, screenshots, or browser-visible UI.
- Never set production publishing flags or perform a provider write during certification.

## Preflight

1. Owner grants the authorized session **read-only access to the actual original
   Supabase project**; verify its ID before using any project management tools.
2. Confirm that `gem-social-publishing-gateway` is deployed in that project;
   an unrelated Edge Function or Vercel `/api/health` is not a substitute.
3. Ensure an approved secure execution context supplies the existing
   `SOCIAL_GATEWAY_ADAPTER_SECRET` and the original project's public anon key
   as `GEM_GATEWAY_CERT_ANON_KEY`. The optional
   `GEM_GATEWAY_CERT_SUPABASE_URL` must match the original project exactly.
   **Do not send those values to chat or put them on the command line.**

## Automated checks

In the authorized environment with credentials already injected securely:

```sh
node scripts/social-gateway-certification.mjs
```

The command issues **only two `POST {"action":"health"}` probes** to the
original Edge Function, in this order:

1. Without `Authorization`, with the public `apikey` header: must return
   HTTP 401. A different result is **not certified**.
2. With the existing adapter bearer secret: must return HTTP 200,
   `{"ok":true,"rpcCount":14}` or greater. A successful response proves that
   the existing bearer value was accepted by the original Edge Function.
   Do not fetch or display a comparison of the two secret values.

Exit code is zero only when both probes pass. Output contains only the
project ref, sanitized status codes, RPC count and diagnostic code, never
credential values or raw error bodies. Errors and missing access fail closed.

**Important migration discrepancy:** the repository's existing
`20261108050000_social_publishing_gateway_rpcs.sql` comments describe
**13 RPCs** (12 operations plus health). The owner acceptance threshold is
**at least 14**; this check deliberately does not soften that requirement.
Inspect the live RPC inventory and subsequent authorized migrations before
claiming >=14. Do **not** invent a fourteenth function just to satisfy a
counter, nor run migrations without the required production authorization
and backup/recovery plan.

## Verified scope versus separate acceptance gates

- This script can certify the **original gateway secret match indirectly**
  through successful bearer-authenticated health, and the owner-only
  health response including `rpcCount >= 14`.
- It cannot certify provider OAuth grant freshness, granted publishing
  scopes, platform app reviews, exact approved content, or posting readiness.
  Those remain separate provider-by-provider evidence gates.
- It cannot certify a completed Enterprise/Community intake write, owner
  invitation, authenticated session, or tenant isolation. PR #511 retains
  those separate acceptance requirements.
- Offline unit tests: `node --test scripts/social-gateway-certification.test.mjs`.
  They use stubbed responses and are **not** a live gateway success.
