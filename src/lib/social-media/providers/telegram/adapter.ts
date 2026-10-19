/**
 * Telegram Bot API publishing adapter for the unified social publishing worker.
 *
 * Implements the exact `SocialPublishingAdapter` contract from
 * src/lib/social-media/publishing/adapters.ts (imported, never modified):
 *   publish(input: SocialPublishingAdapterInput) -> SocialPublishingAdapterResult
 *
 * Input mapping:
 *   - input.accessToken       -> the decrypted bot token (server-side only).
 *   - input.externalAccountId -> connector's external account identifier (unused as
 *     destination; kept for parity with other adapters).
 *   - input.connectorMetadata -> { telegramChatId, telegramPublicChannel? }.
 *
 * Endpoint selection:
 *   - TEXT / THREAD / LINK-only        -> sendMessage
 *   - IMAGE (exactly one media URL)    -> sendPhoto (caption = text)
 *   - SHORT_VIDEO / LONG_VIDEO / REEL  -> sendVideo (caption = text)
 *   - CAROUSEL (2-10 media URLs)       -> sendMediaGroup (caption on first item)
 *
 * Idempotency: Telegram has no native dedupe. Before any network call the
 * adapter pre-checks job.externalPostId (set by the store when a previous
 * attempt succeeded). On success the worker records message_id in
 * safeProviderMetadata, so a retry replays safely instead of double-posting.
 *
 * The bot token never appears in results, metadata, logs, or error messages.
 */

import {
  SocialPublishingAdapterError,
  type SocialPublishingAdapter,
} from "@/lib/social-media/publishing/adapters";
import type {
  SocialPublishingAdapterInput,
  SocialPublishingAdapterResult,
} from "@/lib/social-media/publishing/types";
import { TELEGRAM_API_BASE_URL, resolveTelegramDestination } from "./config";

const REQUEST_TIMEOUT_MS = 30_000;
const TELEGRAM_MESSAGE_LIMIT = 4096;
const TELEGRAM_CAPTION_LIMIT = 1024;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function httpsUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new SocialPublishingAdapterError(
      "TELEGRAM_INVALID_MEDIA_URL",
      `${field} must be a valid HTTPS URL.`,
    );
  }
  if (parsed.protocol !== "https:") {
    throw new SocialPublishingAdapterError(
      "TELEGRAM_INVALID_MEDIA_URL",
      `${field} must use HTTPS.`,
    );
  }
  return parsed.toString();
}

function joinedMessage(text?: string, linkUrl?: string): string {
  return [text?.trim(), linkUrl?.trim()].filter(Boolean).join("\n\n");
}

function failClosed(code: string, message: string, retryable: boolean): never {
  throw new SocialPublishingAdapterError(code, message, { retryable });
}

