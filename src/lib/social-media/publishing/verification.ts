/**
 * Publication verification for the governed social publishing worker.
 *
 * After a provider adapter reports a successful dispatch, the worker performs a
 * read-back check wherever the provider offers one (post ID / permalink). The
 * outcome is recorded on the job and the job is only marked PUBLISHED when
 * dispatch succeeded AND verification passed (or was not applicable).
 *
 * A failed verification NEVER retries the publish itself — that would risk a
 * duplicate post. The job is BLOCKED for operator review instead.
 */
import type {
  SharedSocialPublishingProvider,
  SocialPublicationVerification,
} from "./types";
import { SocialPublishingAdapterError } from "./errors";

const REQUEST_TIMEOUT_MS = 20_000;

export type PublicationVerificationMethod =
  SocialPublicationVerification["method"];

export type PublicationVerification = SocialPublicationVerification;

type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => null);
  if (!response) return null;
  const text = await response.text().catch(() => "");
  let payload: JsonRecord = {};
  try {
    payload = object(JSON.parse(text));
  } catch {
    payload = {};
  }
  return { response, payload };
}

function notApplicable(): PublicationVerification {
  return {
    verificationOk: true,
    verifiedAt: new Date().toISOString(),
    method: "NOT_APPLICABLE",
    detail: "Provider offers no read-back endpoint for published posts.",
  };
}

async function verifyFacebook(input: {
  accessToken: string;
  externalPostId: string;
}): Promise<PublicationVerification> {
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
  const checked = await getJson(
    `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(input.externalPostId)}?fields=id,permalink_url`,
    { Authorization: `Bearer ${input.accessToken}` },
  );
  const id = checked ? stringValue(checked.payload.id) : undefined;
  return {
    verificationOk: Boolean(id),
    verifiedAt: new Date().toISOString(),
    permalink: checked ? stringValue(checked.payload.permalink_url) : undefined,
    method: "READ_BACK",
    detail: id ? undefined : "Facebook did not return the published post on read-back.",
  };
}

async function verifyInstagram(input: {
  accessToken: string;
  externalPostId: string;
}): Promise<PublicationVerification> {
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
  const checked = await getJson(
    `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(input.externalPostId)}?fields=id,permalink`,
    { Authorization: `Bearer ${input.accessToken}` },
  );
  const id = checked ? stringValue(checked.payload.id) : undefined;
  return {
    verificationOk: Boolean(id),
    verifiedAt: new Date().toISOString(),
    permalink: checked ? stringValue(checked.payload.permalink) : undefined,
    method: "READ_BACK",
    detail: id ? undefined : "Instagram did not return the published media on read-back.",
  };
}

async function verifyX(input: {
  accessToken: string;
  externalPostId: string;
}): Promise<PublicationVerification> {
  const checked = await getJson(
    `https://api.x.com/2/tweets/${encodeURIComponent(input.externalPostId)}?tweet.fields=id`,
    { Authorization: `Bearer ${input.accessToken}` },
  );
  const id = checked ? stringValue(object(checked.payload.data).id) : undefined;
  return {
    verificationOk: Boolean(id),
    verifiedAt: new Date().toISOString(),
    permalink: `https://x.com/i/web/status/${input.externalPostId}`,
    method: "READ_BACK",
    detail: id ? undefined : "X did not return the published post on read-back.",
  };
}

async function verifyLinkedIn(input: {
  accessToken: string;
  externalPostId: string;
}): Promise<PublicationVerification> {
  const version = process.env.LINKEDIN_API_VERSION?.trim() || "202401";
  const checked = await getJson(
    `https://api.linkedin.com/rest/posts/${encodeURIComponent(input.externalPostId)}`,
    {
      Authorization: `Bearer ${input.accessToken}`,
      "LinkedIn-Version": version,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  );
  const ok = Boolean(checked && checked.response.ok);
  return {
    verificationOk: ok,
    verifiedAt: new Date().toISOString(),
    method: "READ_BACK",
    detail: ok ? undefined : "LinkedIn did not return the published post on read-back.",
  };
}

async function verifyYouTube(input: {
  accessToken: string;
  externalPostId: string;
}): Promise<PublicationVerification> {
  const checked = await getJson(
    `https://www.googleapis.com/youtube/v3/videos?part=id&id=${encodeURIComponent(input.externalPostId)}`,
    { Authorization: `Bearer ${input.accessToken}` },
  );
  const items = checked && Array.isArray(checked.payload.items)
    ? checked.payload.items
    : [];
  const found = items.some(
    (item) => stringValue(object(item).id) === input.externalPostId,
  );
  return {
    verificationOk: found,
    verifiedAt: new Date().toISOString(),
    permalink: `https://www.youtube.com/watch?v=${input.externalPostId}`,
    method: "READ_BACK",
    detail: found ? undefined : "YouTube did not return the uploaded video on read-back.",
  };
}

/**
 * Verifies a dispatched publication. NEXTDOOR has no approved read-back
 * endpoint, so it is explicitly NOT_APPLICABLE (the publish response is the
 * only evidence) rather than a silent pass.
 */
export async function verifySocialPublication(input: {
  provider: SharedSocialPublishingProvider;
  accessToken: string;
  externalPostId: string;
  externalPostUrl?: string;
}): Promise<PublicationVerification> {
  if (!input.externalPostId.trim()) {
    throw new SocialPublishingAdapterError(
      "PUBLICATION_VERIFICATION_ID_REQUIRED",
      "Verification requires a provider post identifier.",
    );
  }
  const base = {
    accessToken: input.accessToken,
    externalPostId: input.externalPostId,
  };
  switch (input.provider) {
    case "FACEBOOK_PAGE":
      return verifyFacebook(base);
    case "INSTAGRAM_PROFESSIONAL":
      return verifyInstagram(base);
    case "X":
      return verifyX(base);
    case "LINKEDIN_COMPANY":
      return verifyLinkedIn(base);
    case "YOUTUBE":
      return verifyYouTube(base);
    case "NEXTDOOR":
      return {
        ...notApplicable(),
        permalink: input.externalPostUrl,
      };
  }
}
