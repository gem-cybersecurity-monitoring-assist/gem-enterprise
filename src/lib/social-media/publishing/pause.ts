/**
 * Provider-scoped pause enforcement for the governed social publishing worker.
 *
 * WS-A owns the connector pause contract. Until that contract is visible in
 * the repo, this module checks every pause signal that exists today:
 * - connector.disabled_at (already enforced by credential loading / job
 *   creation, re-checked here defensively), and
 * - connector safe_metadata pause flags: `paused === true`,
 *   `providerPaused === true`, or a `pausedProviders` list containing the
 *   provider name.
 *
 * When WS-A documents its contract, extend providerPauseState — the worker
 * calls only this function, so the call site does not change.
 */
import type { SharedSocialPublishingProvider } from "./types";
import {
  isSocialProviderPaused,
  type SocialPauseProvider,
} from "@/lib/social-media/oauth/provider-pause";

const pauseKeyForPublishingProvider: Record<SharedSocialPublishingProvider, SocialPauseProvider> = {
  FACEBOOK_PAGE: "META",
  INSTAGRAM_PROFESSIONAL: "META",
  X: "X",
  LINKEDIN_COMPANY: "LINKEDIN",
  YOUTUBE: "YOUTUBE",
  NEXTDOOR: "NEXTDOOR",
  TELEGRAM: "TELEGRAM",
};

/** Fail closed when the persistent pause store is unavailable or paused. */
export async function persistentProviderPauseState(
  workspaceId: string,
  provider: SharedSocialPublishingProvider,
): Promise<ProviderPauseState> {
  const paused = await isSocialProviderPaused(
    workspaceId,
    pauseKeyForPublishingProvider[provider],
  );
  return paused
    ? { paused: true, reason: `Publishing for ${provider} is paused in this workspace.` }
    : { paused: false };
}


export interface ProviderPauseState {
  paused: boolean;
  reason?: string;
}

export function providerPauseState(
  provider: SharedSocialPublishingProvider,
  connector: {
    disabledAt?: Date | string | null;
    safeMetadata?: Record<string, unknown> | null;
  },
): ProviderPauseState {
  if (connector.disabledAt) {
    return {
      paused: true,
      reason: "The social connector is disabled.",
    };
  }
  const metadata = connector.safeMetadata ?? {};
  if (metadata.paused === true || metadata.providerPaused === true) {
    return {
      paused: true,
      reason: `Publishing for ${provider} is paused on this connector by an operator.`,
    };
  }
  const pausedProviders = metadata.pausedProviders;
  if (
    Array.isArray(pausedProviders) &&
    pausedProviders.some(
      (entry) => typeof entry === "string" && entry === provider,
    )
  ) {
    return {
      paused: true,
      reason: `Publishing for ${provider} is paused for this workspace by an operator.`,
    };
  }
  return { paused: false };
}
