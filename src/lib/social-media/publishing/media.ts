/**
 * Server-side media fetch helpers for the governed social publishing worker.
 *
 * Media URLs always come from operator-approved content versions, and bytes are
 * only ever downloaded server-side (never proxied through the browser) before
 * being pushed to a provider's certified upload endpoint. Secrets are never
 * included in URLs; the helpers only enforce HTTPS and size caps.
 */
import { SocialPublishingAdapterError } from "./errors";

export interface FetchedMedia {
  bytes: Uint8Array;
  contentType: string;
  byteLength: number;
  sourceUrl: string;
}

export function requireHttpsMediaUrl(value: string | undefined, field: string) {
  if (!value) {
    throw new SocialPublishingAdapterError(
      "MEDIA_URL_REQUIRED",
      `${field} is required for media publishing.`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new SocialPublishingAdapterError(
      "INVALID_MEDIA_URL",
      `${field} must be a valid HTTPS URL.`,
    );
  }
  if (parsed.protocol !== "https:") {
    throw new SocialPublishingAdapterError(
      "INVALID_MEDIA_URL",
      `${field} must use HTTPS.`,
    );
  }
  return parsed.toString();
}

const DOWNLOAD_TIMEOUT_MS = 90_000;

function sniffContentType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return "image/gif";
    }
    if (
      bytes.length >= 12 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return "video/mp4";
    }
    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return "video/webm";
    }
    if (
      bytes[8] === 0x57 &&
      bytes[9] === 0x41 &&
      bytes[10] === 0x56 &&
      bytes[11] === 0x45
    ) {
      return "video/x-msvideo";
    }
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }
  }
  return undefined;
}

export function mediaKind(contentType: string): "image" | "video" | "unknown" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "unknown";
}

/**
 * Downloads approved media bytes server-side with a hard size cap. The cap is
 * enforced while streaming so an oversized response can never be buffered.
 */
export async function fetchMediaBytes(input: {
  url: string;
  field: string;
  maxBytes: number;
  provider: string;
}): Promise<FetchedMedia> {
  const sourceUrl = requireHttpsMediaUrl(input.url, input.field);
  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch {
    throw new SocialPublishingAdapterError(
      `${input.provider}_MEDIA_DOWNLOAD_UNAVAILABLE`,
      "The approved media could not be downloaded for upload.",
      { retryable: true },
    );
  }
  if (!response.ok || !response.body) {
    throw new SocialPublishingAdapterError(
      `${input.provider}_MEDIA_DOWNLOAD_FAILED`,
      `The approved media download failed (HTTP ${response.status}).`,
      {
        retryable: response.status === 429 || response.status >= 500,
        providerStatusCode: response.status,
      },
    );
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
    await response.body.cancel().catch(() => undefined);
    throw new SocialPublishingAdapterError(
      `${input.provider}_MEDIA_TOO_LARGE`,
      `Approved media exceeds the ${input.maxBytes}-byte upload cap.`,
    );
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > input.maxBytes) {
        throw new SocialPublishingAdapterError(
          `${input.provider}_MEDIA_TOO_LARGE`,
          `Approved media exceeds the ${input.maxBytes}-byte upload cap.`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof SocialPublishingAdapterError) throw error;
    throw new SocialPublishingAdapterError(
      `${input.provider}_MEDIA_DOWNLOAD_FAILED`,
      "The approved media download was interrupted.",
      { retryable: true },
    );
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (total === 0) {
    throw new SocialPublishingAdapterError(
      `${input.provider}_MEDIA_EMPTY`,
      "The approved media download returned no bytes.",
    );
  }

  const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
  const contentType =
    (headerType && headerType.includes("/") ? headerType : undefined) ??
    sniffContentType(bytes) ??
    "application/octet-stream";
  return { bytes, contentType, byteLength: total, sourceUrl };
}

export function envByteLimit(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}
