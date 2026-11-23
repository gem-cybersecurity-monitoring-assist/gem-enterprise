import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildComfyOutputUrl,
  buildStorageObjectPath,
  buildStorageObjectUrl,
  computeBackoffMs,
  fetchWorkerJobs,
  loadVideoWorkerConfig,
  mimeTypeForFileName,
  sanitizePathSegment,
  selectVideoOutput,
  verifyUploadedVideo,
  VideoWorkerError,
  type DownloadedVideo,
  type VideoWorkerConfig,
  type VideoWorkerJob,
} from "@/lib/video/worker-runtime";

const config: VideoWorkerConfig = {
  gemBaseUrl: "https://www.gemcybersecurityassist.com",
  callbackSecret: "callback-secret",
  comfyBaseUrl: "https://comfy.example.com",
  comfyBearerToken: "comfy-secret",
  storageBaseUrl: "https://project.supabase.co",
  storageKey: "storage-key",
  storageBucket: "gem-video-renders",
  storagePrefix: "renders",
  stateDirectory: "/tmp/gem-video-worker-runtime-test",
  batchSize: 5,
  dispatchLeaseMs: 120_000,
  pollIntervalMs: 15_000,
  maxFileBytes: 1024 * 1024,
  requestTimeoutMs: 30_000,
  transferTimeoutMs: 15 * 60_000,
};

const job: VideoWorkerJob = {
  renderJobId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "workspace-1",
  contentId: "content-1",
  contentVersionId: "version-1",
  promptId: "prompt-1",
  state: "COMPLETED",
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T00:05:00.000Z",
};

const downloaded: DownloadedVideo = {
  tempDirectory: "/tmp/gem-video-test",
  tempPath: "/tmp/gem-video-test/render.mp4",
  fileName: "render.mp4",
  mimeType: "video/mp4",
  fileSize: 2048,
  checksumSha256: "a".repeat(64),
};

