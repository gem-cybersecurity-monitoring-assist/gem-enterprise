import { createHmac, timingSafeEqual } from "node:crypto";

const GITHUB_SHA256_PREFIX = "sha256=";

export const SUPPORTED_GITHUB_EVENTS = new Set([
  "installation",
  "installation_repositories",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "push",
  "check_run",
  "check_suite",
  "workflow_run",
  "deployment",
  "deployment_status",
  "repository",
  "security_advisory",
]);

export type GitHubWebhookVerification =
  | { ok: true; deliveryId: string; event: string }
  | { ok: false; status: 400 | 401 | 503; error: string };

function webhookSecret(): string | null {
  const value = process.env.GITHUB_APP_WEBHOOK_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function verifyGitHubWebhook(params: {
  rawBody: string;
  signature: string | null;
  deliveryId: string | null;
  event: string | null;
}): GitHubWebhookVerification {
  const secret = webhookSecret();
  if (!secret) {
    return { ok: false, status: 503, error: "GitHub App webhook secret is not configured." };
  }

  const { rawBody, signature, deliveryId, event } = params;
  if (!signature?.startsWith(GITHUB_SHA256_PREFIX)) {
    return { ok: false, status: 401, error: "Missing or invalid GitHub webhook signature." };
  }
  if (!deliveryId || !event) {
    return { ok: false, status: 400, error: "Missing GitHub delivery metadata." };
  }

  const expected = `${GITHUB_SHA256_PREFIX}${createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;
  const suppliedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return { ok: false, status: 401, error: "GitHub webhook signature verification failed." };
  }

  if (!SUPPORTED_GITHUB_EVENTS.has(event)) {
    return { ok: false, status: 400, error: `Unsupported GitHub event: ${event}` };
  }

  return { ok: true, deliveryId, event };
}

export function getGitHubAppConfigurationStatus() {
  return {
    appIdConfigured: Boolean(process.env.GITHUB_APP_ID?.trim()),
    privateKeyConfigured: Boolean(process.env.GITHUB_APP_PRIVATE_KEY?.trim()),
    webhookSecretConfigured: Boolean(webhookSecret()),
    clientIdConfigured: Boolean(process.env.GITHUB_APP_CLIENT_ID?.trim()),
    clientSecretConfigured: Boolean(process.env.GITHUB_APP_CLIENT_SECRET?.trim()),
    writeOperationsEnabled: false,
    mode: "read_only_webhook_ingestion" as const,
  };
}
