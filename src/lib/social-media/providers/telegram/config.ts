/**
 * Telegram provider configuration contract for the unified social publishing worker.
 *
 * Server-side only. The bot token is a secret: it is stored as an encrypted
 * connector credential (SOCIAL_TOKEN_ENCRYPTION_KEY) via the existing
 * oauth/lifecycle-store and arrives at the adapter as `accessToken`.
 * The target chat/channel is safe metadata (connector metadata), never a secret.
 *
 * This module must never be imported from client components.
 */

export const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

/**
 * Secret storage. The bot token is never placed in connector metadata, API
 * responses, audit metadata, or logs. It travels encrypted through the
 * lifecycle-store and is decrypted server-side only at publish time.
 */
export const TELEGRAM_BOT_TOKEN_CREDENTIAL_KEY = "telegram_bot_token";

/** Name of the env key used by the existing encrypted-credential pattern. */
export const TELEGRAM_TOKEN_ENCRYPTION_ENV = "SOCIAL_TOKEN_ENCRYPTION_KEY";

/** Safe (non-secret) connector metadata keys for the Telegram connector. */
export const TELEGRAM_METADATA_KEYS = {
  /** Target chat/channel: @handle, numeric chat id, or -100... supergroup id. */
  chatId: "telegramChatId",
  /** Optional public channel handle used only to build a display URL. */
  publicChannel: "telegramPublicChannel",
} as const;

export interface TelegramConnectorMetadata {
  telegramChatId: string;
  telegramPublicChannel?: string;
}

export interface ResolvedTelegramDestination {
  /** Value sent as `chat_id` to the Bot API. */
  chatId: string;
  /** Optional public @handle for building a safe external post URL. */
  publicChannel?: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Resolve the destination chat from connector metadata. Returns null when the
 * connector has no configured destination so the caller can fail closed.
 */
export function resolveTelegramDestination(
  connectorMetadata: Record<string, unknown> | undefined,
): ResolvedTelegramDestination | null {
  const metadata = record(connectorMetadata);
  const chatId = nonEmpty(metadata[TELEGRAM_METADATA_KEYS.chatId]);
  if (!chatId) return null;
  return {
    chatId,
    publicChannel: nonEmpty(metadata[TELEGRAM_METADATA_KEYS.publicChannel]),
  };
}

/**
 * Server-side admin checklist for enabling a Telegram connector.
 * HUMAN_REQUIRED: the owner must complete these steps in Telegram and in the
 * admin connector UI; no agent may invent a bot token or channel id.
 */
export const TELEGRAM_CONNECTOR_SETUP_STEPS: readonly string[] = [
  "HUMAN_REQUIRED: Create a bot with @BotFather and copy the bot token.",
  "HUMAN_REQUIRED: Add the bot to the target channel/group as an administrator (post permission).",
  "HUMAN_REQUIRED: Record the target chat/channel id (e.g. @mycybersecureWealthsolution or -1001234567890).",
  "Store the bot token as an encrypted connector credential (server-side only, SOCIAL_TOKEN_ENCRYPTION_KEY).",
  "Store the target chat id as safe connector metadata (telegramChatId), never alongside the token.",
  "Verify one manual publish through the queue before enabling autopilot egress.",
] as const;
