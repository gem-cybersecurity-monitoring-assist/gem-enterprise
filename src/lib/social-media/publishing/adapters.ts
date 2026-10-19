import type {
  SharedSocialPublishingProvider,
  SocialPublishingAdapterInput,
  SocialPublishingAdapterResult,
} from "./types";

const REQUEST_TIMEOUT_MS = 30_000;

type JsonRecord = Record<string, unknown>;

export class SocialPublishingAdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public options: {
      retryable?: boolean;
      reauthorizationRequired?: boolean;
      providerStatusCode?: number;
      safeMetadata?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
  }
}

export interface SocialPublishingAdapter {
  publish(input: SocialPublishingAdapterInput): Promise<SocialPublishingAdapterResult>;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function httpsUrl(value: string | undefined, field: string) {
  if (!value) return undefined;
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

async function responsePayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return object(JSON.parse(text));
  } catch {
    return {};
  }
}

function providerFailure(
  provider: SharedSocialPublishingProvider,
  response: Response,
  payload: JsonRecord,
): never {
  const nested = object(payload.error);
  const providerCode =
    stringValue(nested.code) ||
    (typeof nested.code === "number" ? String(nested.code) : undefined) ||
    stringValue(payload.code) ||
    String(response.status);
  const retryable =
    response.status === 408 ||
    response.status === 409 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500 ||
    ["1", "2", "4", "17", "32", "341", "613"].includes(providerCode);
  const reauthorizationRequired =
    response.status === 401 ||
    response.status === 403 ||
    providerCode === "190" ||
    providerCode === "INVALID_TOKEN";

  throw new SocialPublishingAdapterError(
    `${provider}_PROVIDER_${providerCode}`,
    reauthorizationRequired
      ? `${provider} authorization is no longer valid.`
      : retryable
        ? `${provider} is temporarily unavailable.`
        : `${provider} rejected the publishing request.`,
    {
      retryable: retryable && !reauthorizationRequired,
      reauthorizationRequired,
      providerStatusCode: response.status,
      safeMetadata: { providerCode },
    },
  );
}

async function metaFormRequest(input: {
  path: string;
  accessToken: string;
  body: Record<string, string>;
}) {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  if (!version) {
    throw new SocialPublishingAdapterError(
      "META_API_VERSION_NOT_CONFIGURED",
      "Meta Graph API version is not configured.",
    );
  }
  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(version)}/${input.path}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(input.body).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new SocialPublishingAdapterError(
      "META_REQUEST_UNAVAILABLE",
      "Meta publishing is temporarily unavailable.",
      { retryable: true },
    );
  });
  const payload = await responsePayload(response);
  if (!response.ok || object(payload.error).code) {
    providerFailure("FACEBOOK_PAGE", response, payload);
  }
  return { response, payload };
}

function joinedMessage(text?: string, linkUrl?: string) {
  const parts = [text?.trim(), linkUrl?.trim()].filter(Boolean);
  return parts.join("\n\n");
}

const facebookAdapter: SocialPublishingAdapter = {
  async publish(input) {
    const { job, externalAccountId, accessToken } = input;
    const text = joinedMessage(job.payload.text, job.payload.linkUrl);
    const media = (job.payload.mediaUrls || []).map((url, index) =>
      httpsUrl(url, `mediaUrls[${index}]`),
    );

    let result: { response: Response; payload: JsonRecord };
    if (job.contentType === "IMAGE") {
      if (media.length !== 1) {
        throw new SocialPublishingAdapterError(
          "FACEBOOK_IMAGE_REQUIRED",
          "Facebook image publishing requires exactly one approved image URL.",
        );
      }
      result = await metaFormRequest({
        path: `${encodeURIComponent(externalAccountId)}/photos`,
        accessToken,
        body: { url: media[0]!, caption: text },
      });
    } else if (
      job.contentType === "SHORT_VIDEO" ||
      job.contentType === "LONG_VIDEO"
    ) {
      if (media.length !== 1) {
        throw new SocialPublishingAdapterError(
          "FACEBOOK_VIDEO_REQUIRED",
          "Facebook video publishing requires exactly one approved video URL.",
        );
      }
      result = await metaFormRequest({
        path: `${encodeURIComponent(externalAccountId)}/videos`,
        accessToken,
        body: { file_url: media[0]!, description: text },
      });
    } else {
      if (!text) {
        throw new SocialPublishingAdapterError(
          "FACEBOOK_MESSAGE_REQUIRED",
          "Facebook publishing requires approved post text or a link.",
        );
      }
      const body: Record<string, string> = { message: text };
      if (job.payload.linkUrl) {
        body.link = httpsUrl(job.payload.linkUrl, "linkUrl")!;
      }
      result = await metaFormRequest({
        path: `${encodeURIComponent(externalAccountId)}/feed`,
        accessToken,
        body,
      });
    }

    const id = stringValue(result.payload.id) || stringValue(result.payload.post_id);
    if (!id) {
      throw new SocialPublishingAdapterError(
        "META_PUBLISH_RESPONSE_INVALID",
        "Meta did not return a publish identifier.",
      );
    }
    return {
      externalPostId: id,
      providerStatusCode: result.response.status,
      safeMetadata: { destination: "FACEBOOK_PAGE" },
    };
  },
};

