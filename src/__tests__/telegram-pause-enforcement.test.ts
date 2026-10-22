import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: sql.query } }));
vi.mock("@prisma/client", () => ({
  Prisma: { sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }) },
}));
vi.mock("@/lib/tokmetric/security", () => ({
  TokMetricError: class TokMetricError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
}));
vi.mock("@/lib/social-media/oauth/config", () => ({
  socialOAuthProviders: ["META", "X", "LINKEDIN", "YOUTUBE", "NEXTDOOR", "TIKTOK"],
}));

import {
  getPausedSocialProviders,
  parseSocialPauseProvider,
} from "@/lib/social-media/oauth/provider-pause";
import { persistentProviderPauseState } from "@/lib/social-media/publishing/pause";

describe("Telegram persistent provider pause", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supports Telegram as a pause-only provider without treating it as OAuth", () => {
    expect(parseSocialPauseProvider("telegram")).toBe("TELEGRAM");
    expect(parseSocialPauseProvider("meta")).toBe("META");
    expect(() => parseSocialPauseProvider("untrusted")).toThrow(/Unsupported social pause provider/);
  });

  it("can enumerate an existing Telegram pause", async () => {
    sql.query.mockResolvedValueOnce([{ provider: "TELEGRAM" }]);
    await expect(getPausedSocialProviders("workspace-1")).resolves.toContain("TELEGRAM");
  });

  it("stops already queued Telegram publishing jobs for a persisted pause", async () => {
    sql.query.mockResolvedValueOnce([{ one: 1 }]);
    await expect(persistentProviderPauseState("workspace-1", "TELEGRAM")).resolves.toMatchObject({
      paused: true,
    });
    expect(sql.query).toHaveBeenCalledOnce();
  });

  it("maps Facebook and Instagram publishing to the shared Meta pause key", async () => {
    sql.query.mockResolvedValueOnce([{ one: 1 }]);
    const state = await persistentProviderPauseState("workspace-1", "FACEBOOK_PAGE");
    expect(state.paused).toBe(true);
    const parsedQuery = sql.query.mock.calls[0][0];
    expect(parsedQuery.values).toContain("META");
  });

  it("fails closed if the persistent pause table is unavailable", async () => {
    sql.query.mockRejectedValueOnce(new Error("social_provider_pauses does not exist"));
    await expect(persistentProviderPauseState("workspace-1", "TELEGRAM")).rejects.toThrow();
  });

  it("enforces persistence checks before the external publishing adapter", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/social-media/publishing/worker.ts"), "utf8");
    const pause = source.indexOf("await persistentProviderPauseState(");
    const publish = source.indexOf("await adapter.publish(");
    expect(pause).toBeGreaterThan(0);
    expect(publish).toBeGreaterThan(pause);
  });

  it("accepts Telegram in both operator pause and unpause routes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/social-media/connectors/[id]/pause/route.ts"), "utf8",
    );
    expect(source.split("parseSocialPauseProvider(rawProvider)").length - 1).toBe(2);
  });
});
