import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyGitHubWebhook } from "@/lib/github-app";

const originalSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.GITHUB_APP_WEBHOOK_SECRET;
  else process.env.GITHUB_APP_WEBHOOK_SECRET = originalSecret;
});

describe("verifyGitHubWebhook", () => {
  it("fails closed when the webhook secret is unavailable", () => {
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;

    expect(
      verifyGitHubWebhook({
        rawBody: "{}",
        signature: "sha256=invalid",
        deliveryId: "delivery-1",
        event: "push",
      }),
    ).toEqual({
      ok: false,
      status: 503,
      error: "GitHub App webhook secret is not configured.",
    });
  });

  it("accepts a correctly signed supported event", () => {
    const secret = "a-secure-test-webhook-secret-that-is-long-enough";
    const rawBody = JSON.stringify({ repository: { full_name: "support371/gem-enterprise" } });
    process.env.GITHUB_APP_WEBHOOK_SECRET = secret;
    const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    expect(
      verifyGitHubWebhook({
        rawBody,
        signature,
        deliveryId: "delivery-2",
        event: "pull_request",
      }),
    ).toEqual({ ok: true, deliveryId: "delivery-2", event: "pull_request" });
  });

  it("rejects an invalid signature", () => {
    process.env.GITHUB_APP_WEBHOOK_SECRET =
      "a-secure-test-webhook-secret-that-is-long-enough";

    const result = verifyGitHubWebhook({
      rawBody: "{}",
      signature: `sha256=${"0".repeat(64)}`,
      deliveryId: "delivery-3",
      event: "push",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "GitHub webhook signature verification failed.",
    });
  });

  it("rejects events outside the explicit allowlist", () => {
    const secret = "a-secure-test-webhook-secret-that-is-long-enough";
    const rawBody = "{}";
    process.env.GITHUB_APP_WEBHOOK_SECRET = secret;
    const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    const result = verifyGitHubWebhook({
      rawBody,
      signature,
      deliveryId: "delivery-4",
      event: "unknown_event",
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Unsupported GitHub event: unknown_event",
    });
  });
});
