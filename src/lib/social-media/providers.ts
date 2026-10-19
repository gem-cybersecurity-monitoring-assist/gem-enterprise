export const socialMediaProviderIds = [
  "TIKTOK",
  "FACEBOOK_PAGE",
  "INSTAGRAM_PROFESSIONAL",
  "X",
  "NEXTDOOR",
  "INDEED_EMPLOYER",
  "LINKEDIN_COMPANY",
  "YOUTUBE",
] as const;

export type SocialMediaProviderId = (typeof socialMediaProviderIds)[number];

export type SocialMediaReadinessState =
  | "CONFIGURATION_REQUIRED"
  | "PLATFORM_APPROVAL_REQUIRED"
  | "AUTHORIZATION_REQUIRED"
  | "HIRING_WORKFLOW_ONLY";

export interface SocialMediaProviderDefinition {
  id: SocialMediaProviderId;
  label: string;
  purpose: string;
  connectionMode: "OAUTH" | "EMPLOYER_FEED";
  supportedContent: readonly string[];
  enableEnv: string;
  requiredEnv: readonly string[];
  approvalEnv?: string;
  liveGateEnv?: string;
  restrictions: readonly string[];
}

export interface SocialMediaProviderReadiness {
  id: SocialMediaProviderId;
  label: string;
  purpose: string;
  connectionMode: SocialMediaProviderDefinition["connectionMode"];
  supportedContent: readonly string[];
  restrictions: readonly string[];
  state: SocialMediaReadinessState;
  configurationEnabled: boolean;
  configurationReady: boolean;
  platformApprovalRequired: boolean;
  platformApprovalGranted: boolean;
  liveGateEnabled: boolean;
  missingConfiguration: string[];
  externalWriteAllowed: false;
}

const sharedTokenEncryptionVariable = "SOCIAL_TOKEN_ENCRYPTION_KEY";

