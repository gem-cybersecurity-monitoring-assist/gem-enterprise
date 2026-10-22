# Telegram Provider Integration

Status: **adapter implemented, registration pending** (WS-B wiring). Not yet dispatchable in production.

## What this is

The `TELEGRAM` provider adapter lets the unified social publishing worker publish
to Telegram through the Bot API, under the same governance (approval, compliance
review, idempotency, audit) as every other provider.

Code: `src/lib/social-media/providers/telegram/`
- `adapter.ts` — implements the exact `SocialPublishingAdapter` contract from
  `src/lib/social-media/publishing/adapters.ts` (endpoint selection, error
  mapping, idempotency pre-check).
- `config.ts` — config contract: secret storage pattern, safe metadata keys,
  admin setup steps.
- `registration.ts` — integration point for the worker (WS-B wiring instructions).

## The existing crypto-signal-bot notifier is untouched

The only real Telegram publisher in the GEM ecosystem is
`backend/services/telegram_alerts.py` in the **support371/crypto-signal-bot**
repository. It is a trade-alert notifier that POSTs to
`https://api.telegram.org/bot<token>/sendMessage`, targeting the channel
`@mycybersecureWealthsolution`.

That notifier is **not part of the gem-enterprise social queue and is not
modified or replaced by this work**. The adapter here is an independent
integration point: an operator may point the gem-enterprise Telegram connector
at the same channel (by setting `telegramChatId` to `@mycybersecureWealthsolution`)
or at a different channel, without any change to the crypto-signal-bot code.

## Config contract

| Item | Value | Sensitivity |
|---|---|---|
| Bot token | connector credential, decrypted to `accessToken` at publish time | **SECRET** — encrypted via `SOCIAL_TOKEN_ENCRYPTION_KEY` in `oauth/lifecycle-store`, server-side only |
| Target chat/channel | connector safe metadata key `telegramChatId` (`@handle`, numeric id, or `-100…`) | safe metadata |
| Optional public channel handle | connector safe metadata key `telegramPublicChannel` | safe metadata (display URL only) |

The bot token never appears in API responses, audit metadata, safeMetadata, or
error messages. `SocialPublishingAdapterResult.safeMetadata` for Telegram
contains only: `destination`, `messageId`, `chatConfigured`, `idempotencyKey`.

## Idempotency

Telegram has no native dedupe. The adapter pre-checks `job.externalPostId`:
if a previous attempt already succeeded (the worker records `message_id` in
`safeProviderMetadata`), the adapter replays the stored result without sending.
Otherwise it sends and returns `externalPostId = message_id`, which the store
persists before any retry can occur.

## Endpoint selection

| Job content | Bot API method |
|---|---|
| text / thread / link-only | `sendMessage` |
| IMAGE (1 media URL) | `sendPhoto` (text → `caption`) |
| SHORT_VIDEO / LONG_VIDEO / REEL (1 media URL) | `sendVideo` (text → `caption`) |
| CAROUSEL (2–10 media URLs) | `sendMediaGroup` (caption on first item; item type from URL extension) |

Captions are capped at 1024 characters, text messages at 4096. Media URLs must
be HTTPS. `401` from Telegram marks the connector for reauthorization; `429`
and `5xx` are retryable.

## Admin steps (HUMAN_REQUIRED)

1. Create a bot with `@BotFather` and copy the bot token.
2. Add the bot to the target channel/group as an administrator with post permission.
3. Record the target chat/channel id.
4. Store the bot token as an encrypted connector credential (server-side only).
5. Store the target chat id as `telegramChatId` in connector metadata.
6. Verify one manual publish through the queue before enabling autopilot egress.

## Worker registration (cross-workstream: WS-B)

The worker dispatches through `getSocialPublishingAdapter()` keyed by
`SharedSocialPublishingProvider`. Wiring TELEGRAM requires WS-B to:
1. add `"TELEGRAM"` to `sharedSocialPublishingProviders` in
   `src/lib/social-media/publishing/types.ts`, and
2. add `TELEGRAM: telegramPublishingAdapter` to the adapters record in
   `src/lib/social-media/publishing/adapters.ts`
   (see `registration.ts` for the merge helper and pre-flight check).
