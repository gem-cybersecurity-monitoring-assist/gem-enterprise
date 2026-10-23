/**
 * Telegram connector registration (server-side only).
 *
 * Telegram authenticates with a bot token rather than OAuth. This module
 * verifies an operator-supplied bot token and destination chat against the
 * Bot API, then stores the token as an encrypted connector credential and the
 * destination as safe metadata — the exact shape the Telegram publishing
 * adapter and `loadPublishingConnectorCredential` expect.
 *
 * The bot token is never returned, logged, or written to metadata.
 */

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enforceEmergencyLocks, TokMetricError } from "@/lib/tokmetric/security";
import { encryptSocialCredential } from "@/lib/social-media/oauth/crypto";
import { TELEGRAM_API_BASE_URL, TELEGRAM_METADATA_KEYS } from "./config";

export const TELEGRAM_CONNECTOR_PROVIDER = "TELEGRAM" as const;
export const TELEGRAM_ACCOUNT_TYPE = "TELEGRAM_CHAT" as const;

/** Bot API token shape: "<numeric bot id>:<35+ char secret>". */
const BOT_TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/;
/** @handle, numeric user/group id, or -100… supergroup/channel id. */
const CHAT_ID_PATTERN = /^(@[A-Za-z][A-Za-z0-9_]{3,31}|-?\d{5,20})$/;

export interface StoredTelegramCredential {
  provider: typeof TELEGRAM_CONNECTOR_PROVIDER;
  accessToken: string;
  grantedScopes: string[];
  externalAccountId: string;
}

export interface VerifiedTelegramDestination {
  botId: number;
  botUsername: string;
  chatId: string;
  chatTitle: string;
  chatType: string;
  publicChannel?: string;
}

type TelegramEnvelope<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

export function normalizeTelegramBotToken(input: string) {
  const token = input.trim();
  if (!BOT_TOKEN_PATTERN.test(token)) {
    throw new TokMetricError(
      400,
      "TELEGRAM_BOT_TOKEN_INVALID",
      "Enter the bot token exactly as @BotFather issued it (digits, a colon, then the secret).",
    );
  }
  return token;
}

export function normalizeTelegramChatId(input: string) {
  let chat = input.trim();
  const link = chat.match(/^(?:https?:\/\/)?t\.me\/([A-Za-z][A-Za-z0-9_]{3,31})\/?$/i);
  if (link) chat = `@${link[1]}`;
  if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(chat)) chat = `@${chat}`;
  if (!CHAT_ID_PATTERN.test(chat)) {
    throw new TokMetricError(
      400,
      "TELEGRAM_CHAT_ID_INVALID",
      "Enter the channel as @handle, a t.me link, or its numeric id (for example -1001234567890).",
    );
  }
  return chat;
}

async function callBotApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new TokMetricError(502, "TELEGRAM_NETWORK_ERROR", "Telegram could not be reached. Try again shortly.");
  });
  const payload = (await response.json().catch(() => null)) as TelegramEnvelope<T> | null;
  if (response.status === 401 || payload?.error_code === 401) {
    throw new TokMetricError(400, "TELEGRAM_BOT_TOKEN_REJECTED", "Telegram rejected this bot token. Copy it again from @BotFather.");
  }
  if (!payload?.ok || payload.result === undefined) {
    const description = payload?.description ?? `HTTP ${response.status}`;
    if (/chat not found/i.test(description)) {
      throw new TokMetricError(404, "TELEGRAM_CHAT_NOT_FOUND", "Telegram could not find that channel. Check the handle and that the bot has been added to it.");
    }
    // Never echo the raw description back with the token-bearing URL; it is safe text only.
    throw new TokMetricError(502, "TELEGRAM_API_ERROR", `Telegram returned an error: ${description}`);
  }
  return payload.result;
}

/**
 * Confirms the token is valid, the chat exists, and the bot is an
 * administrator that can post there. No message is sent.
 */
export async function verifyTelegramDestination(input: { botToken: string; chatId: string }): Promise<VerifiedTelegramDestination> {
  const token = normalizeTelegramBotToken(input.botToken);
  const requestedChat = normalizeTelegramChatId(input.chatId);

  const bot = await callBotApi<{ id: number; username?: string; is_bot: boolean }>(token, "getMe");
  if (!bot.is_bot) {
    throw new TokMetricError(400, "TELEGRAM_BOT_TOKEN_INVALID", "That token does not belong to a bot.");
  }
  const chat = await callBotApi<{ id: number; type: string; title?: string; username?: string; first_name?: string }>(
    token,
    "getChat",
    { chat_id: requestedChat },
  );
  const member = await callBotApi<{ status: string; can_post_messages?: boolean; can_send_messages?: boolean }>(
    token,
    "getChatMember",
    { chat_id: chat.id, user_id: bot.id },
  );

  const isAdmin = member.status === "administrator" || member.status === "creator";
  const canPost = chat.type === "channel"
    ? isAdmin && member.can_post_messages !== false
    : isAdmin || member.can_send_messages !== false;
  if (!canPost) {
    throw new TokMetricError(
      403,
      "TELEGRAM_BOT_NOT_ADMIN",
      "The bot is not allowed to post there. In Telegram, add the bot as an administrator of the channel with permission to post messages.",
    );
  }

  return {
    botId: bot.id,
    botUsername: bot.username ?? `bot${bot.id}`,
    chatId: String(chat.id),
    chatTitle: chat.title ?? chat.first_name ?? chat.username ?? String(chat.id),
    chatType: chat.type,
    publicChannel: chat.username ? `@${chat.username}` : undefined,
  };
}

