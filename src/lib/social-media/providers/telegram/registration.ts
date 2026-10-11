/**
 * Worker registration for the TELEGRAM provider (WS-D integration point).
 *
 * The worker dispatches via `getSocialPublishingAdapter(provider)` in
 * src/lib/social-media/publishing/adapters.ts, keyed by
 * SharedSocialPublishingProvider in ./publishing/types.ts. Both files are owned
 * by WS-B (publishing). This module therefore exposes the pieces WS-B needs to
 * wire TELEGRAM in with a one-line change on their side — this package never
 * edits their files.
 *
 * WS-B integration (their change, documented here):
 *   1. Add "TELEGRAM" to `sharedSocialPublishingProviders` in
 *      src/lib/social-media/publishing/types.ts.
 *   2. In src/lib/social-media/publishing/adapters.ts:
 *        import { telegramPublishingAdapter } from "@/lib/social-media/providers/telegram";
 *        // inside the adapters record:
 *        TELEGRAM: telegramPublishingAdapter,
 *
 * Until those land, TELEGRAM jobs fail closed at the worker's authorization
 * gate (unknown provider has no adapter).
 */

import type { SocialPublishingAdapter } from "@/lib/social-media/publishing/adapters";
import type { SocialPublishingAdapterInput } from "@/lib/social-media/publishing/types";
import { telegramPublishingAdapter } from "./adapter";
import { resolveTelegramDestination } from "./config";

/** The provider id WS-B must add to SharedSocialPublishingProvider. */
export const TELEGRAM_PROVIDER_ID = "TELEGRAM" as const;

export { telegramPublishingAdapter };

/**
 * Adapter entry in the same shape as the worker's adapter registry:
 * provider id -> adapter. WS-B merges this into their adapters record.
 */
export const telegramProviderRegistry: Record<string, SocialPublishingAdapter> =
  {
    [TELEGRAM_PROVIDER_ID]: telegramPublishingAdapter,
  };

/**
 * Merge helper WS-B can call when building their registry:
 *   const adapters = withTelegramProvider(existingAdapters);
 */
export function withTelegramProvider<
  T extends Record<string, SocialPublishingAdapter>,
>(adapters: T): T & Record<typeof TELEGRAM_PROVIDER_ID, SocialPublishingAdapter> {
  return { ...adapters, ...telegramProviderRegistry } as T &
    Record<typeof TELEGRAM_PROVIDER_ID, SocialPublishingAdapter>;
}

/**
 * Pre-flight connector check for admin/diagnostics use. Fails closed when the
 * token or destination is missing. Never returns the token.
 */
export function checkTelegramConnectorReady(input: {
  accessToken?: string;
  connectorMetadata?: Record<string, unknown>;
}): { ready: true } | { ready: false; code: string; message: string } {
  const hasToken =
    typeof input.accessToken === "string" && input.accessToken.trim().length > 0;
  if (!hasToken) {
    return {
      ready: false,
      code: "TELEGRAM_BOT_TOKEN_MISSING",
      message: "No decrypted Telegram bot token on the connector.",
    };
  }
  if (!resolveTelegramDestination(input.connectorMetadata)) {
    return {
      ready: false,
      code: "TELEGRAM_DESTINATION_NOT_CONFIGURED",
      message: "No telegramChatId in the connector metadata.",
    };
  }
  return { ready: true };
}

export type TelegramAdapterInput = SocialPublishingAdapterInput;