export const socialMediaProviderDefinitions: readonly SocialMediaProviderDefinition[] = [
  {
    id: "TIKTOK",
    label: "TikTok",
    purpose: "Organic short-form video and photo publishing through the existing TokMetric controls.",
    connectionMode: "OAUTH",
    supportedContent: ["SHORT_VIDEO", "PHOTO_POST"],
    enableEnv: "TOKMETRIC_TIKTOK_OAUTH_ENABLED",
    requiredEnv: [
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
      "TIKTOK_REDIRECT_URI",
      "TOKMETRIC_TOKEN_ENCRYPTION_KEY",
    ],
    liveGateEnv: "TOKMETRIC_LIVE_PUBLISHING_ENABLED",
    restrictions: [
      "Exact-version approval is required.",
      "Compliance review and connector scope checks remain mandatory.",
    ],
  },
  {
    id: "FACEBOOK_PAGE",
    label: "Facebook Page",
    purpose: "Page posts, images, videos, and approved campaign updates.",
    connectionMode: "OAUTH",
    supportedContent: ["TEXT", "IMAGE", "VIDEO", "LINK"],
    enableEnv: "META_SOCIAL_OAUTH_ENABLED",
    requiredEnv: [
      "META_GRAPH_API_VERSION",
      "META_APP_ID",
      "META_APP_SECRET",
      "META_SOCIAL_SCOPES",
      "META_OAUTH_REDIRECT_URI",
      sharedTokenEncryptionVariable,
    ],
    approvalEnv: "META_APP_REVIEW_APPROVED",
    liveGateEnv: "META_SOCIAL_PUBLISHING_ENABLED",
    restrictions: [
      "Personal-profile automation is not supported.",
      "A connected Facebook Page and approved permissions are required.",
    ],
  },
  {
    id: "INSTAGRAM_PROFESSIONAL",
    label: "Instagram Professional",
    purpose: "Reels, image posts, and carousels for Business or Creator accounts.",
    connectionMode: "OAUTH",
    supportedContent: ["REEL", "IMAGE", "CAROUSEL"],
    enableEnv: "META_SOCIAL_OAUTH_ENABLED",
    requiredEnv: [
      "META_GRAPH_API_VERSION",
      "META_APP_ID",
      "META_APP_SECRET",
      "META_SOCIAL_SCOPES",
      "META_OAUTH_REDIRECT_URI",
      sharedTokenEncryptionVariable,
    ],
    approvalEnv: "META_APP_REVIEW_APPROVED",
    liveGateEnv: "META_SOCIAL_PUBLISHING_ENABLED",
    restrictions: [
      "A professional Instagram account is required.",
      "The account must be connected through the approved Meta business relationship.",
    ],
  },
  {
    id: "X",
    label: "X",
    purpose: "Text, image, and video posts for the authorized company account.",
    connectionMode: "OAUTH",
    supportedContent: ["TEXT", "IMAGE", "VIDEO", "THREAD"],
    enableEnv: "X_SOCIAL_OAUTH_ENABLED",
    requiredEnv: [
      "X_CLIENT_ID",
      "X_CLIENT_SECRET",
      "X_SOCIAL_SCOPES",
      "X_OAUTH_REDIRECT_URI",
      sharedTokenEncryptionVariable,
    ],
    liveGateEnv: "X_SOCIAL_PUBLISHING_ENABLED",
    restrictions: ["Only approved company-account publishing is permitted."],
  },
  {
    id: "NEXTDOOR",
    label: "Nextdoor",
    purpose: "Local-business and neighborhood-relevant service information.",
    connectionMode: "OAUTH",
    supportedContent: ["LOCAL_UPDATE", "IMAGE", "LINK"],
    enableEnv: "NEXTDOOR_OAUTH_ENABLED",
    requiredEnv: [
      "NEXTDOOR_CLIENT_ID",
      "NEXTDOOR_CLIENT_SECRET",
      "NEXTDOOR_SOCIAL_SCOPES",
      "NEXTDOOR_OAUTH_REDIRECT_URI",
      sharedTokenEncryptionVariable,
    ],
    approvalEnv: "NEXTDOOR_PUBLISH_API_ACCESS_APPROVED",
    liveGateEnv: "NEXTDOOR_PUBLISHING_ENABLED",
    restrictions: [
      "Content must be locally relevant.",
      "Publishing requires approved Publish API access and an authorized Nextdoor identity or business page.",
    ],
  },
  {
    id: "INDEED_EMPLOYER",
    label: "Indeed Employer",
    purpose: "Verified job openings and employer updates only.",
    connectionMode: "EMPLOYER_FEED",
    supportedContent: ["JOB_POSTING", "EMPLOYER_UPDATE"],
    enableEnv: "INDEED_EMPLOYER_INTEGRATION_ENABLED",
    requiredEnv: ["INDEED_EMPLOYER_ID", "INDEED_JOB_FEED_URL"],
    liveGateEnv: "INDEED_JOB_PUBLISHING_ENABLED",
    restrictions: [
      "General marketing posts are prohibited.",
      "A genuine approved vacancy or employer update is required.",
    ],
  },
  {
    id: "LINKEDIN_COMPANY",
    label: "LinkedIn Company",
    purpose: "Enterprise thought leadership, company updates, and recruitment content.",
    connectionMode: "OAUTH",
    supportedContent: ["TEXT", "IMAGE", "VIDEO", "ARTICLE", "JOB_LINK"],
    enableEnv: "LINKEDIN_SOCIAL_OAUTH_ENABLED",
    requiredEnv: [
      "LINKEDIN_CLIENT_ID",
      "LINKEDIN_CLIENT_SECRET",
      "LINKEDIN_SOCIAL_SCOPES",
      "LINKEDIN_API_VERSION",
      "LINKEDIN_OAUTH_REDIRECT_URI",
      sharedTokenEncryptionVariable,
    ],
    approvalEnv: "LINKEDIN_COMMUNITY_MANAGEMENT_ACCESS_APPROVED",
    liveGateEnv: "LINKEDIN_SOCIAL_PUBLISHING_ENABLED",
    restrictions: [
      "Publishing is limited to an authorized company organization.",
      "Community Management API access and organization role checks are required.",
    ],
  },
  {
    id: "YOUTUBE",
    label: "YouTube",
    purpose: "Shorts and long-form educational or service videos.",
    connectionMode: "OAUTH",
    supportedContent: ["SHORT_VIDEO", "LONG_VIDEO"],
    enableEnv: "YOUTUBE_SOCIAL_OAUTH_ENABLED",
    requiredEnv: [
      "GOOGLE_SOCIAL_CLIENT_ID",
      "GOOGLE_SOCIAL_CLIENT_SECRET",
      "YOUTUBE_SOCIAL_SCOPES",
      "YOUTUBE_OAUTH_REDIRECT_URI",
      sharedTokenEncryptionVariable,
    ],
    approvalEnv: "YOUTUBE_DATA_API_AUDIT_APPROVED",
    liveGateEnv: "YOUTUBE_PUBLISHING_ENABLED",
    restrictions: [
      "A connected YouTube Brand Account or authorized channel is required.",
      "Public uploads require the applicable Google project verification or audit.",
    ],
  },
];

function enabled(env: NodeJS.ProcessEnv, name: string) {
  return env[name] === "true";
}

function missingVariables(env: NodeJS.ProcessEnv, names: readonly string[]) {
  return names.filter((name) => !env[name]?.trim());
}

export function getSocialMediaProviderReadiness(
  env: NodeJS.ProcessEnv = process.env,
): SocialMediaProviderReadiness[] {
  return socialMediaProviderDefinitions.map((provider) => {
    const missingConfiguration = missingVariables(env, provider.requiredEnv);
    const configurationEnabled = enabled(env, provider.enableEnv);
    const configurationReady = configurationEnabled && missingConfiguration.length === 0;
    const platformApprovalRequired = Boolean(provider.approvalEnv);
    const platformApprovalGranted = !provider.approvalEnv || enabled(env, provider.approvalEnv);
    const liveGateEnabled =
      enabled(env, "SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED") &&
      platformApprovalGranted &&
      (!provider.liveGateEnv || enabled(env, provider.liveGateEnv));

    let state: SocialMediaReadinessState = "CONFIGURATION_REQUIRED";
    if (configurationReady && !platformApprovalGranted) state = "PLATFORM_APPROVAL_REQUIRED";
    else if (configurationReady && provider.id === "INDEED_EMPLOYER") state = "HIRING_WORKFLOW_ONLY";
    else if (configurationReady) state = "AUTHORIZATION_REQUIRED";

    return {
      id: provider.id,
      label: provider.label,
      purpose: provider.purpose,
      connectionMode: provider.connectionMode,
      supportedContent: provider.supportedContent,
      restrictions: provider.restrictions,
      state,
      configurationEnabled,
      configurationReady,
      platformApprovalRequired,
      platformApprovalGranted,
      liveGateEnabled,
      missingConfiguration,
      externalWriteAllowed: false,
    };
  });
}
