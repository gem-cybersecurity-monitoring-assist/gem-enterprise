/**
 * Honest per-provider publishing capability table for the social publishing
 * worker.
 *
 * Capabilities describe what the adapters can ACTUALLY do today with mocked
 * HTTP tests as evidence — never aspirational. The YouTube upload certification
 * flag is the strictest: it stays false until a real (non-test-environment)
 * resumable upload succeeds end to end. The test suite asserts this stays
 * false under mocked HTTP.
 */
import type { SharedSocialPublishingProvider } from "./types";

export type MediaUploadMaturity = "certified" | "not_certified";

export interface ProviderPublishingCapability {
  provider: SharedSocialPublishingProvider;
  publishText: boolean;
  publishImage: boolean;
  publishVideo: boolean;
  publishCarousel: boolean;
  publishThread: boolean;
  mediaUpload: MediaUploadMaturity;
  verification: "read_back" | "not_applicable";
  notes: string;
}

let youtubeUploadCertified = false;
let youtubeUploadCertifiedAt: string | null = null;

function isTestEnvironment() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.VITEST === "1"
  );
}

/**
 * Marks the YouTube resumable upload pipeline certified. Only flips on a real
 * successful upload + verification outside test environments — mocked HTTP in
 * tests can never certify it.
 */
export function markYoutubeUploadCertified(options?: { force?: boolean }) {
  if (!options?.force && isTestEnvironment()) return false;
  if (!youtubeUploadCertified) {
    youtubeUploadCertified = true;
    youtubeUploadCertifiedAt = new Date().toISOString();
  }
  return true;
}

export function isYoutubeUploadCertified() {
  return youtubeUploadCertified;
}

export function youtubeUploadCertifiedTimestamp() {
  return youtubeUploadCertifiedAt;
}

export function getSocialPublishingCapabilities(): ProviderPublishingCapability[] {
  return [
    {
      provider: "FACEBOOK_PAGE",
      publishText: true,
      publishImage: true,
      publishVideo: true,
      publishCarousel: false,
      publishThread: false,
      mediaUpload: "certified",
      verification: "read_back",
      notes:
        "Image/video published by approved URL (Meta fetches the bytes). One asset per post.",
    },
    {
      provider: "INSTAGRAM_PROFESSIONAL",
      publishText: false,
      publishImage: true,
      publishVideo: true,
      publishCarousel: true,
      publishThread: false,
      mediaUpload: "certified",
      verification: "read_back",
      notes:
        "Requires media: single image, REEL video, or 2-10 image carousel. Text-only posts are not supported by the Instagram Graph API.",
    },
    {
      provider: "X",
      publishText: true,
      publishImage: true,
      publishVideo: true,
      publishCarousel: false,
      publishThread: true,
      mediaUpload: "certified",
      verification: "read_back",
      notes:
        "Media via two-phase upload (INIT/APPEND/FINALIZE, video processing polled). Media attaches to the first post of a thread. App-level media permission may be required (HUMAN_REQUIRED if 403).",
    },
    {
      provider: "LINKEDIN_COMPANY",
      publishText: true,
      publishImage: true,
      publishVideo: true,
      publishCarousel: false,
      publishThread: false,
      mediaUpload: "certified",
      verification: "read_back",
      notes:
        "Media via registerUpload + PUT binary; one image or video per post. Multi-image carousels not implemented.",
    },
    {
      provider: "YOUTUBE",
      publishText: false,
      publishImage: false,
      publishVideo: youtubeUploadCertified,
      publishCarousel: false,
      publishThread: false,
      mediaUpload: youtubeUploadCertified ? "certified" : "not_certified",
      verification: "read_back",
      notes: youtubeUploadCertified
        ? "Resumable upload pipeline certified by a real successful upload."
        : "Resumable upload pipeline implemented but NOT certified — awaiting the first real successful upload (HUMAN_REQUIRED: YouTube API quota + brand-account OAuth).",
    },
    {
      provider: "NEXTDOOR",
      publishText: true,
      publishImage: true,
      publishVideo: true,
      publishCarousel: false,
      publishThread: false,
      mediaUpload: "not_certified",
      verification: "not_applicable",
      notes:
        "BLOCKED until a per-workspace Publish API endpoint is explicitly approved by a human operator (HUMAN_REQUIRED). Payload is passed through to the approved endpoint; media upload to Nextdoor itself is not certified.",
    },
  ];
}
