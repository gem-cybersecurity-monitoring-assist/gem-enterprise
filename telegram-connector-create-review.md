# Review memo — Telegram connector creation path (POST /api/social-media/connectors)

**Date:** 2026-11-09 ~22:15 WAT
**Base:** main, head `82b7c3e` (PRs #467–#471 merged), verified by content in the working tree
`~/workspace/gem-enterprise-work/telegram-connector-create/` (gateway-client.ts exists,
gateway-worker-deps.ts contains the transport-aware re-exports,
`prisma/migrations/20261108060000_telegram_jobs_provider_check/migration.sql` exists).
**Patch:** [`telegram-connector-create.patch`](sandbox://workspace/gem-enterprise-work/telegram-connector-create.patch)
(9 files, 1,319 lines; `git apply --check` passes; applied tree diff-identical to the work tree,
excluding `node_modules` and `tsconfig.tsbuildinfo`).
**Status:** code + sandbox verification complete. **No live verification claimed** — see §5.

## 1. What was built, per file

### New migration — `prisma/migrations/20261109220000_social_publishing_create_connector/migration.sql` (318 lines, new)
Adds one RPC, `gem_social_create_connector`. Latest timestamp in `prisma/migrations/`
(after `20261108060000`). The merged RPC migration (`20261108050000`) was **not** edited.
- `SECURITY DEFINER`, `SET search_path = public`, `#variable_conflict use_column`.
- `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO service_role` only (1 each, verified by count).
- Inserts the connector row and the credential row in one transaction; accepts the
  already-encrypted `secretRef` (encryption happens in Node via `encryptSocialCredential`,
  never in SQL). Credential row uses reference_type `'oauth:production'` deliberately —
  that is the reference type the existing credential-load path filters on
  (`lifecycle-store.ts`, `gem_social_load_connector_credential`); a bot-token-specific
  reference type would make the worker unable to load the Telegram token.
- Idempotency: same workspace + provider TELEGRAM + account (telegramChatId) returns the
  existing connector (reactivated if disconnected); a conflicting request returns 409
  `SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT` (same-request-or-409 rule, mirroring
  `gem_social_create_job`). Business errors are JSON envelopes; codes used are from the
  existing families only (`SOCIAL_CONNECTOR_CREATE_FAILED`,
  `SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT`) — no new code family invented.
- The returned connector never contains the `secretRef`: the RPC returns only
  `jsonb_build_object('ok', true, 'connector', v_connector)`; `secret_ref` appears only
  in the INSERT/UPDATE statements (10 mentions, all writes).

### Edge function — `supabase/functions/gem-social-publishing-gateway/index.ts`
- New `createConnector` handler (same envelope + status mapping as `createJob`) and a
  dispatcher case `create_connector` (line 461). It is a **phase-1 action**, not a phase-2
  rejection. Calls `db.rpc("gem_social_create_connector", …)` (line 391).

### Gateway client — `src/lib/social-media/publishing/gateway-client.ts`
- `"create_connector"` added to `SOCIAL_PUBLISHING_GATEWAY_ACTIONS` and the
  `SocialPublishingGatewayAction` union.
- **`EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT` 13 → 14** (see §4).

### Store — `src/lib/social-media/oauth/store.ts`
- New `createSocialBotTokenConnector` (the OAuth-only `persistSocialConnector` cannot be
  reused — its provider type is `SocialOAuthProvider`, and TELEGRAM is a bot-token provider).
  Dispatcher on `shouldUseSupabaseGateway()`: gateway path calls
  `socialPublishingGateway("create_connector", …)` and revives the row via
  `reviveConnectorRecord`; Prisma path mirrors `persistSocialConnector` (INSERT …
  `ON CONFLICT (workspace_id, provider, external_account_key) DO UPDATE … RETURNING`
  the 12 connector columns; credential upsert `ON CONFLICT (connector_id, reference_type)`,
  reference_type `'oauth:production'`). Emergency-locks check lives in the route, not here
  (same as `disconnectSocialConnector`).
- One deliberate deviation from the sibling call: the Prisma-path `$queryRaw` uses a
  post-call cast (`… as SocialConnectorRecord[]`) instead of the generic type argument
  `$queryRaw<T>`. The sandbox Prisma stub leaves `$queryRaw` untyped, so `$queryRaw<T>`
  raises TS2347 there — the same pre-existing stub artifact as `persistSocialConnector`'s
  own call (see §3). The cast is identical at runtime and keeps this file clean under the
  stub; with a generated Prisma client both forms type-check.

### Admin API route — `src/app/api/social-media/connectors/route.ts` (POST added)
**Note:** the task brief said "new file", but the route file already exists (GET list +
DELETE disconnect) — the POST export was added to it, following the DELETE route's pattern
exactly: `requireSameOrigin` → `requireActiveTokMetricSession` → `parseJson` (zod) →
`requireWorkspaceAccess` → `requirePermission(membership, "manage", "connectors")` →
`enforceEmergencyLocks(workspaceId, "connector")` → create → `emitTokMetricAudit` with
action `"social.connector.authorized"` (the OAuth callback's success action) → respond.
- Payload validation: provider must be `TELEGRAM` (`z.literal("TELEGRAM")`); `telegramChatId`
  required non-empty string; bot token required non-empty string; optional `displayName`
  (default `"Telegram"`), optional `telegramPublicChannel`. Credential built as
  `{ provider: "TELEGRAM", accessToken: botToken, grantedScopes: [], externalAccountId: telegramChatId }`;
  safe metadata `{ telegramChatId, telegramPublicChannel? }`.
- Fail closed on any error (no partial connector; the audit fires only after a successful
  create). Response matches the GET shape:
  `{ ok: true, correlationId, connector: enriched, externalActionTaken: false }`, where
  enriched adds `providerPaused` (from `getPausedSocialProviders`) and `liveProbe` (from
  `readLiveProbeSignal`). The token and the `secretRef` never appear in the response.
  Returns 200 for both a new create and an idempotent re-create.

### Tests — `src/__tests__/social-telegram-connector-create.test.ts` (new, 12 tests)
- Gateway path (Prisma armed to throw): asserts `create_connector` called with the encrypted
  `secretRef` + chat id; the captured `secretRef` decrypts (real `encryptSocialCredential` /
  `decryptSocialCredential` round trip, 32-byte test key `"11".repeat(32)`) to
  `{ provider: "TELEGRAM", accessToken: "test-bot-token", grantedScopes: [], externalAccountId: "-1003368597629" }`;
  token and `secretRef` absent from the response; audit called with
  `social.connector.authorized` and no token in its metadata.
- Prisma path (gateway never called): asserts connector INSERT + credential INSERT ran, and
  the credential INSERT's `secretRef` value decrypts to the same credential.
- Display name + public channel passthrough; validation rejects wrong provider, missing chat
  id, blank chat id, missing token, missing workspace id — all 400 `VALIDATION_ERROR`, before
  any store call; 401 without a session; 403 when the member may not manage connectors;
  fail-closed when the gateway returns no connector (500
  `SOCIAL_PUBLISHING_GATEWAY_RESPONSE_INVALID`, no audit); gateway 409 surfaces as the same
  code and status, no audit.
- Mocking follows `social-publishing-gateway-worker-wiring.test.ts` (vi.mock `@prisma/client`
  sql, `@/lib/db` with `$transaction: fn => fn(tx)`, `@/lib/supabase-gateway` with
  `shouldUseSupabaseGateway`, gateway client with a per-action handler map, wholesale mock of
  `@/lib/tokmetric/security` with a `TokMetricError` class carrying `status`/`code`; same-origin
  header `origin: http://localhost` on test requests). Test fake token only — no real token anywhere.

### Count updates — `src/__tests__/social-publishing-gateway-client.test.ts`, `src/__tests__/social-publishing-gateway-adapter.test.ts`
- Client test: `toHaveLength(13)` → 14, `toBe(13)` → 14, probe test `rpcCount: 13` → 14.
- Adapter test: mocked `EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT: 13` → 14 (mock value, kept aligned).

### Docs — `docs/social-media/PROVIDER_ACTIVATION_CHECKLIST.md` (one line)
- The RPCs row now also names the create-connector migration and states the health probe
  expects 14 routines.

## 2. Verification evidence (sandbox only)

| Check | Result |
|---|---|
| Focused + neighbour vitest (8 files): new create suite, gateway-client, gateway-adapter, gateway-worker-wiring, telegram-publishing-worker, social-control-plane-ws-a, social-cron-gateway-authority, social-backend-readiness | **111 / 111 passed** (new 12, client 13, adapter 13, wiring 22, telegram-worker 7, control-plane-ws-a 26, cron-gateway-authority 10, backend-readiness 8) |
| Connectors-related suites (7 more files): oauth-foundation, account-lifecycle, publishing-governance, credential-rotation-concurrency, telegram-pause-enforcement, tokmetric-gateway-persistence-boundary, facebook-shared-social-hub | 29 passed in 5 files; **2 files fail identically on pristine main** (`Cannot find module '.prisma/client/default'` — Prisma client not generated in the sandbox; pre-existing, unrelated to this change, confirmed by running them in the pristine extract) |
| ESLint on all 7 touched TS files | Clean, exit 0 |
| `tsc --noEmit`, diffed against pristine main | **Zero new errors.** The only diff line is the line-number shift of the single pre-existing `TS2347` in `store.ts` (pristine line 212 → work line 222, same error, same `persistSocialConnector` call). Both `tsc` runs exit 2 from the pre-existing stub errors (99 vs 97 output lines before the fix; after the fix the diff is the one shift only) |
| Migration structural checks (`20261109220000…/migration.sql`, 318 lines) | CREATE FUNCTION ×1, SECURITY DEFINER ×1, `SET search_path = public` ×1, `#variable_conflict use_column` ×1, REVOKE FROM PUBLIC ×1, GRANT EXECUTE TO service_role ×1, `ON CONFLICT` ×4, `SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT` ×1 |
| Patch | `diff -ruN` vs pristine main extract, excluding `node_modules` + `tsconfig.tsbuildinfo`, headers normalized to `a/`/`b/`; `git apply --check` **OK** on a fresh pristine extract; applied tree diff-identical to the work tree |

Two test bugs were found and fixed during verification (both in the new test file, not the
shipped code): the Prisma-path credential `secretRef` is `values[2]`, not `values[3]`
(`'oauth:production'` is a SQL literal, not an interpolation); the 401/403 tests now throw
the mock's hoisted `TokMetricError` instead of plain Errors (which the route maps to 500).

## 3. Pre-existing notes (not introduced here)

- The Prisma client is not generated in the sandbox (`prisma generate` hits ECONNRESET on
  engine download); repo-wide `tsc` shows the pre-existing `@prisma/client` stub errors.
- The merged RPC migration's comment (line ~1362, "The probe expects 13") is now stale.
  The merged migration was **not** edited, per the task rules — flag it for the owner to
  note, not to fix by editing merged history.
- `node_modules` in the work tree is a symlink to the gateway-worker-wiring tree's install
  (same base, same lockfile); it is excluded from the patch.

## 4. Probe-count change 13 → 14 — what it means live

The health RPC counts `gem_social_*` routines and the client requires
`rpcCount >= EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT`. The new RPC makes the live
inventory 14, so **the live health check now expects `rpcCount: 14`**. Until the
create-connector migration is applied to the live gateway project
`slzdjoqpzbkwzuaexlkj`, a deployed build of this code would report the health probe as
failing (13 < 14) and readiness would stay `BLOCKED_GATEWAY_BACKEND`. That is the intended
fail-closed behaviour: the flag flip must happen only after the migration is applied (see
§5). The checklist doc line (§1) was updated so the activation sequence names all three
migrations: RPCs `20261108050000`, CHECK `20261108060000`, create-connector `20261109220000`.

## 5. What is NOT done (owner / Supabase steps — unchanged from the go-to-market thread)

- **No live verification of anything in this patch.** No Supabase access exists from this
  sandbox; nothing was applied, deployed, or probed against `slzdjoqpzbkwzuaexlkj`.
- Supabase live steps, in order: (a) confirm the `social_*` tables exist; (b) apply the
  three migrations (RPC `20261108050000`, CHECK `20261108060000`, create-connector
  `20261109220000`); (c) deploy the edge function; (d) set the machine secret
  `SOCIAL_GATEWAY_ADAPTER_SECRET` in Supabase and Vercel (same value); (e) call the health
  action and confirm `ok: true, rpcCount: 14`; (f) only then set
  `SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED=true` in Vercel production and redeploy;
  (g) confirm readiness returns `GATEWAY_ADAPTER_VERIFIED` and the publishing process route
  no longer returns 503. Still blocked on Gem signing in with the account that owns
  `slzdjoqpzbkwzuaexlkj` (support371 has no access).
- After the adapter goes live: create the Telegram connector via the new POST endpoint
  (admin, in-app), approve the two drafts in the approvals flow, queue jobs and verify
  delivery (manual publish test first; autopilot stays off).

## 6. Reconciliation notes for the parent agent

- **PR #479 (draft, `fix/social-channel-connections`)** replaces `requireActiveTokMetricSession`
  with `requireSocialConnectorSession` / `requireSocialConnectorWorkspace` in the OAuth
  start/callback routes. This POST route follows the existing pattern
  (`requireActiveTokMetricSession`) because that is what the connectors GET/DELETE routes use
  today. When #479 lands, the auth call in this route should be reconciled to whichever
  pattern wins — flag, do not silently re-do.
- The route file was already present (GET + DELETE); the brief's "new file" instruction
  became "POST export added to the existing route file".
- No commit, push, PR, merge, or deployment was performed. No secret values anywhere in
  the patch, tests, or memo (test fake `"test-bot-token"` only).

## Repair 2026-11-10 — main drift, connector-authority reconciliation

Main advanced past `82b7c3e` to `f5e5053` ("feat(personnel): live Notion unpublished record creation"). PR #479's connector-authority pattern is now ON main: the connectors route uses `requireSocialConnectorSession` / `requireSocialConnectorWorkspace` throughout (GET + DELETE), and `requireActiveTokMetricSession` / `requireWorkspaceAccess` are gone from the route's imports. The 2026-11-09 patch's POST handler still called the old two, so every one of its 12 tests returned 500 (ReferenceError at runtime).

Repair (2 files, against current main `f5e5053`):
- `src/app/api/social-media/connectors/route.ts` POST: `requireActiveTokMetricSession(request)` → `requireSocialConnectorSession(request)`; `requireWorkspaceAccess(parsed.workspaceId, session)` → `requireSocialConnectorWorkspace(parsed.workspaceId, session)`. Both already imported at the top of the file. Return shapes are identical (session with userId; membership with role), so the rest of the handler is unchanged. This is the reconciliation the 2026-11-09 review flagged as pending once #479's pattern won — it has now won.
- `src/__tests__/social-telegram-connector-create.test.ts`: new `connectorAuthorityMocks` (session + workspace) and a `vi.mock("@/lib/social-media/connector-authority", ...)`; the old `requireActiveTokMetricSession` / `requireWorkspaceAccess` entries removed from the security mock; beforeEach + the 401 test + the validation assertion updated to the connector-authority mocks. `requirePermission`, `enforceEmergencyLocks`, `emitTokMetricAudit` stay mocked from security (still used by POST).

Re-verification against current main `f5e5053` (fresh tarball, node_modules symlinked from the 2026-11-09 working copy):
- Focused + neighbour vitest (8 files): **111 / 111 passed** (same count as 2026-11-09).
- ESLint clean on all 7 touched TS files.
- tsc diffed vs pristine main: byte-identical outputs after line-number normalisation — zero new errors (43 pre-existing TS2347 Prisma-stub errors, unchanged).
- Regenerated patch (9 files, 1,440 lines) round-trip verified: `patch -p1 --dry-run` clean against a fresh main extract.

Note: the `EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT` "expects 13" comment in the merged RPC migration is still stale (left untouched per the rules — do not edit merged history). The POST route now matches main's auth pattern, so there is no remaining #479 reconciliation debt on this route.
