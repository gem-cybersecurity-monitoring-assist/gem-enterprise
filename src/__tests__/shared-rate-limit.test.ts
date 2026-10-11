import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const config = { key: "auth:login", max: 2, windowMs: 60_000 };
function configure() {
  vi.stubEnv("GEM_RATE_LIMIT_REDIS_URL", "https://redis.example.invalid");
  vi.stubEnv("GEM_RATE_LIMIT_REDIS_TOKEN", "test-only-credential");
}

describe("shared atomic rate limiting", () => {
  it("shares counts across independent calls and does not transmit raw identifiers", async () => {
    configure();
    let count = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ result: [++count, 59_000] }));
    vi.stubGlobal("fetch", fetcher);
    expect((await rateLimit("private@example.invalid", config)).ok).toBe(true);
    expect((await rateLimit("private@example.invalid", config)).ok).toBe(true);
    const blocked = await rateLimit("private@example.invalid", config);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(body[0]).toBe("EVAL");
    expect(body[1]).toContain("PEXPIRE");
    expect(body[3]).toMatch(/^gem:rate:[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toContain("private@example.invalid");
  });

  it("fails closed without a shared configuration when required", async () => {
    vi.stubEnv("GEM_RATE_LIMIT_SHARED_REQUIRED", "true");
    vi.stubEnv("GEM_RATE_LIMIT_REDIS_URL", "");
    vi.stubEnv("GEM_RATE_LIMIT_REDIS_TOKEN", "");
    const result = await rateLimit("caller", config);
    expect(result).toMatchObject({ ok: false, unavailable: true });
    expect(rateLimitedResponse(result.retryAfterSeconds, result.unavailable).status).toBe(503);
  });

  it.each([new Response("denied", { status: 403 }), Response.json({ result: [1, -1] }), Response.json({ result: "invalid" })])(
    "does not fall back to local counters on upstream failure or malformed results",
    async (response) => {
      configure();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      expect(await rateLimit("caller", config)).toMatchObject({ ok: false, unavailable: true });
    },
  );

  it("rejects insecure endpoints without sending credentials", async () => {
    configure();
    vi.stubEnv("GEM_RATE_LIMIT_REDIS_URL", "http://redis.example.invalid");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await rateLimit("caller", config)).unavailable).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
