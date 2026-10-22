/**
 * Certified media upload pipelines for the governed social publishing worker.
 *
 * Each function performs the provider's real, approved binary upload flow:
 * - X: media/upload INIT -> APPEND -> FINALIZE (+ STATUS polling for video)
 * - LinkedIn: registerUpload -> PUT binary -> media URN referenced in the post
 * - YouTube: resumable videos.insert session -> PUT bytes -> videos.list poll
 *
 * All bytes come from operator-approved HTTPS media URLs downloaded server-side
 * (see media.ts). No OAuth/API-evading machinery is used anywhere; every call
 * is an officially documented provider endpoint with the connector's OAuth
 * bearer token.
 */
import { SocialPublishingAdapterError } from "./errors";
import {
  envByteLimit,
  fetchMediaBytes,
  mediaKind,
} from "./media";

const REQUEST_TIMEOUT_MS = 30_000;

type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function responsePayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return object(JSON.parse(text));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// X (two-phase chunked media upload)
// ---------------------------------------------------------------------------

const X_UPLOAD_BASE = "https://upload.twitter.com/1.1/media/upload.json";
const X_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const X_MAX_VIDEO_BYTES = 512 * 1024 * 1024;
const X_APPEND_CHUNK_BYTES = 4 * 1024 * 1024;

async function xMediaCommand(input: {
  accessToken: string;
  params: Record<string, string>;
  multipart?: { field: string; bytes: Uint8Array; filename: string; contentType: string };
}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input.params)) {
    form.append(key, value);
  }
  if (input.multipart) {
    // Copy first so .buffer starts at byteOffset 0 (Blob takes the whole
    // buffer); the view itself may be a subarray of a larger ArrayBuffer.
    const bytes = input.multipart.bytes.slice();
    form.append(
      input.multipart.field,
      new Blob([bytes.buffer as ArrayBuffer], {
        type: input.multipart.contentType,
      }),
      input.multipart.filename,
    );
  }
  const response = await fetch(X_UPLOAD_BASE, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "X_MEDIA_UPLOAD_UNAVAILABLE",
      "X media upload is temporarily unavailable.",
      { retryable: true },
    );
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    const nested = object(payload.error ?? payload.errors);
    const providerCode =
      stringValue(nested.code) ??
      stringValue(object(Array.isArray(payload.errors) ? payload.errors[0] : undefined).code) ??
      String(response.status);
    const forbidden = response.status === 401 || response.status === 403;
    throw new SocialPublishingAdapterError(
      `X_MEDIA_UPLOAD_${providerCode}`,
      forbidden
        ? "X rejected the media upload: the app lacks media upload permission (HUMAN_REQUIRED: enable media upload on the X app or connect with OAuth 1.0a user context)."
        : response.status === 429 || response.status >= 500
          ? "X media upload is temporarily unavailable."
          : "X rejected the media upload request.",
      {
        retryable: !forbidden && (response.status === 429 || response.status >= 500),
        providerStatusCode: response.status,
        safeMetadata: { providerCode },
      },
    );
  }
  return payload;
}