async function createInstagramContainer(input: {
  accountId: string;
  accessToken: string;
  body: Record<string, string>;
}) {
  const result = await metaFormRequest({
    path: `${encodeURIComponent(input.accountId)}/media`,
    accessToken: input.accessToken,
    body: input.body,
  });
  const id = stringValue(result.payload.id);
  if (!id) {
    throw new SocialPublishingAdapterError(
      "INSTAGRAM_CONTAINER_RESPONSE_INVALID",
      "Instagram did not return a media container identifier.",
    );
  }
  return id;
}

const instagramAdapter: SocialPublishingAdapter = {
  async publish(input) {
    const { job, externalAccountId, accessToken } = input;
    const media = (job.payload.mediaUrls || []).map((url, index) =>
      httpsUrl(url, `mediaUrls[${index}]`),
    );
    const caption = joinedMessage(job.payload.text, job.payload.linkUrl);
    let creationId: string;

    if (job.contentType === "CAROUSEL") {
      if (media.length < 2 || media.length > 10) {
        throw new SocialPublishingAdapterError(
          "INSTAGRAM_CAROUSEL_SIZE_INVALID",
          "Instagram carousels require between two and ten approved images.",
        );
      }
      const children: string[] = [];
      for (const imageUrl of media) {
        children.push(
          await createInstagramContainer({
            accountId: externalAccountId,
            accessToken,
            body: { image_url: imageUrl!, is_carousel_item: "true" },
          }),
        );
      }
      creationId = await createInstagramContainer({
        accountId: externalAccountId,
        accessToken,
        body: {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption,
        },
      });
    } else {
      if (media.length !== 1) {
        throw new SocialPublishingAdapterError(
          "INSTAGRAM_MEDIA_REQUIRED",
          "Instagram publishing requires exactly one approved media URL.",
        );
      }
      creationId = await createInstagramContainer({
        accountId: externalAccountId,
        accessToken,
        body:
          job.contentType === "REEL"
            ? { media_type: "REELS", video_url: media[0]!, caption }
            : { image_url: media[0]!, caption },
      });
    }

    const result = await metaFormRequest({
      path: `${encodeURIComponent(externalAccountId)}/media_publish`,
      accessToken,
      body: { creation_id: creationId },
    });
    const id = stringValue(result.payload.id);
    if (!id) {
      throw new SocialPublishingAdapterError(
        "INSTAGRAM_PUBLISH_RESPONSE_INVALID",
        "Instagram did not return a publish identifier.",
      );
    }
    return {
      externalPostId: id,
      providerStatusCode: result.response.status,
      safeMetadata: { destination: "INSTAGRAM_PROFESSIONAL", creationId },
    };
  },
};

async function xCreatePost(input: {
  accessToken: string;
  text: string;
  replyTo?: string;
}) {
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input.text,
      ...(input.replyTo
        ? { reply: { in_reply_to_tweet_id: input.replyTo } }
        : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new SocialPublishingAdapterError(
      "X_REQUEST_UNAVAILABLE",
      "X publishing is temporarily unavailable.",
      { retryable: true },
    );
  });
  const payload = await responsePayload(response);
  if (!response.ok) providerFailure("X", response, payload);
  const id = stringValue(object(payload.data).id);
  if (!id) {
    throw new SocialPublishingAdapterError(
      "X_PUBLISH_RESPONSE_INVALID",
      "X did not return a post identifier.",
    );
  }
  return { id, status: response.status };
}

const xAdapter: SocialPublishingAdapter = {
  async publish(input) {
    if ((input.job.payload.mediaUrls || []).length > 0) {
      throw new SocialPublishingAdapterError(
        "X_MEDIA_UPLOAD_NOT_CERTIFIED",
        "X media upload is not certified for this publishing worker.",
      );
    }
    const messages = input.job.contentType === "THREAD"
      ? input.job.payload.thread || []
      : [joinedMessage(input.job.payload.text, input.job.payload.linkUrl)];
    if (messages.length === 0 || messages.length > 25 || messages.some((item) => !item.trim())) {
      throw new SocialPublishingAdapterError(
        "X_TEXT_REQUIRED",
        "X publishing requires one to twenty-five approved text entries.",
      );
    }

    const ids: string[] = [];
    let replyTo: string | undefined;
    let providerStatusCode: number | undefined;
    for (const text of messages) {
      const created = await xCreatePost({
        accessToken: input.accessToken,
        text: text.trim(),
        replyTo,
      });
      ids.push(created.id);
      replyTo = created.id;
      providerStatusCode = created.status;
    }
    return {
      externalPostId: ids[0]!,
      externalPostUrl: `https://x.com/i/web/status/${ids[0]}`,
      providerStatusCode,
      safeMetadata: { postIds: ids, threadLength: ids.length },
    };
  },
};

