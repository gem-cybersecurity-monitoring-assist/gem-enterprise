/**
 * Telegram publishing adapter tests.
 *
 * All provider HTTP is mocked: no real posts are created, and the tests assert
 * payload construction, the idempotency pre-check, and that the bot token
 * never leaks into the adapter result.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { telegramPublishingAdapter } from "@/lib/social-media/providers/telegram/adapter";
import { resolveTelegramDestination } from "@/lib/social-media/providers/telegram/config";
import { SocialPublishingAdapterError } from "@/lib/social-media/publishing/adapters";
import type { SocialPublishingJobRecord } from "@/lib/social-media/publishing/types";

const BOT_TOKEN = "test-bot-token-12345";
const CHAT_ID = "@testchannel";

type CapturedRequest = { url: string; body: Record<string, unknown> };

let captured: CapturedRequest[];
let originalFetch: typeof globalThis.fetch;

function telegramResponse(messageId: number) {
  return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function baseJob(overrides: Partial<SocialPublishingJobRecord> = {}) {
  return {
    id: "job-1",
    workspaceId: "ws-1",
    provider: "TELEGRAM",
    connectorId: "conn-1",
    contentType: "TEXT",
    idempotencyKey: "idem-1",
    payload: { text: "Hello Telegram" },
    localContext: null,
    externalPostId: null,
    externalPostUrl: null,
    safeProviderMetadata: {},
    ...overrides,
  } as unknown as SocialPublishingJobRecord;
}

function inputFor(job: SocialPublishingJobRecord) {
  return {
    job,
    accessToken: BOT_TOKEN,
    externalAccountId: "bot-account",
    connectorMetadata: { telegramChatId: CHAT_ID },
  };
}

beforeEach(() => {
  captured = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
    captured.push({
      url: String(url),
      body: JSON.parse(String((init?.body as string) ?? "{}")),
    });
    return telegramResponse(4242);
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("telegram publishing adapter", () => {
  it("sends text via sendMessage with the configured chat", async () => {
    const result = await telegramPublishingAdapter.publish(
      inputFor(baseJob()),
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe(
      `https://api.telegram.org/bot${encodeURIComponent(BOT_TOKEN)}/sendMessage`,
    );
    expect(captured[0]!.body).toMatchObject({
      chat_id: CHAT_ID,
      text: "Hello Telegram",
    });
    expect(result.externalPostId).toBe("4242");
    expect(result.safeMetadata).toMatchObject({
      destination: "TELEGRAM_MESSAGE",
      messageId: 4242,
      idempotencyKey: "idem-1",
    });
  });

  it("sends a single image via sendPhoto with caption = text", async () => {
    const job = baseJob({
      contentType: "IMAGE",
      payload: {
        text: "Look at this",
        mediaUrls: ["https://cdn.example.com/photo.jpg"],
      },
    });
    const result = await telegramPublishingAdapter.publish(inputFor(job));

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toContain("/sendPhoto");
    expect(captured[0]!.body).toMatchObject({
      chat_id: CHAT_ID,
      photo: "https://cdn.example.com/photo.jpg",
      caption: "Look at this",
    });
    expect(result.externalPostId).toBe("4242");
  });

  it("sends a single video via sendVideo with caption = text", async () => {
    const job = baseJob({
      contentType: "SHORT_VIDEO",
      payload: {
        text: "Watch this",
        mediaUrls: ["https://cdn.example.com/clip.mp4"],
      },
    });
    await telegramPublishingAdapter.publish(inputFor(job));

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toContain("/sendVideo");
    expect(captured[0]!.body).toMatchObject({
      video: "https://cdn.example.com/clip.mp4",
      caption: "Watch this",
    });
  });

  it("pre-checks idempotency: replays a recorded message_id without HTTP", async () => {
    const job = baseJob({ externalPostId: "9999" });
    const result = await telegramPublishingAdapter.publish(inputFor(job));

    expect(captured).toHaveLength(0);
    expect(result.externalPostId).toBe("9999");
    expect(result.safeMetadata).toMatchObject({ idempotentReplay: true });
  });

  it("never includes the bot token in the result or metadata", async () => {
    const result = await telegramPublishingAdapter.publish(
      inputFor(baseJob()),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(BOT_TOKEN);
    expect(Object.keys(result.safeMetadata ?? {})).not.toContain("botToken");
    expect(Object.keys(result.safeMetadata ?? {})).not.toContain("accessToken");
  });

  it("fails closed when the connector has no destination chat", async () => {
    const input = {
      ...inputFor(baseJob()),
      connectorMetadata: {},
    };
    await expect(telegramPublishingAdapter.publish(input)).rejects.toBeInstanceOf(
      SocialPublishingAdapterError,
    );
    await expect(telegramPublishingAdapter.publish(input)).rejects.toMatchObject({
      code: "TELEGRAM_DESTINATION_NOT_CONFIGURED",
    });
    expect(captured).toHaveLength(0);
  });

  it("fails closed when the bot token is missing", async () => {
    const input = { ...inputFor(baseJob()), accessToken: "" };
    await expect(telegramPublishingAdapter.publish(input)).rejects.toMatchObject({
      code: "TELEGRAM_BOT_TOKEN_MISSING",
    });
    expect(captured).toHaveLength(0);
  });

  it("marks the connector for reauthorization on Telegram 401", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 401,
          description: "Unauthorized",
        }),
        { status: 401 },
      )) as typeof globalThis.fetch;
    await expect(
      telegramPublishingAdapter.publish(inputFor(baseJob())),
    ).rejects.toMatchObject({
      code: "TELEGRAM_PROVIDER_401",
      options: { reauthorizationRequired: true },
    });
  });

  it("resolves the destination from connector metadata only", () => {
    expect(resolveTelegramDestination({ telegramChatId: CHAT_ID })).toMatchObject({
      chatId: CHAT_ID,
    });
    expect(resolveTelegramDestination({})).toBeNull();
    expect(resolveTelegramDestination(undefined)).toBeNull();
  });
});
