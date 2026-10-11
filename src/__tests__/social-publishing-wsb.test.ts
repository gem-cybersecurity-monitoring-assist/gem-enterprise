/**
 * WS-B (publishing pipeline) tests. All provider HTTP is mocked — no real
 * posts are ever created, per the no-public-test-posts rule.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Prisma client cannot be generated in this sandbox (engine download is
// blocked), so unit tests run against a minimal mock of the Prisma.sql
// template-tag API. The mock preserves sql text + bound values, which is all
// the slot-policy SQL builders need.
vi.mock("@prisma/client", () => {
  class MockSql {
    constructor(
      public sql: string,
      public values: unknown[],
    ) {}
  }
  function sqlTag(strings: TemplateStringsArray, ...values: unknown[]) {
    let text = "";
    const flat: unknown[] = [];
    strings.forEach((part, index) => {
      text += part;
      if (index < values.length) {
        const value = values[index];
        if (value instanceof MockSql) {
          text += value.sql;
          flat.push(...value.values);
        } else {
          flat.push(value);
          text += `$${flat.length}`;
        }
      }
    });
    return new MockSql(text, flat);
  }
  class MockPrismaClient {
    $queryRaw = async () => {
      throw new Error("no database in unit tests");
    };
    $executeRaw = async () => {
      throw new Error("no database in unit tests");
    };
    $transaction = async () => {
      throw new Error("no database in unit tests");
    };
  }
  return {
    PrismaClient: MockPrismaClient,
    Prisma: {
      sql: sqlTag,
      join: (fragments: MockSql[], separator = ", ") =>
        new MockSql(
          fragments.map((fragment) => fragment.sql).join(separator),
          fragments.flatMap((fragment) => fragment.values),
        ),
    },
  };
});

import {
  getSocialPublishingAdapter,
  SocialPublishingAdapterError,
} from "@/lib/social-media/publishing/adapters";
import { fetchMediaBytes } from "@/lib/social-media/publishing/media";
import {
  getSocialPublishingCapabilities,
  isYoutubeUploadCertified,
  markYoutubeUploadCertified,
} from "@/lib/social-media/publishing/capabilities";
import {
  buildNextdoorPublishConfig,
  readNextdoorPublishConfig,
  resolveNextdoorPublishEndpoint,
  validateNextdoorUrlTemplate,
} from "@/lib/social-media/publishing/nextdoor";
import { providerPauseState } from "@/lib/social-media/publishing/pause";
import {
  parseSlotHour,
  providerMinSpacingMinutes,
  providerSlotBatchCap,
  providerSlotCapCaseSql,
  providerSpacingIntervalSql,
  slotWindowUtc,
} from "@/lib/social-media/publishing/slots";
import { isSamePublishingRequest } from "@/lib/social-media/publishing/store";
import {
  readJobVerification,
  type SocialPublishingJobRecord,
} from "@/lib/social-media/publishing/types";
import { verifySocialPublication } from "@/lib/social-media/publishing/verification";

function jobFixture(
  overrides: Partial<SocialPublishingJobRecord> = {},
): SocialPublishingJobRecord {
  const now = new Date();
  return {
    id: "job-1",
    workspaceId: "ws-1",
    provider: "X",
    connectorId: "conn-1",
    contentType: "TEXT",
    contentVersionHash: "hash-a",
    approvedVersionHash: "hash-a",
    approvalId: "appr-1",
    complianceReviewId: "comp-1",
    compliancePassed: true,
    idempotencyKey: "idem-1",
    payload: {},
    localContext: null,
    state: "CLAIMED",
    attemptCount: 1,
    maxAttempts: 3,
    nextAttemptAt: now,
    claimId: "claim-1",
    claimExpiresAt: new Date(now.getTime() + 60_000),
    externalPostId: null,
    externalPostUrl: null,
    safeProviderMetadata: {},
    lastErrorCode: null,
    lastErrorMessage: null,
    requestedById: null,
    scheduledFor: null,
    claimedAt: now,
    submittedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

type FetchHandler = (
  url: string,
  init: RequestInit,
) => Response | Promise<Response>;

let handler: FetchHandler;
const requests: Array<{ url: string; init: RequestInit }> = [];

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

beforeEach(() => {
  requests.length = 0;
  handler = () => new Response("not mocked", { status: 500 });
  vi.stubGlobal(
    "fetch",
    async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const record = { url, init: init ?? {} };
      requests.push(record);
      return handler(url, record.init);
    },
  );
  process.env.META_GRAPH_API_VERSION = "v21.0";
  process.env.LINKEDIN_API_VERSION = "202401";
  process.env.X_MEDIA_PROCESSING_POLL_MS = "5";
  process.env.YOUTUBE_PROCESSING_POLL_MS = "5";
  // 64 hex chars -> 32 bytes, mirroring the SOCIAL_TOKEN_ENCRYPTION_KEY format.
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  delete process.env.NEXTDOOR_PUBLISH_URL_TEMPLATE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXTDOOR_PUBLISH_URL_TEMPLATE;
});

function formCommand(init: RequestInit) {
  const body = init.body;
  if (body instanceof FormData) return String(body.get("command") ?? "");
  return "";
}

describe("X two-phase media upload", () => {
  it("uploads an image via INIT/APPEND/FINALIZE and attaches media_ids", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    let tweetBody: Record<string, unknown> = {};
    handler = async (url, init) => {
      if (url === "https://cdn.test/img.jpg") {
        return new Response(jpeg, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.startsWith("https://upload.twitter.com/1.1/media/upload.json")) {
        const command = formCommand(init);
        if (command === "INIT") return json({ media_id_string: "m1" });
        if (command === "APPEND") return json({});
        if (command === "FINALIZE")
          return json({ media_id_string: "m1" });
        throw new Error(`unexpected command ${command}`);
      }
      if (url === "https://api.x.com/2/tweets") {
        tweetBody = JSON.parse(String(init.body));
        return json({ data: { id: "t100" } });
      }
      throw new Error(`unexpected url ${url}`);
    };

    const adapter = getSocialPublishingAdapter("X");
    const result = await adapter.publish({
      job: jobFixture({
        provider: "X",
        payload: { text: "hello", mediaUrls: ["https://cdn.test/img.jpg"] },
      }),
      accessToken: "token",
      externalAccountId: "acct",
      connectorMetadata: {},
    });

    expect(result.externalPostId).toBe("t100");
    expect(result.externalPostUrl).toBe("https://x.com/i/web/status/t100");
    expect(tweetBody).toMatchObject({ media: { media_ids: ["m1"] } });
    expect(result.safeMetadata).toMatchObject({ mediaIds: ["m1"] });
    const commands = requests
      .filter((r) => r.url.includes("upload.twitter.com"))
      .map((r) => formCommand(r.init));
    expect(commands).toEqual(["INIT", "APPEND", "FINALIZE"]);
  });

  it("polls video processing until X reports success", async () => {
    const mp4 = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    let statusCalls = 0;
    handler = async (url, init) => {
      if (url === "https://cdn.test/clip.mp4") {
        return new Response(mp4, {
          status: 200,
          headers: { "content-type": "video/mp4" },
        });
      }
      if (url.startsWith("https://upload.twitter.com/1.1/media/upload.json")) {
        const command = formCommand(init);
        if (command === "INIT") return json({ media_id_string: "m2" });
        if (command === "APPEND") return json({});
        if (command === "FINALIZE")
          return json({
            media_id_string: "m2",
            processing_info: { state: "in_progress", check_after_secs: 1 },
          });
        if (command === "STATUS") {
          statusCalls += 1;
          return json({ processing_info: { state: "succeeded" } });
        }
      }
      if (url === "https://api.x.com/2/tweets") {
        return json({ data: { id: "t101" } });
      }
      throw new Error(`unexpected url ${url}`);
    };

    const adapter = getSocialPublishingAdapter("X");
    const result = await adapter.publish({
      job: jobFixture({
        provider: "X",
        contentType: "SHORT_VIDEO",
        payload: { text: "clip", mediaUrls: ["https://cdn.test/clip.mp4"] },
      }),
      accessToken: "token",
      externalAccountId: "acct",
      connectorMetadata: {},
    });
    expect(result.externalPostId).toBe("t101");
    expect(statusCalls).toBeGreaterThanOrEqual(1);
  });

  it("rejects more than four attachments", async () => {
    const adapter = getSocialPublishingAdapter("X");
    await expect(
      adapter.publish({
        job: jobFixture({
          provider: "X",
          payload: {
            text: "x",
            mediaUrls: ["a", "b", "c", "d", "e"].map(
              (n) => `https://cdn.test/${n}.jpg`,
            ),
          },
        }),
        accessToken: "token",
        externalAccountId: "acct",
        connectorMetadata: {},
      }),
    ).rejects.toMatchObject({ code: "X_MEDIA_COUNT_INVALID" });
  });
});

describe("LinkedIn registerUpload media pipeline", () => {
  it("registers the upload, PUTs bytes, and references the URN in the post", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    let registerBody: Record<string, unknown> = {};
    let postBody: Record<string, unknown> = {};
    let putBytes = 0;
    handler = async (url, init) => {
      if (url === "https://cdn.test/photo.png") {
        return new Response(png, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      if (url === "https://api.linkedin.com/v2/assets?action=registerUpload") {
        registerBody = JSON.parse(String(init.body));
        return json({
          value: {
            asset: "urn:li:digitalmediaAsset:abc",
            uploadMechanism: {
              "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
                uploadUrl: "https://upload.test/li-bytes",
              },
            },
          },
        });
      }
      if (url === "https://upload.test/li-bytes") {
        putBytes = (init.body as Uint8Array).byteLength;
        return new Response(null, { status: 201 });
      }
      if (url === "https://api.linkedin.com/v2/ugcPosts") {
        postBody = JSON.parse(String(init.body));
        return new Response("{}", {
          status: 201,
          headers: { "x-restli-id": "urn:li:ugcPost:999" },
        });
      }
      throw new Error(`unexpected url ${url}`);
    };

    const adapter = getSocialPublishingAdapter("LINKEDIN_COMPANY");
    const result = await adapter.publish({
      job: jobFixture({
        provider: "LINKEDIN_COMPANY",
        contentType: "IMAGE",
        payload: {
          text: "launch day",
          mediaUrls: ["https://cdn.test/photo.png"],
        },
      }),
      accessToken: "token",
      externalAccountId: "org-1",
      connectorMetadata: {},
    });

    expect(registerBody).toMatchObject({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: "urn:li:organization:org-1",
      },
    });
    expect(putBytes).toBe(png.byteLength);
    expect(postBody).toMatchObject({
      author: "urn:li:organization:org-1",
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: "launch day" },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              media: "urn:li:digitalmediaAsset:abc",
            },
          ],
        },
      },
    });
    expect(result.externalPostId).toBe("urn:li:ugcPost:999");
    expect(result.safeMetadata).toMatchObject({
      mediaUrn: "urn:li:digitalmediaAsset:abc",
    });
  });

  it("rejects multi-image carousels as unimplemented", async () => {
    const adapter = getSocialPublishingAdapter("LINKEDIN_COMPANY");
    await expect(
      adapter.publish({
        job: jobFixture({
          provider: "LINKEDIN_COMPANY",
          contentType: "CAROUSEL",
          payload: {
            text: "x",
            mediaUrls: [
              "https://cdn.test/1.png",
              "https://cdn.test/2.png",
            ],
          },
        }),
        accessToken: "token",
        externalAccountId: "org-1",
        connectorMetadata: {},
      }),
    ).rejects.toMatchObject({ code: "LINKEDIN_MEDIA_COUNT_INVALID" });
  });
});

describe("YouTube resumable upload pipeline", () => {
  const mp4 = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);

  function youtubeHandler(extra?: {
    sessionStatus?: number;
    uploadStatus?: number;
    uploadBody?: unknown;
  }): FetchHandler {
    return async (url, init) => {
      if (url === "https://cdn.test/video.mp4") {
        return new Response(mp4, {
          status: 200,
          headers: { "content-type": "video/mp4" },
        });
      }
      if (
        url.startsWith("https://www.googleapis.com/upload/youtube/v3/videos")
      ) {
        return new Response(JSON.stringify(extra?.uploadBody ?? {}), {
          status: extra?.sessionStatus ?? 200,
          headers: { location: "https://upload.test/yt-session" },
        });
      }
      if (url === "https://upload.test/yt-session") {
        return json({ id: "vid123" }, extra?.uploadStatus ?? 200);
      }
      if (url.includes("youtube/v3/videos?part=status")) {
        return json({
          items: [{ id: "vid123", status: { uploadStatus: "processed" } }],
        });
      }
      if (url.includes("youtube/v3/videos?part=id")) {
        return json({ items: [{ id: "vid123" }] });
      }
      throw new Error(`unexpected url ${url}`);
    };
  }

  it("runs the resumable session, uploads bytes, and records the video id", async () => {
    handler = youtubeHandler();
    const adapter = getSocialPublishingAdapter("YOUTUBE");
    const result = await adapter.publish({
      job: jobFixture({
        provider: "YOUTUBE",
        contentType: "SHORT_VIDEO",
        payload: {
          title: "Test video",
          text: "desc",
          visibility: "PUBLIC",
          mediaUrls: ["https://cdn.test/video.mp4"],
        },
      }),
      accessToken: "token",
      externalAccountId: "channel-1",
      connectorMetadata: {},
    });

    expect(result.externalPostId).toBe("vid123");
    expect(result.externalPostUrl).toBe(
      "https://www.youtube.com/watch?v=vid123",
    );
    expect(result.safeMetadata).toMatchObject({
      videoId: "vid123",
      processingStatus: "processed",
      privacyStatus: "public",
    });
    const sessionCall = requests.find((r) =>
      r.url.includes("uploadType=resumable"),
    );
    expect(sessionCall).toBeDefined();
    const sessionBody = JSON.parse(String(sessionCall!.init.body));
    expect(sessionBody).toMatchObject({
      snippet: { title: "Test video" },
      status: { privacyStatus: "public" },
    });
  });

  it("does NOT certify the pipeline from mocked HTTP in the test env", () => {
    // The upload above succeeded under mocked fetch in NODE_ENV=test.
    expect(isYoutubeUploadCertified()).toBe(false);
    expect(markYoutubeUploadCertified()).toBe(false);
    expect(isYoutubeUploadCertified()).toBe(false);
    const capabilities = getSocialPublishingCapabilities();
    const youtube = capabilities.find((c) => c.provider === "YOUTUBE")!;
    expect(youtube.mediaUpload).toBe("not_certified");
    expect(youtube.publishVideo).toBe(false);
  });

  it("requires exactly one video URL", async () => {
    handler = youtubeHandler();
    const adapter = getSocialPublishingAdapter("YOUTUBE");
    await expect(
      adapter.publish({
        job: jobFixture({
          provider: "YOUTUBE",
          contentType: "SHORT_VIDEO",
          payload: { title: "t", mediaUrls: [] },
        }),
        accessToken: "token",
        externalAccountId: "channel-1",
        connectorMetadata: {},
      }),
    ).rejects.toMatchObject({ code: "YOUTUBE_MEDIA_REQUIRED" });
  });

  it("rejects non-video media", async () => {
    handler = async (url) => {
      if (url === "https://cdn.test/photo.jpg") {
        return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      throw new Error(`unexpected url ${url}`);
    };
    const adapter = getSocialPublishingAdapter("YOUTUBE");
    await expect(
      adapter.publish({
        job: jobFixture({
          provider: "YOUTUBE",
          contentType: "SHORT_VIDEO",
          payload: { title: "t", mediaUrls: ["https://cdn.test/photo.jpg"] },
        }),
        accessToken: "token",
        externalAccountId: "channel-1",
        connectorMetadata: {},
      }),
    ).rejects.toMatchObject({ code: "YOUTUBE_MEDIA_TYPE_UNSUPPORTED" });
  });
});

describe("Nextdoor endpoint configuration", () => {
  const template = "https://api.nextdoor.test/v2/profiles/{profileId}/posts";

  it("accepts a valid HTTPS template with {profileId}", () => {
    expect(validateNextdoorUrlTemplate(template)).toBe(template);
  });

  it("rejects templates without the placeholder", () => {
    expect(() => validateNextdoorUrlTemplate("https://x.test/posts")).toThrow(
      expect.objectContaining({ code: "NEXTDOOR_PUBLISH_TEMPLATE_INVALID" }),
    );
  });

  it("rejects non-HTTPS templates", () => {
    expect(() =>
      validateNextdoorUrlTemplate("http://x.test/{profileId}"),
    ).toThrow(
      expect.objectContaining({ code: "NEXTDOOR_PUBLISH_TEMPLATE_INVALID" }),
    );
  });

  it("stays BLOCKED with a HUMAN_REQUIRED message when unconfigured", () => {
    try {
      resolveNextdoorPublishEndpoint({
        connectorMetadata: {},
        externalAccountId: "profile-1",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SocialPublishingAdapterError);
      const typed = error as SocialPublishingAdapterError;
      expect(typed.code).toBe("NEXTDOOR_PUBLISH_ENDPOINT_NOT_APPROVED");
      expect(typed.message).toContain("HUMAN_REQUIRED");
    }
  });

  it("stays BLOCKED when the template exists but is not approved", () => {
    const stored = {
      ...buildNextdoorPublishConfig({
        urlTemplate: template,
        approvedBy: "admin-1",
      }),
      approved: false,
    };
    try {
      resolveNextdoorPublishEndpoint({
        connectorMetadata: { nextdoorPublishConfig: stored },
        externalAccountId: "profile-1",
      });
      expect.unreachable();
    } catch (error) {
      expect((error as SocialPublishingAdapterError).code).toBe(
        "NEXTDOOR_PUBLISH_ENDPOINT_NOT_APPROVED",
      );
    }
  });

  it("resolves the endpoint once a human approves it", () => {
    const config = buildNextdoorPublishConfig({
      urlTemplate: template,
      approvedBy: "admin-1",
    });
    expect(config.approved).toBe(true);
    const resolved = resolveNextdoorPublishEndpoint({
      connectorMetadata: { nextdoorPublishConfig: config },
      externalAccountId: "profile 1",
    });
    expect(resolved.endpoint.toString()).toBe(
      "https://api.nextdoor.test/v2/profiles/profile%201/posts",
    );
    expect(resolved.approvedBy).toBe("admin-1");
  });

  it("stores only ciphertext and decrypts server-side", () => {
    const stored = buildNextdoorPublishConfig({
      urlTemplate: template,
      approvedBy: "admin-1",
    });
    // The persisted record must never contain the plaintext template: generic
    // connector list responses spread safe_metadata to the browser.
    expect(JSON.stringify(stored)).not.toContain("api.nextdoor.test");
    expect(typeof stored.urlTemplateCiphertext).toBe("string");
    expect(
      (stored as unknown as Record<string, unknown>).urlTemplate,
    ).toBeUndefined();
    const read = readNextdoorPublishConfig({
      nextdoorPublishConfig: stored,
    });
    expect(read).toMatchObject({
      urlTemplate: template,
      approved: true,
      approvedBy: "admin-1",
    });
    expect(readNextdoorPublishConfig({})).toBeNull();
    // Legacy plaintext records are ignored: the operator must re-approve.
    expect(
      readNextdoorPublishConfig({
        nextdoorPublishConfig: { urlTemplate: template, approved: true },
      }),
    ).toBeNull();
  });

  it("publishes through the approved endpoint", async () => {
    handler = async (url) => {
      expect(url).toBe(
        "https://api.nextdoor.test/v2/profiles/profile-9/posts",
      );
      return json({ id: "nd-1", url: "https://nextdoor.test/p/nd-1" });
    };
    const adapter = getSocialPublishingAdapter("NEXTDOOR");
    const config = buildNextdoorPublishConfig({
      urlTemplate: template,
      approvedBy: "admin-1",
    });
    const result = await adapter.publish({
      job: jobFixture({
        provider: "NEXTDOOR",
        payload: { text: "hello neighbors" },
      }),
      accessToken: "token",
      externalAccountId: "profile-9",
      connectorMetadata: { nextdoorPublishConfig: config },
    });
    expect(result.externalPostId).toBe("nd-1");
    expect(result.externalPostUrl).toBe("https://nextdoor.test/p/nd-1");
  });
});

describe("publication verification", () => {
  it("verifies a Facebook post via read-back and captures the permalink", async () => {
    handler = async () => json({ id: "fb1", permalink_url: "https://fb.test/p/fb1" });
    const verification = await verifySocialPublication({
      provider: "FACEBOOK_PAGE",
      accessToken: "token",
      externalPostId: "fb1",
    });
    expect(verification).toMatchObject({
      verificationOk: true,
      method: "READ_BACK",
      permalink: "https://fb.test/p/fb1",
    });
    expect(typeof verification.verifiedAt).toBe("string");
  });

  it("fails verification when the provider does not return the post", async () => {
    handler = async () => json({ error: { code: 803 } }, 404);
    const verification = await verifySocialPublication({
      provider: "X",
      accessToken: "token",
      externalPostId: "missing",
    });
    expect(verification.verificationOk).toBe(false);
    expect(verification.method).toBe("READ_BACK");
  });

  it("treats Nextdoor as not applicable without calling the network", async () => {
    let calls = 0;
    handler = async () => {
      calls += 1;
      return json({});
    };
    const verification = await verifySocialPublication({
      provider: "NEXTDOOR",
      accessToken: "token",
      externalPostId: "nd-1",
      externalPostUrl: "https://nextdoor.test/p/nd-1",
    });
    expect(verification).toMatchObject({
      verificationOk: true,
      method: "NOT_APPLICABLE",
      permalink: "https://nextdoor.test/p/nd-1",
    });
    expect(calls).toBe(0);
  });

  it("round-trips through the job metadata reader", () => {
    const stored = {
      verificationOk: true,
      verifiedAt: "2026-09-29T12:00:00.000Z",
      permalink: "https://x.com/i/web/status/t100",
      method: "READ_BACK",
    };
    expect(readJobVerification({ verification: stored })).toEqual(stored);
    expect(readJobVerification({})).toBeNull();
    expect(readJobVerification({ verification: { nope: true } })).toBeNull();
  });
});

describe("slot semantics", () => {
  it("parses the [slot] route parameter as an hour", () => {
    expect(parseSlotHour("07")).toBe(7);
    expect(parseSlotHour("7")).toBe(7);
    expect(parseSlotHour("23")).toBe(23);
    expect(parseSlotHour("00")).toBe(0);
    expect(parseSlotHour("24")).toBeNull();
    expect(parseSlotHour("abc")).toBeNull();
    expect(parseSlotHour("")).toBeNull();
    expect(parseSlotHour("7.5")).toBeNull();
    expect(parseSlotHour(null)).toBeNull();
    expect(parseSlotHour(undefined)).toBeNull();
  });

  it("builds the UTC hour window for a slot", () => {
    const now = new Date("2026-09-29T12:34:56.000Z");
    const { slotStart, slotEnd } = slotWindowUtc(7, now);
    expect(slotStart.toISOString()).toBe("2026-09-29T07:00:00.000Z");
    expect(slotEnd.toISOString()).toBe("2026-09-29T08:00:00.000Z");
  });

  it("exposes per-provider caps and spacing", () => {
    expect(providerSlotBatchCap("X")).toBe(6);
    expect(providerSlotBatchCap("YOUTUBE")).toBe(2);
    expect(providerMinSpacingMinutes("X")).toBe(10);
    expect(providerMinSpacingMinutes("YOUTUBE")).toBe(60);
  });

  it("derives the claim SQL CASE expressions from the same policy constants", () => {
    // Structural stand-in for a Prisma.sql column reference. The real client
    // cannot be generated in this sandbox; the builders only interpolate the
    // reference, so any object works (cast through never for the stubbed
    // Prisma.Sql parameter type).
    const columnRef = (strings: TemplateStringsArray, ...values: unknown[]) => ({
      text: strings.join("?"),
      bindings: values,
    });
    const asSqlFragment = (value: unknown) =>
      value as unknown as { sql: string; values: unknown[] };
    const caps = asSqlFragment(
      providerSlotCapCaseSql(columnRef`"r"."provider"` as never),
    );
    expect(caps.sql).toContain("CASE");
    // X -> 6 must be one of the bound values.
    expect(caps.values).toContain("X");
    expect(caps.values).toContain(6);
    const spacing = asSqlFragment(
      providerSpacingIntervalSql(columnRef`"prev"."provider"` as never),
    );
    expect(spacing.sql).toContain("make_interval");
    expect(spacing.values).toContain("YOUTUBE");
    expect(spacing.values).toContain(60);
  });
});

describe("provider pause enforcement", () => {
  it("passes when nothing is paused", () => {
    expect(providerPauseState("X", { safeMetadata: {} }).paused).toBe(false);
  });

  it("blocks on connector-level pause flags", () => {
    expect(
      providerPauseState("X", { safeMetadata: { paused: true } }).paused,
    ).toBe(true);
    expect(
      providerPauseState("X", { safeMetadata: { providerPaused: true } }).paused,
    ).toBe(true);
  });

  it("blocks on a workspace pausedProviders list when present", () => {
    expect(
      providerPauseState("X", { safeMetadata: { pausedProviders: ["X"] } })
        .paused,
    ).toBe(true);
    expect(
      providerPauseState("LINKEDIN_COMPANY", {
        safeMetadata: { pausedProviders: ["X"] },
      }).paused,
    ).toBe(false);
  });

  it("blocks on disabled_at defensively", () => {
    expect(
      providerPauseState("X", { disabledAt: new Date(), safeMetadata: {} })
        .paused,
    ).toBe(true);
  });
});

describe("idempotent duplicate-job rejection", () => {
  const base = {
    provider: "X" as const,
    connectorId: "conn-1",
    contentVersionHash: "hash-a",
    approvedVersionHash: "hash-a",
  };

  it("treats an identical request as a safe duplicate", () => {
    expect(isSamePublishingRequest(base, { ...base })).toBe(true);
  });

  it("conflicts when the key is bound to a different request", () => {
    expect(
      isSamePublishingRequest(base, { ...base, connectorId: "conn-2" }),
    ).toBe(false);
    expect(
      isSamePublishingRequest(base, {
        ...base,
        contentVersionHash: "hash-b",
      }),
    ).toBe(false);
    expect(
      isSamePublishingRequest(base, { ...base, provider: "LINKEDIN_COMPANY" }),
    ).toBe(false);
  });
});

describe("media download guardrails", () => {
  it("rejects oversized media before buffering", async () => {
    handler = async () =>
      new Response("x", { headers: { "content-length": "999999" } });
    await expect(
      fetchMediaBytes({
        url: "https://cdn.test/big.bin",
        field: "mediaUrls[0]",
        maxBytes: 10,
        provider: "X",
      }),
    ).rejects.toMatchObject({ code: "X_MEDIA_TOO_LARGE" });
  });

  it("rejects non-HTTPS media URLs", async () => {
    await expect(
      fetchMediaBytes({
        url: "http://cdn.test/a.jpg",
        field: "mediaUrls[0]",
        maxBytes: 100,
        provider: "X",
      }),
    ).rejects.toMatchObject({ code: "INVALID_MEDIA_URL" });
  });
});

describe("capability truth table", () => {
  it("reports every provider honestly", () => {
    const capabilities = getSocialPublishingCapabilities();
    expect(capabilities).toHaveLength(6);
    const byProvider = Object.fromEntries(
      capabilities.map((c) => [c.provider, c]),
    );
    expect(byProvider.X.publishImage).toBe(true);
    expect(byProvider.X.publishVideo).toBe(true);
    expect(byProvider.LINKEDIN_COMPANY.publishVideo).toBe(true);
    expect(byProvider.INSTAGRAM_PROFESSIONAL.publishText).toBe(false);
    expect(byProvider.NEXTDOOR.verification).toBe("not_applicable");
    expect(byProvider.NEXTDOOR.mediaUpload).toBe("not_certified");
    for (const capability of capabilities) {
      expect(capability.notes.trim().length).toBeGreaterThan(0);
    }
  });
});