const linkedInAdapter: SocialPublishingAdapter = {
  async publish(input) {
    if ((input.job.payload.mediaUrls || []).length > 0) {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_MEDIA_UPLOAD_NOT_CERTIFIED",
        "LinkedIn media upload is not certified for this publishing worker.",
      );
    }
    const commentary = joinedMessage(
      input.job.payload.text,
      input.job.payload.linkUrl,
    );
    if (!commentary) {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_COMMENTARY_REQUIRED",
        "LinkedIn publishing requires approved commentary.",
      );
    }
    const version = process.env.LINKEDIN_API_VERSION?.trim();
    if (!version) {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_API_VERSION_NOT_CONFIGURED",
        "LinkedIn API version is not configured.",
      );
    }
    const author = `urn:li:organization:${input.externalAccountId}`;
    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": version,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_REQUEST_UNAVAILABLE",
        "LinkedIn publishing is temporarily unavailable.",
        { retryable: true },
      );
    });
    const payload = await responsePayload(response);
    if (!response.ok) providerFailure("LINKEDIN_COMPANY", response, payload);
    const id =
      response.headers.get("x-restli-id")?.trim() ||
      stringValue(payload.id) ||
      stringValue(payload.urn);
    if (!id) {
      throw new SocialPublishingAdapterError(
        "LINKEDIN_PUBLISH_RESPONSE_INVALID",
        "LinkedIn did not return a post identifier.",
      );
    }
    return {
      externalPostId: id,
      providerStatusCode: response.status,
      safeMetadata: { author },
    };
  },
};

const youtubeAdapter: SocialPublishingAdapter = {
  async publish() {
    throw new SocialPublishingAdapterError(
      "YOUTUBE_UPLOAD_PIPELINE_NOT_CERTIFIED",
      "YouTube upload requires the certified resumable media pipeline before publishing can be enabled.",
    );
  },
};

const nextdoorAdapter: SocialPublishingAdapter = {
  async publish(input) {
    const template = process.env.NEXTDOOR_PUBLISH_URL_TEMPLATE?.trim();
    if (!template || !template.includes("{profileId}")) {
      throw new SocialPublishingAdapterError(
        "NEXTDOOR_PUBLISH_ENDPOINT_NOT_APPROVED",
        "Nextdoor publishing remains blocked until an approved Publish API endpoint is configured.",
      );
    }
    const endpoint = new URL(
      template.replace("{profileId}", encodeURIComponent(input.externalAccountId)),
    );
    if (endpoint.protocol !== "https:") {
      throw new SocialPublishingAdapterError(
        "NEXTDOOR_PUBLISH_ENDPOINT_INVALID",
        "Nextdoor publishing endpoint must use HTTPS.",
      );
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.job.payload.text,
        link_url: input.job.payload.linkUrl,
        media_urls: input.job.payload.mediaUrls || [],
        local_context: input.job.localContext,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => {
      throw new SocialPublishingAdapterError(
        "NEXTDOOR_REQUEST_UNAVAILABLE",
        "Nextdoor publishing is temporarily unavailable.",
        { retryable: true },
      );
    });
    const payload = await responsePayload(response);
    if (!response.ok) providerFailure("NEXTDOOR", response, payload);
    const id = stringValue(payload.id) || stringValue(payload.post_id);
    if (!id) {
      throw new SocialPublishingAdapterError(
        "NEXTDOOR_PUBLISH_RESPONSE_INVALID",
        "Nextdoor did not return a post identifier.",
      );
    }
    return {
      externalPostId: id,
      externalPostUrl: stringValue(payload.url),
      providerStatusCode: response.status,
      safeMetadata: { destination: "NEXTDOOR" },
    };
  },
};

const adapters: Record<SharedSocialPublishingProvider, SocialPublishingAdapter> = {
  FACEBOOK_PAGE: facebookAdapter,
  INSTAGRAM_PROFESSIONAL: instagramAdapter,
  X: xAdapter,
  LINKEDIN_COMPANY: linkedInAdapter,
  YOUTUBE: youtubeAdapter,
  NEXTDOOR: nextdoorAdapter,
};

export function getSocialPublishingAdapter(
  provider: SharedSocialPublishingProvider,
) {
  return adapters[provider];
}
