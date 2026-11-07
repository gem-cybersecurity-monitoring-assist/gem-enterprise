import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  db: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

// The sandbox cannot run `prisma generate` (engine download is blocked), so the
// generated client is absent. Tests double only the `Prisma.sql` template tag
// used by the raw-SQL stores; production code is untouched.
vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join("?"),
      values,
    }),
  },
}));

import { TokMetricError } from "@/lib/tokmetric/security";
import {
  isSocialBotTokenProvider,
  parseSocialConnectorProvider,
} from "@/lib/social-media/oauth/config";
import { encryptSocialCredential } from "@/lib/social-media/oauth/crypto";
import { disconnectSocialConnector } from "@/lib/social-media/oauth/connectors";
import { loadSocialConnectorCredential } from "@/lib/social-media/oauth/lifecycle-store";
import type { StoredSocialCredential } from "@/lib/social-media/oauth/store";

function stubEncryptionKey() {
  vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
}

function credentialRow(secretRef: string, provider: string) {
  return {
    id: "conn-telegram-1",
    workspaceId: "ws-1",
    provider,
    state: "CONNECTED",
    displayName: "Telegram Bot",
    externalAccountId: "-1003368597629",
    grantedScopes: [],
    safeMetadata: { telegramChatId: "-1003368597629" },
    lastHealthAt: null,
    disabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    secretRef,
    credentialExpiresAt: null,
    credentialRefreshExpiresAt: null,
    credentialRotatedAt: null,
  };
}

function telegramCredential(): StoredSocialCredential {
  return {
    provider: "TELEGRAM",
    accessToken: "test-bot-token",
    grantedScopes: [],
    externalAccountId: "-1003368597629",
  };
}

beforeEach(() => {
  stubEncryptionKey();
  dbMocks.db.$queryRaw.mockReset();
  dbMocks.db.$executeRaw.mockReset();
  dbMocks.db.$transaction.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseSocialConnectorProvider", () => {
  it("accepts bot-token providers alongside OAuth providers", () => {
    expect(parseSocialConnectorProvider("telegram")).toBe("TELEGRAM");
    expect(parseSocialConnectorProvider("meta")).toBe("META");
    expect(parseSocialConnectorProvider("X")).toBe("X");
  });

  it("still rejects unknown providers", () => {
    expect(() => parseSocialConnectorProvider("indeed")).toThrow("not supported");
  });

  it("identifies bot-token providers by family", () => {
    expect(isSocialBotTokenProvider("TELEGRAM")).toBe(true);
    expect(isSocialBotTokenProvider("telegram")).toBe(true);
    expect(isSocialBotTokenProvider("META")).toBe(false);
  });
});

describe("loadSocialConnectorCredential (bot-token providers)", () => {
  it("loads a Telegram connector and decrypts its bot token", async () => {
    const secretRef = encryptSocialCredential(telegramCredential());
    dbMocks.db.$queryRaw.mockResolvedValueOnce([credentialRow(secretRef, "TELEGRAM")]);

    const loaded = await loadSocialConnectorCredential({
      workspaceId: "ws-1",
      connectorId: "conn-telegram-1",
    });

    expect(loaded.connector.provider).toBe("TELEGRAM");
    expect(loaded.connector.externalAccountId).toBe("-1003368597629");
    expect(loaded.connector.safeMetadata).toEqual({ telegramChatId: "-1003368597629" });
    expect(loaded.credential.provider).toBe("TELEGRAM");
    expect(loaded.credential.accessToken).toBe("test-bot-token");
    expect(loaded.credentialRotatedAt).toBeNull();
  });

  it("still loads OAuth connectors unchanged", async () => {
    const stored: StoredSocialCredential = {
      provider: "X",
      accessToken: "x-access-token",
      grantedScopes: ["tweet.read"],
      externalAccountId: "x-user-1",
    };
    const secretRef = encryptSocialCredential(stored);
    dbMocks.db.$queryRaw.mockResolvedValueOnce([
      { ...credentialRow(secretRef, "X"), externalAccountId: "x-user-1" },
    ]);

    const loaded = await loadSocialConnectorCredential({
      workspaceId: "ws-1",
      connectorId: "conn-telegram-1",
    });

    expect(loaded.connector.provider).toBe("X");
    expect(loaded.credential.accessToken).toBe("x-access-token");
  });

  it("still rejects a credential whose provider does not match the connector", async () => {
    const stored: StoredSocialCredential = {
      provider: "META",
      accessToken: "meta-access-token",
      grantedScopes: [],
      externalAccountId: "-1003368597629",
    };
    const secretRef = encryptSocialCredential(stored);
    dbMocks.db.$queryRaw.mockResolvedValueOnce([credentialRow(secretRef, "TELEGRAM")]);

    await expect(
      loadSocialConnectorCredential({ workspaceId: "ws-1", connectorId: "conn-telegram-1" }),
    ).rejects.toMatchObject({ code: "SOCIAL_CONNECTOR_CREDENTIAL_MISMATCH" });
  });

  it("still rejects an unknown stored provider", async () => {
    const secretRef = encryptSocialCredential(telegramCredential());
    dbMocks.db.$queryRaw.mockResolvedValueOnce([credentialRow(secretRef, "INDEED")]);

    await expect(
      loadSocialConnectorCredential({ workspaceId: "ws-1", connectorId: "conn-telegram-1" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SOCIAL_PROVIDER" });
  });

  it("still reports a missing credential as not found", async () => {
    dbMocks.db.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      loadSocialConnectorCredential({ workspaceId: "ws-1", connectorId: "conn-telegram-1" }),
    ).rejects.toMatchObject({ code: "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND" });
  });
});

describe("disconnectSocialConnector (bot-token providers)", () => {
  it("disconnects a Telegram connector without provider-side revocation", async () => {
    const secretRef = encryptSocialCredential(telegramCredential());
    dbMocks.db.$queryRaw.mockResolvedValueOnce([credentialRow(secretRef, "TELEGRAM")]);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "conn-telegram-1" }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    dbMocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await disconnectSocialConnector({
      workspaceId: "ws-1",
      connectorId: "conn-telegram-1",
    });

    expect(result.connectorId).toBe("conn-telegram-1");
    expect(result.externalRevocationAttempted).toBe(true);
    // A bot token has no OAuth grant to revoke, so no provider call is made
    // and the outcome is recorded as not supported.
    expect(result.externalRevocationOutcome).toBe("not_supported");
    expect(fetchMock).not.toHaveBeenCalled();
    // Local credential deletion still runs inside the transaction.
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalled();
    const updateCall = tx.$queryRaw.mock.calls[0]![0] as { values: unknown[] };
    const metadataValue = updateCall.values.find(
      (value) => typeof value === "string" && value.includes("externalRevocationAttempted"),
    ) as string;
    expect(metadataValue).toBeDefined();
    const metadata = JSON.parse(metadataValue);
    expect(metadata.externalRevocationOutcome).toBe("not_supported");
  });

  it("still throws TokMetricError instances from the load unchanged", async () => {
    dbMocks.db.$queryRaw.mockRejectedValueOnce(
      new TokMetricError(400, "UNSUPPORTED_SOCIAL_PROVIDER", "Social OAuth provider is not supported."),
    );
    await expect(
      disconnectSocialConnector({ workspaceId: "ws-1", connectorId: "conn-telegram-1" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SOCIAL_PROVIDER" });
  });
});