async function telegramRequest(input: {
  botToken: string;
  method: string;
  params: Record<string, unknown>;
}): Promise<{ status: number; payload: JsonRecord }> {
  const endpoint = `${TELEGRAM_API_BASE_URL}/bot${encodeURIComponent(input.botToken)}/${input.method}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    // The bot token travels in the URL path as required by the Bot API.
    // It is never logged, never returned in results, and never placed in
    // metadata. Do not include it in error messages or audit payloads.
    body: JSON.stringify(input.params),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "TELEGRAM_REQUEST_UNAVAILABLE",
      "Telegram publishing is temporarily unavailable.",
      { retryable: true },
    );
  });
  const text = await response.text().catch(() => "");
  let payload: JsonRecord = {};
  try {
    payload = text ? record(JSON.parse(text)) : {};
  } catch {
    payload = {};
  }
  if (!response.ok || payload.ok === false) {
    telegramFailure(response.status, payload);
  }
  return { status: response.status, payload };
}

function telegramFailure(status: number, payload: JsonRecord): never {
  const errorCode =
    typeof payload.error_code === "number"
      ? payload.error_code
      : typeof payload.error_code === "string"
        ? payload.error_code
        : String(status);
  const retryable =
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500 ||
    errorCode === 429;
  const reauthorizationRequired =
    status === 401 ||
    errorCode === 401 ||
    /unauthorized/i.test(String(payload.description || ""));
  throw new SocialPublishingAdapterError(
    `TELEGRAM_PROVIDER_${errorCode}`,
    reauthorizationRequired
      ? "Telegram bot authorization is no longer valid. Rotate the bot token."
      : retryable
        ? "Telegram is temporarily unavailable."
        : "Telegram rejected the publishing request.",
    {
      retryable: retryable && !reauthorizationRequired,
      reauthorizationRequired,
      providerStatusCode: status,
      // Safe metadata only: never the token, never the raw description when it
      // could echo secrets. Telegram error descriptions are static strings.
      safeMetadata: { providerCode: String(errorCode) },
    },
  );
}

function telegramMessageId(payload: JsonRecord): number | null {
  const result = record(payload.result);
  return typeof result.message_id === "number" ? result.message_id : null;
}

function videoContentType(contentType: string): boolean {
  return (
    contentType === "SHORT_VIDEO" ||
    contentType === "LONG_VIDEO" ||
    contentType === "REEL"
  );
}

/** Best-effort per-item type for sendMediaGroup from the URL extension. */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|#|$)/i.test(url);
}

export const telegramPublishingAdapter: SocialPublishingAdapter = {
  async publish(
    input: SocialPublishingAdapterInput,
  ): Promise<SocialPublishingAdapterResult> {
    const { job } = input;

    // Idempotency pre-check: Telegram has no native dedupe. If a previous
    // attempt already succeeded, the store set externalPostId — replay that
    // outcome instead of sending a duplicate message.
    const existingExternalPostId = stringValue(job.externalPostId);
    if (existingExternalPostId) {
      return {
        externalPostId: existingExternalPostId,
        safeMetadata: {
          destination: "TELEGRAM",
          idempotentReplay: true,
          idempotencyKey: job.idempotencyKey,
        },
      };
    }

    const botToken = stringValue(input.accessToken);
    if (!botToken) {
      failClosed(
        "TELEGRAM_BOT_TOKEN_MISSING",
        "The Telegram connector has no decrypted bot token. Authorization is required.",
        false,
      );
    }
    const destination = resolveTelegramDestination(input.connectorMetadata);
    if (!destination) {
      failClosed(
        "TELEGRAM_DESTINATION_NOT_CONFIGURED",
        "The Telegram connector has no target chat/channel configured.",
        false,
      );
    }

    const text = joinedMessage(job.payload.text, job.payload.linkUrl);
    const media = (job.payload.mediaUrls || []).map((url, index) =>
      httpsUrl(url, `mediaUrls[${index}]`),
    );
    if (job.payload.linkUrl) httpsUrl(job.payload.linkUrl, "linkUrl");

    let messageId: number | null = null;
    let providerStatusCode: number | undefined;
    let destinationKind: string;

    const token = botToken as string;
    const chatId = destination.chatId;

    if (job.contentType === "CAROUSEL") {
      if (media.length < 2 || media.length > 10) {
        throw new SocialPublishingAdapterError(
          "TELEGRAM_CAROUSEL_SIZE_INVALID",
          "Telegram media groups require between two and ten approved media URLs.",
        );
      }
      const caption = text.slice(0, TELEGRAM_CAPTION_LIMIT);
      const items = media.map((url, index) => ({
        type: isVideoUrl(url) ? "video" : "photo",
        media: url,
        ...(index === 0 && caption ? { caption } : {}),
      }));
      const { status, payload } = await telegramRequest({
        botToken: token,
        method: "sendMediaGroup",
        params: { chat_id: chatId, media: items },
      });
      messageId = telegramMessageId(payload);
      providerStatusCode = status;
      destinationKind = "TELEGRAM_MEDIA_GROUP";
    } else if (job.contentType === "IMAGE") {
      if (media.length !== 1) {
        throw new SocialPublishingAdapterError(
          "TELEGRAM_IMAGE_REQUIRED",
          "Telegram image publishing requires exactly one approved image URL.",
        );
      }
      const { status, payload } = await telegramRequest({
        botToken: token,
        method: "sendPhoto",
        params: {
          chat_id: chatId,
          photo: media[0],
          ...(text ? { caption: text.slice(0, TELEGRAM_CAPTION_LIMIT) } : {}),
        },
      });
      messageId = telegramMessageId(payload);
      providerStatusCode = status;
      destinationKind = "TELEGRAM_PHOTO";
    } else if (videoContentType(job.contentType)) {
      if (media.length !== 1) {
        throw new SocialPublishingAdapterError(
          "TELEGRAM_VIDEO_REQUIRED",
          "Telegram video publishing requires exactly one approved video URL.",
        );
      }
      const { status, payload } = await telegramRequest({
        botToken: token,
        method: "sendVideo",
        params: {
          chat_id: chatId,
          video: media[0],
          ...(text ? { caption: text.slice(0, TELEGRAM_CAPTION_LIMIT) } : {}),
        },
      });
      messageId = telegramMessageId(payload);
      providerStatusCode = status;
      destinationKind = "TELEGRAM_VIDEO";
    } else {
      const message =
        job.contentType === "THREAD"
          ? (job.payload.thread || []).join("\n\n").trim()
          : text;
      if (!message) {
        throw new SocialPublishingAdapterError(
          "TELEGRAM_MESSAGE_REQUIRED",
          "Telegram publishing requires approved text.",
        );
      }
      if (message.length > TELEGRAM_MESSAGE_LIMIT) {
        throw new SocialPublishingAdapterError(
          "TELEGRAM_MESSAGE_TOO_LONG",
          "Telegram messages are limited to 4096 characters.",
        );
      }
      const { status, payload } = await telegramRequest({
        botToken: token,
        method: "sendMessage",
        params: { chat_id: chatId, text: message },
      });
      messageId = telegramMessageId(payload);
      providerStatusCode = status;
      destinationKind = "TELEGRAM_MESSAGE";
    }

    if (messageId === null) {
      throw new SocialPublishingAdapterError(
        "TELEGRAM_PUBLISH_RESPONSE_INVALID",
        "Telegram did not return a message identifier.",
      );
    }

    const handle = destination.publicChannel?.replace(/^@/, "");
    return {
      externalPostId: String(messageId),
      externalPostUrl: handle
        ? `https://t.me/${encodeURIComponent(handle)}/${messageId}`
        : undefined,
      providerStatusCode,
      safeMetadata: {
        destination: destinationKind,
        messageId,
        chatConfigured: true,
        idempotencyKey: job.idempotencyKey,
      },
    };
  },
};
