import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  normalizeTelegramBotToken,
  normalizeTelegramChatId,
} from "@/lib/social-media/providers/telegram/connector";
import {
  accountTypeMatches,
  connectorProviderMatches,
  missingPublishingScopes,
} from "@/lib/social-media/publishing/gates";
import { verifySocialPublication } from "@/lib/social-media/publishing/verification";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Telegram connector input normalization", () => {
  it("accepts a BotFather token and rejects malformed ones", () => {
    const token = "1234567890:AAH" + "x".repeat(32);
    expect(normalizeTelegramBotToken(`  ${token} `)).toBe(token);
    expect(() => normalizeTelegramBotToken("not-a-token")).toThrow();
    expect(() => normalizeTelegramBotToken("123:short")).toThrow();
  });

  it("normalizes handles, t.me links, and numeric ids", () => {
    expect(normalizeTelegramChatId("@mycybersecureWealthsolution")).toBe("@mycybersecureWealthsolution");
    expect(normalizeTelegramChatId("mycybersecureWealthsolution")).toBe("@mycybersecureWealthsolution");
    expect(normalizeTelegramChatId("https://t.me/mycybersecureWealthsolution")).toBe("@mycybersecureWealthsolution");
    expect(normalizeTelegramChatId("-1001234567890")).toBe("-1001234567890");
    expect(() => normalizeTelegramChatId("@a")).toThrow();
    expect(() => normalizeTelegramChatId("https://evil.example/x")).toThrow();
  });
});

describe("Telegram publishing gates", () => {
  it("requires no OAuth scopes and matches the Telegram connector and chat account type", () => {
    expect(missingPublishingScopes("TELEGRAM", [])).toEqual([]);
    expect(connectorProviderMatches("TELEGRAM", "TELEGRAM")).toBe(true);
    expect(accountTypeMatches("TELEGRAM", { accountType: "TELEGRAM_CHAT" })).toBe(true);
    expect(accountTypeMatches("TELEGRAM", { accountType: "META_PAGE" })).toBe(false);
  });

  it("treats a successful Telegram send as verified without a read-back call", async () => {
    const result = await verifySocialPublication({ provider: "TELEGRAM", accessToken: "t", externalPostId: "42" });
    expect(result.verificationOk).toBe(true);
    expect(result.method).toBe("NOT_APPLICABLE");
  });
});

describe("Telegram connector wiring", () => {
  it("dispatches through the publishing loader that understands bot-token connectors", () => {
    const worker = source("src/lib/social-media/publishing/worker.ts");
    expect(worker).toContain("loadPublishingConnectorCredential({");
    expect(worker).not.toContain("loadSocialConnectorCredential({");
  });

  it("never returns the bot token from the connect route", () => {
    const route = source("src/app/api/social-media/connectors/telegram/route.ts");
    expect(route).toContain("requireSameOrigin(request)");
    expect(route).toContain('requirePermission(membership, "manage", "connectors")');
    const responseBlock = route.slice(route.indexOf("NextResponse.json("));
    expect(responseBlock).not.toMatch(/botToken\s*[,:}]/);
  });

  it("lets bot-token connectors be disconnected without an OAuth revocation", () => {
    const connectors = source("src/lib/social-media/oauth/connectors.ts");
    expect(connectors).toContain('error.code !== "UNSUPPORTED_SOCIAL_PROVIDER"');
  });
});