async function xPollVideoProcessing(input: {
  accessToken: string;
  mediaId: string;
}): Promise<void> {
  const deadline = Date.now() + 120_000;
  const baseWaitMs =
    Number(process.env.X_MEDIA_PROCESSING_POLL_MS) > 0
      ? Number(process.env.X_MEDIA_PROCESSING_POLL_MS)
      : 5_000;
  let waitMs = baseWaitMs;
  for (;;) {
    const payload = await xMediaCommand({
      accessToken: input.accessToken,
      params: { command: "STATUS", media_id: input.mediaId },
    });
    const info = object(payload.processing_info);
    const state = stringValue(info.state);
    if (state === "succeeded") return;
    if (state === "failed") {
      const error = object(info.error);
      throw new SocialPublishingAdapterError(
        "X_MEDIA_PROCESSING_FAILED",
        `X failed to process the uploaded video${stringValue(error.message) ? `: ${error.message}` : "."}`,
        { safeMetadata: { mediaId: input.mediaId } },
      );
    }
    if (Date.now() >= deadline) {
      throw new SocialPublishingAdapterError(
        "X_MEDIA_PROCESSING_TIMEOUT",
        "X did not finish processing the uploaded video in time.",
        { retryable: true, safeMetadata: { mediaId: input.mediaId } },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    waitMs = Math.min(waitMs * 1.5, 15_000);
  }
}

export interface XUploadedMedia {
  mediaId: string;
  kind: "image" | "video";
  byteLength: number;
}

/**
 * Uploads one approved media asset to X via INIT -> APPEND -> FINALIZE.
 * Videos are polled until X reports processing succeeded.
 */
export async function uploadMediaToX(input: {
  accessToken: string;
  mediaUrl: string;
  field: string;
}): Promise<XUploadedMedia> {
  const maxBytes = Math.min(
    envByteLimit("X_MEDIA_MAX_BYTES", X_MAX_VIDEO_BYTES),
    X_MAX_VIDEO_BYTES,
  );
  const media = await fetchMediaBytes({
    url: input.mediaUrl,
    field: input.field,
    maxBytes,
    provider: "X",
  });
  const kind = mediaKind(media.contentType);
  if (kind === "unknown") {
    throw new SocialPublishingAdapterError(
      "X_MEDIA_TYPE_UNSUPPORTED",
      `X media upload requires an image or video file (detected: ${media.contentType}).`,
    );
  }
  if (kind === "image" && media.byteLength > X_MAX_IMAGE_BYTES) {
    throw new SocialPublishingAdapterError(
      "X_MEDIA_TOO_LARGE",
      "X images must be 5 MB or smaller.",
    );
  }

  const init = await xMediaCommand({
    accessToken: input.accessToken,
    params: {
      command: "INIT",
      total_bytes: String(media.byteLength),
      media_type: media.contentType,
      media_category: kind === "video" ? "tweet_video" : "tweet_image",
    },
  });
  const mediaId = stringValue(init.media_id_string);
  if (!mediaId) {
    throw new SocialPublishingAdapterError(
      "X_MEDIA_INIT_INVALID",
      "X did not return a media identifier for the upload session.",
    );
  }

  const chunks = Math.max(1, Math.ceil(media.byteLength / X_APPEND_CHUNK_BYTES));
  for (let segment = 0; segment < chunks; segment += 1) {
    const start = segment * X_APPEND_CHUNK_BYTES;
    const end = Math.min(start + X_APPEND_CHUNK_BYTES, media.byteLength);
    await xMediaCommand({
      accessToken: input.accessToken,
      params: {
        command: "APPEND",
        media_id: mediaId,
        segment_index: String(segment),
      },
      multipart: {
        field: "media",
        bytes: media.bytes.subarray(start, end),
        filename: `segment-${segment}`,
        contentType: media.contentType,
      },
    });
  }

  const finalized = await xMediaCommand({
    accessToken: input.accessToken,
    params: { command: "FINALIZE", media_id: mediaId },
  });
  const processingInfo = object(finalized.processing_info);
  if (processingInfo.state) {
    await xPollVideoProcessing({ accessToken: input.accessToken, mediaId });
  }
  return { mediaId, kind, byteLength: media.byteLength };
}

// ---------------------------------------------------------------------------
// LinkedIn (registerUpload -> PUT binary -> ugcPost)
// ---------------------------------------------------------------------------

const LINKEDIN_V2_BASE = "https://api.linkedin.com/v2";

async function linkedInV2(input: {
  accessToken: string;
  method: "POST" | "GET";
  path: string;
  body?: unknown;
}) {
  const response = await fetch(`${LINKEDIN_V2_BASE}${input.path}`, {
    method: input.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "LINKEDIN_REQUEST_UNAVAILABLE",
      "LinkedIn is temporarily unavailable.",
      { retryable: true },
    );
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    const providerCode =
      stringValue(object(payload.error).code) ??
      stringValue(payload.code) ??
      String(response.status);
    const reauth = response.status === 401 || response.status === 403;
    throw new SocialPublishingAdapterError(
      `LINKEDIN_MEDIA_UPLOAD_${providerCode}`,
      reauth
        ? "LinkedIn authorization is no longer valid for media upload."
        : response.status === 429 || response.status >= 500
          ? "LinkedIn media upload is temporarily unavailable."
          : "LinkedIn rejected the media upload request.",
      {
        retryable: !reauth && (response.status === 429 || response.status >= 500),
        reauthorizationRequired: reauth,
        providerStatusCode: response.status,
        safeMetadata: { providerCode },
      },
    );
  }
  return payload;
}

/** Bounded poll until a registered video asset finishes provider-side processing. */
async function waitForLinkedInAssetAvailable(input: {
  accessToken: string;
  asset: string;
}) {
  const started = Date.now();
  for (;;) {
    const payload = await linkedInV2({
      accessToken: input.accessToken,
      method: "GET",
      path: `/assets/${encodeURIComponent(input.asset)}`,
    });
    const recipes = payload.recipes;
    const status = Array.isArray(recipes)
      ? stringValue(object(recipes[0]).status)
      : undefined;
    if (status === "AVAILABLE") return;
    if (status && status !== "PROCESSING" && status !== "WAITING_UPLOAD") {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_MEDIA_PROCESSING_FAILED",
        `LinkedIn media processing ended with status ${status}.`,
        { safeMetadata: { assetStatus: status } },
      );
    }
    if (Date.now() - started > 60_000) {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_MEDIA_PROCESSING_TIMEOUT",
        "LinkedIn media was still processing after 60 seconds.",
        { retryable: true },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

export interface LinkedInUploadedMedia {
  urn: string;
  kind: "image" | "video";
  byteLength: number;
}

/**
 * Registers a LinkedIn binary upload, PUTs the bytes to the returned upload
 * URL, and returns the media asset URN to reference in the ugcPost payload.
 */
export async function uploadMediaToLinkedIn(input: {
  accessToken: string;
  externalAccountId: string;
  mediaUrl: string;
  field: string;
  kind: "image" | "video";
}): Promise<LinkedInUploadedMedia> {
  const maxBytes = envByteLimit("LINKEDIN_MEDIA_MAX_BYTES", 10 * 1024 * 1024);
  const media = await fetchMediaBytes({
    url: input.mediaUrl,
    field: input.field,
    maxBytes,
    provider: "LINKEDIN",
  });
  const detected = mediaKind(media.contentType);
  if (detected !== input.kind) {
    throw new SocialPublishingAdapterError(
      "LINKEDIN_MEDIA_TYPE_MISMATCH",
      `LinkedIn ${input.kind} upload received ${media.contentType}.`,
    );
  }

  const owner = `urn:li:organization:${input.externalAccountId}`;
  const recipe =
    input.kind === "image"
      ? "urn:li:digitalmediaRecipe:feedshare-image"
      : "urn:li:digitalmediaRecipe:feedshare-video";
  const registered = await linkedInV2({
    accessToken: input.accessToken,
    method: "POST",
    path: "/assets?action=registerUpload",
    body: {
      registerUploadRequest: {
        recipes: [recipe],
        owner,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    },
  });
  const value = object(registered.value);
  const asset = stringValue(value.asset);
  const mechanism = object(value.uploadMechanism);
  const uploadRequest = object(
    mechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"],
  );
  const uploadUrl = stringValue(uploadRequest.uploadUrl);
  if (!asset || !uploadUrl) {
    throw new SocialPublishingAdapterError(
      "LINKEDIN_UPLOAD_REGISTER_INVALID",
      "LinkedIn did not return an upload URL and asset URN.",
    );
  }

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: media.bytes as unknown as BodyInit,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "LINKEDIN_BINARY_UPLOAD_UNAVAILABLE",
      "LinkedIn binary upload is temporarily unavailable.",
      { retryable: true },
    );
  });
  if (!put.ok) {
    throw new SocialPublishingAdapterError(
      "LINKEDIN_BINARY_UPLOAD_FAILED",
      `LinkedIn rejected the binary upload (HTTP ${put.status}).`,
      {
        retryable: put.status === 429 || put.status >= 500,
        providerStatusCode: put.status,
      },
    );
  }

  if (input.kind === "video") {
    await waitForLinkedInAssetAvailable({
      accessToken: input.accessToken,
      asset,
    });
  }
  return { urn: asset, kind: input.kind, byteLength: media.byteLength };
}

/** Builds a /v2/ugcPosts body for a text-only or single-media organization post. */
export function linkedInUgcPostBody(input: {
  author: string;
  commentary: string;
  mediaUrn?: string;
  mediaKind?: "image" | "video";
  mediaTitle?: string;
}) {
  const shareContent: Record<string, unknown> = {
    shareCommentary: { text: input.commentary },
    shareMediaCategory:
      input.mediaUrn == null
        ? "NONE"
        : input.mediaKind === "video"
          ? "VIDEO"
          : "IMAGE",
  };
  if (input.mediaUrn) {
    shareContent.media = [
      {
        status: "READY",
        description: { text: input.commentary },
        media: input.mediaUrn,
        ...(input.mediaTitle
          ? { title: { text: input.mediaTitle } }
          : {}),
      },
    ];
  }
  return {
    author: input.author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": shareContent,
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

// ---------------------------------------------------------------------------
// YouTube (resumable videos.insert)
// ---------------------------------------------------------------------------

const YOUTUBE_UPLOAD_BASE =
  "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export type YouTubePrivacyStatus = "public" | "unlisted" | "private";

export function youtubePrivacyStatus(
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE" | undefined,
): YouTubePrivacyStatus {
  if (visibility === "PUBLIC") return "public";
  if (visibility === "PRIVATE") return "private";
  return "unlisted";
}

export interface YouTubeUploadResult {
  videoId: string;
  watchUrl: string;
  processingStatus: string;
  byteLength: number;
}

async function youtubeJson(input: {
  accessToken: string;
  method: "POST" | "GET";
  url: string;
  body?: unknown;
}) {
  const response = await fetch(input.url, {
    method: input.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_REQUEST_UNAVAILABLE",
      "YouTube is temporarily unavailable.",
      { retryable: true },
    );
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    const nested = object(payload.error);
    const providerCode =
      stringValue(nested.code) ??
      (typeof nested.code === "number" ? String(nested.code) : undefined) ??
      String(response.status);
    const reauth = response.status === 401 || response.status === 403;
    throw new SocialPublishingAdapterError(
      `YOUTUBE_UPLOAD_${providerCode}`,
      reauth
        ? "YouTube authorization is no longer valid for uploads."
        : response.status === 429 || response.status >= 500
          ? "YouTube upload is temporarily unavailable."
          : "YouTube rejected the upload request.",
      {
        retryable: !reauth && (response.status === 429 || response.status >= 500),
        reauthorizationRequired: reauth,
        providerStatusCode: response.status,
        safeMetadata: { providerCode },
      },
    );
  }
  return { response, payload };
}

/**
 * Uploads a video to YouTube via a resumable upload session, then polls
 * videos.list until the upload is confirmed present (processing state is
 * recorded but does not gate success — YouTube finishes processing async).
 */
export async function uploadVideoToYouTube(input: {
  accessToken: string;
  mediaUrl: string;
  field: string;
  title: string;
  description: string;
  privacyStatus: YouTubePrivacyStatus;
}): Promise<YouTubeUploadResult> {
  const maxBytes = envByteLimit("YOUTUBE_MEDIA_MAX_BYTES", 64 * 1024 * 1024);
  const media = await fetchMediaBytes({
    url: input.mediaUrl,
    field: input.field,
    maxBytes,
    provider: "YOUTUBE",
  });
  if (mediaKind(media.contentType) !== "video") {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_MEDIA_TYPE_UNSUPPORTED",
      `YouTube upload requires a video file (detected: ${media.contentType}).`,
    );
  }

  const title = input.title.trim().slice(0, 100);
  if (!title) {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_TITLE_REQUIRED",
      "YouTube upload requires a title (from the approved content title or text).",
    );
  }
  const description = input.description.trim().slice(0, 5000);

  const session = await fetch(
    `${YOUTUBE_UPLOAD_BASE}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": media.contentType,
        "X-Upload-Content-Length": String(media.byteLength),
      },
      body: JSON.stringify({
        snippet: { title, description },
        status: { privacyStatus: input.privacyStatus },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_SESSION_UNAVAILABLE",
      "YouTube did not return a resumable upload session.",
      { retryable: true },
    );
  });
  const sessionPayload = await responsePayload(session);
  if (!session.ok) {
    const nested = object(sessionPayload.error);
    const providerCode =
      stringValue(nested.code) ??
      (typeof nested.code === "number" ? String(nested.code) : undefined) ??
      String(session.status);
    const reauth = session.status === 401 || session.status === 403;
    throw new SocialPublishingAdapterError(
      `YOUTUBE_SESSION_${providerCode}`,
      reauth
        ? "YouTube authorization is no longer valid for uploads."
        : "YouTube rejected the resumable upload session request.",
      {
        retryable: !reauth && (session.status === 429 || session.status >= 500),
        reauthorizationRequired: reauth,
        providerStatusCode: session.status,
        safeMetadata: { providerCode },
      },
    );
  }
  const sessionUri =
    session.headers.get("location")?.trim() ||
    stringValue(sessionPayload.uploadUrl);
  if (!sessionUri || !sessionUri.startsWith("https://")) {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_SESSION_INVALID",
      "YouTube did not return a valid resumable upload session URI.",
    );
  }

  const upload = await fetch(sessionUri, {
    method: "PUT",
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.byteLength),
    },
    body: media.bytes as unknown as BodyInit,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 6),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_UPLOAD_BYTES_UNAVAILABLE",
      "The YouTube byte upload did not complete.",
      { retryable: true },
    );
  });
  const uploadPayload = await responsePayload(upload);
  if (upload.status === 308) {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_UPLOAD_INCOMPLETE",
      "The YouTube resumable upload did not complete in one pass.",
      { retryable: true, providerStatusCode: 308 },
    );
  }
  if (!upload.ok) {
    const nested = object(uploadPayload.error);
    const providerCode =
      stringValue(nested.code) ??
      (typeof nested.code === "number" ? String(nested.code) : undefined) ??
      String(upload.status);
    throw new SocialPublishingAdapterError(
      `YOUTUBE_UPLOAD_${providerCode}`,
      upload.status === 429 || upload.status >= 500
        ? "YouTube upload is temporarily unavailable."
        : "YouTube rejected the uploaded bytes.",
      {
        retryable: upload.status === 429 || upload.status >= 500,
        providerStatusCode: upload.status,
        safeMetadata: { providerCode },
      },
    );
  }
  const videoId = stringValue(uploadPayload.id);
  if (!videoId) {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_UPLOAD_RESPONSE_INVALID",
      "YouTube did not return a video identifier after upload.",
    );
  }

  const processingStatus = await pollYouTubeVideo({
    accessToken: input.accessToken,
    videoId,
  });
  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    processingStatus,
    byteLength: media.byteLength,
  };
}

async function pollYouTubeVideo(input: {
  accessToken: string;
  videoId: string;
}): Promise<string> {
  const deadline = Date.now() + 90_000;
  const pollMs =
    Number(process.env.YOUTUBE_PROCESSING_POLL_MS) > 0
      ? Number(process.env.YOUTUBE_PROCESSING_POLL_MS)
      : 10_000;
  let lastStatus = "unknown";
  for (;;) {
    const { payload } = await youtubeJson({
      accessToken: input.accessToken,
      method: "GET",
      url: `${YOUTUBE_API_BASE}/videos?part=status,processingDetails&id=${encodeURIComponent(input.videoId)}`,
    });
    const item = Array.isArray(payload.items) ? object(payload.items[0]) : {};
    const status = object(item.status);
    const processing = object(item.processingDetails);
    lastStatus =
      stringValue(status.uploadStatus) ??
      stringValue(processing.processingStatus) ??
      "unknown";
    if (stringValue(item.id) === input.videoId) {
      if (
        lastStatus === "processed" ||
        lastStatus === "succeeded" ||
        lastStatus === "uploaded"
      ) {
        return lastStatus;
      }
      if (lastStatus === "failed" || lastStatus === "rejected") {
        throw new SocialPublishingAdapterError(
          "YOUTUBE_PROCESSING_FAILED",
          "YouTube failed to process the uploaded video.",
          { safeMetadata: { videoId: input.videoId, processingStatus: lastStatus } },
        );
      }
    }
    if (Date.now() >= deadline) return lastStatus;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** Read-back existence check used by publication verification. */
export async function youtubeVideoExists(input: {
  accessToken: string;
  videoId: string;
}): Promise<boolean> {
  try {
    const { payload } = await youtubeJson({
      accessToken: input.accessToken,
      method: "GET",
      url: `${YOUTUBE_API_BASE}/videos?part=id&id=${encodeURIComponent(input.videoId)}`,
    });
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items.some((item) => stringValue(object(item).id) === input.videoId);
  } catch {
    return false;
  }
}

export function isRetryableUploadError(error: unknown) {
  return (
    error instanceof SocialPublishingAdapterError &&
    Boolean(error.options.retryable)
  );
}