interface TelegramConnectorRow {
  id: string;
  displayName: string;
  externalAccountId: string | null;
  safeMetadata: Record<string, unknown>;
}

/** Creates or updates the Telegram connector for a verified destination. */
export async function upsertTelegramConnector(input: {
  workspaceId: string;
  botToken: string;
  destination: VerifiedTelegramDestination;
}) {
  await enforceEmergencyLocks(input.workspaceId, "connector");
  const token = normalizeTelegramBotToken(input.botToken);
  const now = new Date();
  const credential: StoredTelegramCredential = {
    provider: TELEGRAM_CONNECTOR_PROVIDER,
    accessToken: token,
    grantedScopes: [],
    externalAccountId: input.destination.chatId,
  };
  const safeMetadata = {
    provider: TELEGRAM_CONNECTOR_PROVIDER,
    accountType: TELEGRAM_ACCOUNT_TYPE,
    [TELEGRAM_METADATA_KEYS.chatId]: input.destination.chatId,
    ...(input.destination.publicChannel
      ? { [TELEGRAM_METADATA_KEYS.publicChannel]: input.destination.publicChannel }
      : {}),
    chatTitle: input.destination.chatTitle,
    chatType: input.destination.chatType,
    botUsername: input.destination.botUsername,
    tokenLifecycle: "NON_EXPIRING",
    providerProbePerformed: true,
    externalPublishingEnabled: false,
  };
  const displayName = input.destination.publicChannel
    ? `${input.destination.chatTitle} (${input.destination.publicChannel})`
    : input.destination.chatTitle;

  return db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<TelegramConnectorRow[]>(Prisma.sql`
      INSERT INTO social_connectors (
        id, workspace_id, provider, state, display_name, external_account_key,
        external_account_id, granted_scopes, safe_metadata, last_health_at, created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${input.workspaceId}, ${TELEGRAM_CONNECTOR_PROVIDER}, 'CONNECTED', ${displayName},
        ${input.destination.chatId}, ${input.destination.chatId}, ARRAY[]::text[],
        CAST(${JSON.stringify(safeMetadata)} AS jsonb), ${now}, ${now}, ${now}
      )
      ON CONFLICT (workspace_id, provider, external_account_key)
      DO UPDATE SET
        state = 'CONNECTED',
        display_name = EXCLUDED.display_name,
        external_account_id = EXCLUDED.external_account_id,
        granted_scopes = EXCLUDED.granted_scopes,
        safe_metadata = EXCLUDED.safe_metadata,
        disabled_at = NULL,
        last_health_at = EXCLUDED.last_health_at,
        updated_at = EXCLUDED.updated_at
      RETURNING id, display_name AS "displayName", external_account_id AS "externalAccountId", safe_metadata AS "safeMetadata"
    `);
    const connector = rows[0];
    if (!connector) throw new Error("Telegram connector was not returned after persistence.");
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO social_connector_credentials (
        id, connector_id, reference_type, secret_ref, expires_at, refresh_expires_at, rotated_at, created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${connector.id}, 'oauth:production', ${encryptSocialCredential(credential)},
        NULL, NULL, ${now}, ${now}, ${now}
      )
      ON CONFLICT (connector_id, reference_type)
      DO UPDATE SET
        secret_ref = EXCLUDED.secret_ref,
        expires_at = NULL,
        refresh_expires_at = NULL,
        rotated_at = EXCLUDED.rotated_at,
        updated_at = EXCLUDED.updated_at
    `);
    return connector;
  });
}

/** Sends a short, clearly-labelled test message to the connected destination. */
export async function sendTelegramTestMessage(input: { botToken: string; chatId: string }) {
  const token = normalizeTelegramBotToken(input.botToken);
  const message = await callBotApi<{ message_id: number }>(token, "sendMessage", {
    chat_id: input.chatId,
    text: "GEM Enterprise: this channel is now connected to the social publishing workspace. (Connection test — you can delete this message.)",
    disable_notification: true,
  });
  return { messageId: message.message_id };
}
