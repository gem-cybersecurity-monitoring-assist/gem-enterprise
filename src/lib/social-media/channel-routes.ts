import type { SocialMediaProviderId } from "./providers";
import type { SocialOAuthProvider } from "./oauth/config";

export const socialChannels = [
  { id: "TIKTOK", label: "TikTok" },
  { id: "FACEBOOK_PAGE", label: "Facebook" },
  { id: "X", label: "X (Twitter)" },
  { id: "INSTAGRAM_PROFESSIONAL", label: "Instagram" },
  { id: "YOUTUBE", label: "YouTube" },
] as const satisfies readonly { id: SocialMediaProviderId; label: string }[];

export const oauthByDestination: Partial<Record<SocialMediaProviderId, SocialOAuthProvider>> = {
  TIKTOK: "TIKTOK",
  FACEBOOK_PAGE: "META",
  INSTAGRAM_PROFESSIONAL: "META",
  X: "X",
  YOUTUBE: "YOUTUBE",
  LINKEDIN_COMPANY: "LINKEDIN",
  NEXTDOOR: "NEXTDOOR",
};

export function socialAccountsHref(provider?: SocialMediaProviderId, workspaceId?: string | null) {
  const params = new URLSearchParams();
  if (provider) params.set("provider", provider);
  if (workspaceId) params.set("workspace", workspaceId);
  return `/app/social-media/accounts${params.size ? `?${params}` : ""}`;
}

export function matchesSocialDestination(
  provider: string,
  metadata: Record<string, unknown>,
  destination?: SocialMediaProviderId,
) {
  if (!destination) return true;
  if (provider !== oauthByDestination[destination]) return false;
  if (destination === "FACEBOOK_PAGE") return metadata.accountType === "META_PAGE";
  if (destination === "INSTAGRAM_PROFESSIONAL") return metadata.accountType === "INSTAGRAM_PROFESSIONAL";
  return true;
}
