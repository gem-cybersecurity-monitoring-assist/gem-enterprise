/**
 * Social publishing gateway client.
 *
 * Covers the transport contract: the action union is exhaustive against the
 * edge-function dispatcher (a test that fails when an action is added on
 * either side but not the other), the machine secret travels only in the
 * Authorization bearer header and never appears in errors, the 60s timeout,
 * error-code passthrough, and the flag + health probe that gate the cron
 * routes and the readiness report.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT,
  isSocialPublishingGatewayAdapterEnabled,
  probeSocialPublishingGatewayAdapter,
  SOCIAL_PUBLISHING_GATEWAY_ACTIONS,
  socialPublishingGateway,
} from "@/lib/social-media/publishing/gateway-client";
import { GatewayRequestError } from "@/lib/supabase-gateway";

const TEST_SECRET = "test-adapter-secret-do-not-use-in-production";
const EDGE_FUNCTION_PATH =
  "supabase/functions/gem-social-publishing-gateway/index.ts";

// Phase 2 actions are reserved names in the edge-function dispatcher only;
// they are intentionally NOT in the client union (the autopilot service
// stays gateway-blocked in phase 1).
const PHASE2_RESERVED_ACTIONS = [
  "count_jobs",
  "fingerprint_check",
  "cancel_autopilot_jobs",
] as const;

function mockFetchResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("social publishing gateway client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SOCIAL_GATEWAY_ADAPTER_SECRET", TEST_SECRET);
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "false");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(mockFetchResponse(200, { ok: true }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("is exhaustive over the edge-function dispatcher actions", () => {
    const source = readFileSync(join(process.cwd(), EDGE_FUNCTION_PATH), "utf8");
    const dispatched = new Set(
      [...source.matchAll(/action === "([^"]+)"/g)]
        .map((match) => match[1])
        // The typeof guard (`typeof body.action === "string"`) is not a
        // dispatcher case.
        .filter((name) => name !== "string"),
    );
    // Every client action has a dispatcher case.
    for (const action of SOCIAL_PUBLISHING_GATEWAY_ACTIONS) {
      expect(dispatched.has(action)).toBe(true);
    }
    // Every dispatcher case is either a client action or a reserved
    // phase-2 name — nothing is implemented on one side only.
    for (const action of dispatched) {
      expect(
        (SOCIAL_PUBLISHING_GATEWAY_ACTIONS as readonly string[]).includes(
          action,
        ) ||
          (PHASE2_RESERVED_ACTIONS as readonly string[]).includes(action),
      ).toBe(true);
    }
    expect(SOCIAL_PUBLISHING_GATEWAY_ACTIONS).toHaveLength(14);
    expect(EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT).toBe(14);
  });

  it("sends the machine secret as a bearer header and the anon key as apikey", async () => {
    await socialPublishingGateway("health", {});

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toContain("/gem-social-publishing-gateway");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_SECRET}`);
    expect(typeof headers.apikey).toBe("string");
    expect(headers.apikey.length).toBeGreaterThan(0);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(String(init.body))).toMatchObject({ action: "health" });
  });

  it("fails closed without calling the gateway when the secret is missing", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_ADAPTER_SECRET", "");
    await expect(socialPublishingGateway("health", {})).rejects.toMatchObject({
      code: "SOCIAL_GATEWAY_ADAPTER_NOT_CONFIGURED",
      statusCode: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never exposes the machine secret in an error", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(401, { error: "Adapter authentication failed", code: "UNAUTHORIZED" }),
    );
    let caught: unknown;
    try {
      await socialPublishingGateway("health", {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GatewayRequestError);
    expect((caught as GatewayRequestError).statusCode).toBe(401);
    expect((caught as GatewayRequestError).code).toBe("UNAUTHORIZED");
    expect(String((caught as Error).message)).not.toContain(TEST_SECRET);
    expect(JSON.stringify(caught)).not.toContain(TEST_SECRET);
  });

  it("passes the RPC error code through unchanged", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(409, {
        error: "The publishing job claim expired before completion.",
        code: "SOCIAL_PUBLISHING_CLAIM_LOST",
      }),
    );
    await expect(socialPublishingGateway("mark_published", {})).rejects.toMatchObject({
      statusCode: 409,
      code: "SOCIAL_PUBLISHING_CLAIM_LOST",
    });
  });

  it("times out after 60s", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    const pending = socialPublishingGateway("health", {});
    const assertion = expect(pending).rejects.toMatchObject({
      statusCode: 504,
      code: "GATEWAY_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });

  it("maps a network failure to GATEWAY_UNAVAILABLE", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    await expect(socialPublishingGateway("health", {})).rejects.toMatchObject({
      statusCode: 503,
      code: "GATEWAY_UNAVAILABLE",
    });
  });

  it("reports the adapter flag from the environment", () => {
    expect(isSocialPublishingGatewayAdapterEnabled()).toBe(false);
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "true");
    expect(isSocialPublishingGatewayAdapterEnabled()).toBe(true);
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "yes");
    expect(isSocialPublishingGatewayAdapterEnabled()).toBe(false);
  });

  it("probe returns false when the flag is off without calling the gateway", async () => {
    expect(await probeSocialPublishingGatewayAdapter()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probe returns true only when the health action reports the full RPC inventory", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "true");
    fetchMock.mockResolvedValue(
      mockFetchResponse(200, { ok: true, rpcCount: 14 }),
    );
    expect(await probeSocialPublishingGatewayAdapter()).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(JSON.parse(String(init.body))).toMatchObject({ action: "health" });
  });

  it("probe returns false on a partial migration", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "true");
    fetchMock.mockResolvedValue(
      mockFetchResponse(200, { ok: true, rpcCount: 5 }),
    );
    expect(await probeSocialPublishingGatewayAdapter()).toBe(false);
  });

  it("probe returns false when the gateway errors", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "true");
    fetchMock.mockResolvedValue(
      mockFetchResponse(503, { error: "Unavailable", code: "GATEWAY_UNAVAILABLE" }),
    );
    expect(await probeSocialPublishingGatewayAdapter()).toBe(false);
  });

  it("probe returns false when the secret is missing", async () => {
    vi.stubEnv("SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED", "true");
    vi.stubEnv("SOCIAL_GATEWAY_ADAPTER_SECRET", "");
    expect(await probeSocialPublishingGatewayAdapter()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
