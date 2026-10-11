/**
 * Per-workspace Nextdoor publish endpoint configuration.
 *
 * Nextdoor publishing stays BLOCKED until a human operator explicitly approves
 * a Publish API endpoint for the workspace's connector. The URL template is
 * encrypted server-side with SOCIAL_TOKEN_ENCRYPTION_KEY before it is stored
 * on the connector's safe_metadata, because generic connector list responses
 * spread safe_metadata to the browser. Only the ciphertext ever leaves the
 * server; the plaintext template exists solely in server memory during
 * validation and dispatch. Templates are validated to contain the
 * {profileId} placeholder and use HTTPS. This module is the single place that
 * validates, encrypts, and resolves them.
 */
import crypto from "node:crypto";
import { SocialPublishingAdapterError } from "./errors";

export const NEXTDOOR_CONFIG_KEY = "nextdoorPublishConfig";

/** Persisted record. Only the ciphertext is ever stored or transmitted. */
export interface StoredNextdoorPublishConfig {
  urlTemplateCiphertext: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

/** In-memory view. Plaintext exists only in server memory, never serialized. */
export interface NextdoorPublishConfig {
  urlTemplate: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

/** Backwards-compatible alias for the stored shape. */
export type NextdoorPublishConfigRecord = StoredNextdoorPublishConfig;

export interface ResolvedNextdoorEndpoint {
  endpoint: URL;
  approvedBy?: string;
  approvedAt?: string;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ---------------------------------------------------------------------------
// Server-side encryption for the URL template.
// ---------------------------------------------------------------------------

function nextdoorConfigEncryptionKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_CONFIG_ENCRYPTION_UNAVAILABLE",
      "Nextdoor endpoint configuration is unavailable: SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.",
    );
  }
  const decoded = Buffer.from(
    raw,
    /^[A-Fa-f0-9]{64}$/.test(raw) ? "hex" : "base64",
  );
  if (decoded.length === 32) return decoded;
  if (process.env.NODE_ENV === "production") {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_CONFIG_ENCRYPTION_UNAVAILABLE",
      "Nextdoor endpoint configuration is unavailable: SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes in production.",
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

const ENCRYPTED_PREFIX = "nd1.";

/** Encrypts a validated template. Ciphertext is safe to persist and transmit. */
export function encryptNextdoorUrlTemplate(template: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    nextdoorConfigEncryptionKey(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(template, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

/** Decrypts a stored template. Any failure is fail-closed: never dispatch. */
export function decryptNextdoorUrlTemplate(ciphertext: string): string {
  const fail = () =>
    new SocialPublishingAdapterError(
      "NEXTDOOR_CONFIG_DECRYPT_FAILED",
      "The stored Nextdoor endpoint could not be read; a workspace admin must re-approve it.",
    );
  if (typeof ciphertext !== "string" || !ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    throw fail();
  }
  const [, ivRaw, tagRaw, ciphertextRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw fail();
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      nextdoorConfigEncryptionKey(),
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw fail();
  }
}

/**
 * Validates a candidate URL template. Throws NEXTDOOR_PUBLISH_TEMPLATE_INVALID
 * with an operator-actionable message on any failure.
 */
export function validateNextdoorUrlTemplate(template: unknown): string {
  if (typeof template !== "string" || !template.trim()) {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_PUBLISH_TEMPLATE_INVALID",
      "Nextdoor publish URL template is required.",
    );
  }
  const trimmed = template.trim();
  if (!trimmed.includes("{profileId}")) {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_PUBLISH_TEMPLATE_INVALID",
      "Nextdoor publish URL template must contain the {profileId} placeholder.",
    );
  }
  const probe = trimmed.replace("{profileId}", "profile-id-probe");
  let parsed: URL;
  try {
    parsed = new URL(probe);
  } catch {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_PUBLISH_TEMPLATE_INVALID",
      "Nextdoor publish URL template must be a valid absolute URL.",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_PUBLISH_TEMPLATE_INVALID",
      "Nextdoor publish URL template must use HTTPS.",
    );
  }
  if (/\s/.test(trimmed)) {
    throw new SocialPublishingAdapterError(
      "NEXTDOOR_PUBLISH_TEMPLATE_INVALID",
      "Nextdoor publish URL template must not contain whitespace.",
    );
  }
  return trimmed;
}

export function readNextdoorPublishConfig(
  connectorMetadata: Record<string, unknown>,
): NextdoorPublishConfig | null {
  const raw = object(connectorMetadata[NEXTDOOR_CONFIG_KEY]);
  if (Object.keys(raw).length === 0) return null;
  // Only the encrypted shape is honored. Plaintext urlTemplate records (if
  // any were written before encryption) are ignored: the operator must
  // re-approve, which re-stores the template encrypted.
  if (typeof raw.urlTemplateCiphertext !== "string") return null;
  return {
    urlTemplate: decryptNextdoorUrlTemplate(raw.urlTemplateCiphertext),
    approved: raw.approved === true,
    approvedBy:
      typeof raw.approvedBy === "string" ? raw.approvedBy : undefined,
    approvedAt:
      typeof raw.approvedAt === "string" ? raw.approvedAt : undefined,
  };
}

/**
 * Resolves the concrete publish endpoint for a Nextdoor connector. Throws
 * NEXTDOOR_PUBLISH_ENDPOINT_NOT_APPROVED (BLOCKED semantics) unless a
 * human-approved template is configured; the error message always names the
 * HUMAN_REQUIRED operator action.
 */
export function resolveNextdoorPublishEndpoint(input: {
  connectorMetadata: Record<string, unknown>;
  externalAccountId: string;
}): ResolvedNextdoorEndpoint {
  const configured = readNextdoorPublishConfig(input.connectorMetadata);
  const legacyTemplate = process.env.NEXTDOOR_PUBLISH_URL_TEMPLATE?.trim();
  const template = configured?.urlTemplate || legacyTemplate;

  const notApproved = (detail: string) =>
    new SocialPublishingAdapterError(
      "NEXTDOOR_PUBLISH_ENDPOINT_NOT_APPROVED",
      `Nextdoor publishing is blocked: ${detail} (HUMAN_REQUIRED: a workspace admin must approve the Nextdoor Publish API endpoint on the connector before any post can dispatch.)`,
    );

  if (!template) {
    throw notApproved("no publish endpoint template is configured");
  }
  const validated = (() => {
    try {
      return validateNextdoorUrlTemplate(template);
    } catch (error) {
      if (error instanceof SocialPublishingAdapterError) {
        throw notApproved(`the configured template is invalid: ${error.message}`);
      }
      throw error;
    }
  })();
  const approved = configured?.approved === true;
  if (!approved) {
    throw notApproved(
      "the endpoint template exists but has not been explicitly approved",
    );
  }

  const endpoint = new URL(
    validated.replace("{profileId}", encodeURIComponent(input.externalAccountId)),
  );
  return {
    endpoint,
    approvedBy: configured?.approvedBy,
    approvedAt: configured?.approvedAt,
  };
}

/** Validates, encrypts, and builds the server-side config record. */
export function buildNextdoorPublishConfig(input: {
  urlTemplate: string;
  approvedBy: string;
}): StoredNextdoorPublishConfig {
  return {
    urlTemplateCiphertext: encryptNextdoorUrlTemplate(
      validateNextdoorUrlTemplate(input.urlTemplate),
    ),
    approved: true,
    approvedBy: input.approvedBy,
    approvedAt: new Date().toISOString(),
  };
}