describe("trusted video render worker runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails closed when required configuration is missing", () => {
    expect(() => loadVideoWorkerConfig({})).toThrowError(
      expect.objectContaining({ code: "WORKER_CONFIGURATION_MISSING" }),
    );
  });

  it("loads bounded worker configuration without exposing secrets", () => {
    const loaded = loadVideoWorkerConfig({
      GEM_VIDEO_WORKER_API_URL: "https://www.gemcybersecurityassist.com/",
      VIDEO_RENDER_CALLBACK_SECRET: "callback-secret",
      COMFYUI_BASE_URL: "https://comfy.example.com/",
      VIDEO_RENDER_STORAGE_URL: "https://project.supabase.co/",
      VIDEO_RENDER_STORAGE_KEY: "storage-key",
      VIDEO_RENDER_STORAGE_BUCKET: "gem-video-renders",
      VIDEO_RENDER_WORKER_STATE_DIR: "/var/lib/gem-video-render-worker",
      VIDEO_RENDER_WORKER_BATCH_SIZE: "10",
      VIDEO_RENDER_WORKER_DISPATCH_LEASE_MS: "180000",
      VIDEO_RENDER_WORKER_POLL_MS: "5000",
      VIDEO_RENDER_MAX_FILE_BYTES: "4096",
      VIDEO_RENDER_WORKER_TRANSFER_TIMEOUT_MS: "60000",
    });

    expect(loaded).toMatchObject({
      gemBaseUrl: "https://www.gemcybersecurityassist.com",
      comfyBaseUrl: "https://comfy.example.com",
      storageBaseUrl: "https://project.supabase.co",
      storageBucket: "gem-video-renders",
      stateDirectory: resolve("/var/lib/gem-video-render-worker"),
      batchSize: 10,
      dispatchLeaseMs: 180_000,
      pollIntervalMs: 5000,
      maxFileBytes: 4096,
      transferTimeoutMs: 60_000,
    });
  });

  it("requires HTTPS for GEM and storage but permits localhost ComfyUI", () => {
    expect(() =>
      loadVideoWorkerConfig({
        GEM_VIDEO_WORKER_API_URL: "http://gem.example.com",
        VIDEO_RENDER_CALLBACK_SECRET: "callback-secret",
        COMFYUI_BASE_URL: "http://localhost:8188",
        VIDEO_RENDER_STORAGE_URL: "https://project.supabase.co",
        VIDEO_RENDER_STORAGE_KEY: "storage-key",
        VIDEO_RENDER_STORAGE_BUCKET: "gem-video-renders",
      }),
    ).toThrowError(expect.objectContaining({ code: "WORKER_CONFIGURATION_INVALID" }));

    expect(
      loadVideoWorkerConfig({
        GEM_VIDEO_WORKER_API_URL: "https://www.gemcybersecurityassist.com",
        VIDEO_RENDER_CALLBACK_SECRET: "callback-secret",
        COMFYUI_BASE_URL: "http://127.0.0.1:8188",
        VIDEO_RENDER_STORAGE_URL: "https://project.supabase.co",
        VIDEO_RENDER_STORAGE_KEY: "storage-key",
        VIDEO_RENDER_STORAGE_BUCKET: "gem-video-renders",
      }).comfyBaseUrl,
    ).toBe("http://127.0.0.1:8188");
  });

  it("sanitizes deterministic object path segments", () => {
    expect(sanitizePathSegment(" ../GEM render / 01 ")).toBe("GEM-render-01");
    expect(() => sanitizePathSegment("../..")).toThrow(VideoWorkerError);
  });

  it("selects a supported output and prefers MP4 output files", () => {
    const selected = selectVideoOutput({
      "10": {
        videos: [
          { filename: "secondary.webm", subfolder: "clips", type: "output" },
          { filename: "primary.mp4", subfolder: "clips", type: "output" },
        ],
      },
      "11": {
        images: [{ filename: "preview.png", type: "temp" }],
      },
    });

    expect(selected).toEqual({
      fileName: "primary.mp4",
      subfolder: "clips",
      type: "output",
      mimeType: "video/mp4",
    });
    expect(mimeTypeForFileName("clip.mov")).toBe("video/quicktime");
    expect(mimeTypeForFileName("preview.png")).toBeNull();
  });

  it("rejects completed manifests without a video file", () => {
    expect(() =>
      selectVideoOutput({ "10": { images: [{ filename: "preview.png" }] } }),
    ).toThrowError(expect.objectContaining({ code: "VIDEO_OUTPUT_NOT_FOUND" }));
  });

  it("builds a deterministic private object path and encoded URLs", () => {
    const path = buildStorageObjectPath({
      storagePrefix: "renders",
      job,
      checksumSha256: "b".repeat(64),
      fileName: "GEM final video.mp4",
    });
    expect(path).toBe(
      `renders/workspace-1/content-1/${job.renderJobId}/${"b".repeat(64)}-GEM-final-video.mp4`,
    );
    expect(buildStorageObjectUrl(config, path)).toContain(
      "/storage/v1/object/gem-video-renders/renders/workspace-1/content-1/",
    );
    expect(
      buildComfyOutputUrl(config, {
        fileName: "GEM final.mp4",
        subfolder: "daily clips",
        type: "output",
        mimeType: "video/mp4",
      }),
    ).toContain("filename=GEM+final.mp4");
  });

  it("uses a bounded exponential retry schedule", () => {
    expect(computeBackoffMs(0)).toBe(1000);
    expect(computeBackoffMs(3)).toBe(8000);
    expect(computeBackoffMs(20)).toBe(60_000);
  });

  it("authenticates and validates the worker job feed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { jobs: [job], externalPublicationTaken: false },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchWorkerJobs(config);
    expect(jobs).toEqual([job]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/video/worker/jobs?limit=5"),
      expect.objectContaining({
        headers: { Authorization: "Bearer callback-secret" },
      }),
    );
  });

  it("surfaces a failed upload-verification callback without leaking its body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "sensitive provider detail" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      verifyUploadedVideo(
        config,
        job,
        downloaded,
        "https://project.supabase.co/storage/v1/object/gem-video-renders/render.mp4",
        {},
      ),
    ).rejects.toMatchObject({
      code: "VIDEO_UPLOAD_CALLBACK_FAILED",
      status: 503,
      message: "The GEM upload-verification callback returned HTTP 503.",
    });
  });
});
