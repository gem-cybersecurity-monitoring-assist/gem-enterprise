import type {
  ApprovedSourceMaterial,
  DailyContentDraft,
  MarketSignal,
} from "../planning/daily-flow";
import type { SocialMediaProviderId } from "../providers";

export type ContentRiskCategory =
  | "UNSUPPORTED_CLAIM"
  | "SECURITY_SENSITIVE_DETAIL"
  | "REGULATORY_CLAIM"
  | "LOCAL_CONTEXT_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "AUTO_POLICY_REQUIRED";

export type ContentRiskSeverity = "INFO" | "WARNING" | "BLOCK";

export interface ContentRiskFlag {
  code: string;
  category: ContentRiskCategory;
  severity: ContentRiskSeverity;
  message: string;
  matchedText?: string;
}

export interface VideoScene {
  sequence: number;
  durationSeconds: number;
  visualDirection: string;
  narration: string;
  onScreenText: string;
  humanPresence: "REQUIRED" | "OPTIONAL";
}

export interface VideoRecipe {
  format: "VERTICAL_SHORT" | "LANDSCAPE";
  durationSeconds: number;
  aspectRatio: "9:16" | "16:9";
  voiceDirection: string;
  cameraDirection: string;
  musicDirection: string;
  captionsRequired: true;
  script: string;
  scenes: VideoScene[];
  rendererInput: {
    version: 1;
    scenes: VideoScene[];
    subtitles: true;
    humanReviewRequired: boolean;
  };
}

export interface VisualBrief {
  type: "SINGLE_IMAGE" | "CAROUSEL";
  headline: string;
  artDirection: string;
  accessibilityText: string;
  slides: Array<{
    sequence: number;
    headline: string;
    body: string;
    visualDirection: string;
  }>;
}

export interface PlatformPublicationCopy {
  provider: SocialMediaProviderId;
  caption: string;
  hashtags: string[];
  callToAction: string;
  localContext?: string;
}

export interface PublishingChecklistItem {
  code: string;
  label: string;
  required: true;
  completed: false;
}

export interface CrossPlatformContentPackage {
  fingerprint: string;
  provider: SocialMediaProviderId;
  contentType: DailyContentDraft["contentType"];
  title: string;
  shortVideo: VideoRecipe;
  visualBrief: VisualBrief;
  publication: PlatformPublicationCopy;
  sourceEvidence: {
    sourceMaterialId: string;
    sourceReference: string;
    signalId: string;
    signalReference: string;
  };
  riskFlags: ContentRiskFlag[];
  publishingChecklist: PublishingChecklistItem[];
  approvalRequired: true;
  complianceReviewRequired: true;
  externalActionTaken: false;
}

const securitySensitivePatterns: Array<[RegExp, string]> = [
  [/\b(?:api[_ -]?key|client secret|access token|private key|password)\b/i, "Credential or secret reference detected."],
  [/\b(?:internal ip|private ip|firewall rule|security group id|admin endpoint)\b/i, "Internal infrastructure detail detected."],
  [/\b(?:exploit chain|payload execution|bypass authentication|disable logging)\b/i, "Potentially operational attack detail detected."],
];

const unsupportedClaimPatterns: Array<[RegExp, string]> = [
  [/\b(?:100% secure|unhackable|breach[- ]proof|guaranteed protection)\b/i, "Absolute cybersecurity outcome is not supportable."],
  [/\b(?:prevent every attack|eliminate all risk|zero risk)\b/i, "Universal prevention or zero-risk claim is not supportable."],
  [/\b(?:guaranteed savings|guaranteed return|risk[- ]free return)\b/i, "Guaranteed financial outcome is not supportable."],
];

const regulatoryPatterns: Array<[RegExp, string]> = [
  [/\b(?:HIPAA|GDPR|PCI DSS|SOC 2|ISO 27001|CMMC|NIST)\b/i, "Named framework or regulatory reference requires evidence and scope review."],
  [/\b(?:certified compliant|fully compliant|regulator approved)\b/i, "Certification or regulatory-approval claim requires documentary evidence."],
];

function normalizeHashtag(value: string) {
  const normalized = value
    .replace(/^#+/, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();
  return normalized ? `#${normalized}` : "";
}

function truncate(value: string, max: number) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function scanText(text: string): ContentRiskFlag[] {
  const flags: ContentRiskFlag[] = [];
  for (const [pattern, message] of unsupportedClaimPatterns) {
    const match = text.match(pattern);
    if (match) {
      flags.push({
        code: "UNSUPPORTED_ABSOLUTE_CLAIM",
        category: "UNSUPPORTED_CLAIM",
        severity: "BLOCK",
        message,
        matchedText: match[0],
      });
    }
  }
  for (const [pattern, message] of securitySensitivePatterns) {
    const match = text.match(pattern);
    if (match) {
      flags.push({
        code: "SECURITY_SENSITIVE_DETAIL",
        category: "SECURITY_SENSITIVE_DETAIL",
        severity: "BLOCK",
        message,
        matchedText: match[0],
      });
    }
  }
  for (const [pattern, message] of regulatoryPatterns) {
    const match = text.match(pattern);
    if (match) {
      flags.push({
        code: "REGULATORY_EVIDENCE_REQUIRED",
        category: "REGULATORY_CLAIM",
        severity: "WARNING",
        message,
        matchedText: match[0],
      });
    }
  }
  return flags;
}

function platformHashtags(provider: SocialMediaProviderId, topic: string) {
  const topicTags = topic
    .split(/\s+/)
    .filter((part) => part.length > 3)
    .slice(0, 3)
    .map(normalizeHashtag)
    .filter(Boolean);
  const base = [
    "#GEMCybersecurity",
    "#Cybersecurity",
    "#RiskManagement",
    "#SecurityAwareness",
  ];
  const limits: Record<SocialMediaProviderId, number> = {
    TIKTOK: 8,
    FACEBOOK_PAGE: 5,
    INSTAGRAM_PROFESSIONAL: 12,
    X: 4,
    NEXTDOOR: 3,
    INDEED_EMPLOYER: 0,
    LINKEDIN_COMPANY: 5,
    YOUTUBE: 8,
  };
  return [...new Set([...base, ...topicTags])].slice(0, limits[provider]);
}

function platformCaption(input: {
  provider: SocialMediaProviderId;
  hook: string;
  explanation: string;
  action: string;
  localContext?: string;
}) {
  const { provider, hook, explanation, action, localContext } = input;
  if (provider === "TIKTOK") {
    return truncate(`${hook}\n\n${explanation}\n\n${action}`, 1800);
  }
  if (provider === "FACEBOOK_PAGE") {
    return truncate(`${hook}\n\n${explanation}\n\n${action}`, 4000);
  }
  if (provider === "INSTAGRAM_PROFESSIONAL") {
    return truncate(`${hook}\n\n${explanation}\n\n${action}`, 2100);
  }
  if (provider === "X") {
    return truncate(`${hook} ${explanation} ${action}`, 260);
  }
  if (provider === "NEXTDOOR") {
    return truncate(
      `${localContext ? `${localContext}\n\n` : ""}${hook}\n\n${explanation}\n\n${action}`,
      3000,
    );
  }
  if (provider === "INDEED_EMPLOYER") {
    return truncate(`${hook}\n\n${explanation}\n\n${action}`, 3500);
  }
  if (provider === "LINKEDIN_COMPANY") {
    return truncate(`${hook}\n\n${explanation}\n\n${action}`, 2900);
  }
  return truncate(`${hook}\n\n${explanation}\n\n${action}`, 4500);
}

function buildScenes(input: {
  hook: string;
  signal: MarketSignal;
  source: ApprovedSourceMaterial;
  action: string;
}): VideoScene[] {
  return [
    {
      sequence: 1,
      durationSeconds: 5,
      visualDirection: "Human presenter on camera in a professional operations setting; direct eye contact.",
      narration: input.hook,
      onScreenText: truncate(input.hook, 72),
      humanPresence: "REQUIRED",
    },
    {
      sequence: 2,
      durationSeconds: 9,
      visualDirection: "Show a restrained, non-sensitive visualization of the current market signal.",
      narration: input.signal.summary,
      onScreenText: truncate(input.signal.topic, 72),
      humanPresence: "OPTIONAL",
    },
    {
      sequence: 3,
      durationSeconds: 12,
      visualDirection: "Return to the presenter with approved service visuals and no customer or infrastructure data.",
      narration: input.source.summary,
      onScreenText: truncate(input.source.title, 72),
      humanPresence: "REQUIRED",
    },
    {
      sequence: 4,
      durationSeconds: 7,
      visualDirection: "Presenter closes with a clear next step and the canonical GEM destination.",
      narration: input.action,
      onScreenText: truncate(input.action, 72),
      humanPresence: "REQUIRED",
    },
  ];
}

function buildVisualBrief(input: {
  draft: DailyContentDraft;
  source: ApprovedSourceMaterial;
  signal: MarketSignal;
  action: string;
}): VisualBrief {
  const slides = [
    {
      sequence: 1,
      headline: truncate(input.signal.topic, 80),
      body: "What organizations should understand today.",
      visualDirection: "Strong title card using approved GEM branding; no fear-based imagery.",
    },
    {
      sequence: 2,
      headline: "Why it matters",
      body: truncate(input.signal.summary, 180),
      visualDirection: "Simple trend or attention indicator without fabricated statistics.",
    },
    {
      sequence: 3,
      headline: truncate(input.source.title, 80),
      body: truncate(input.source.summary, 180),
      visualDirection: "Approved service imagery with clear scope language.",
    },
    {
      sequence: 4,
      headline: "Next step",
      body: truncate(input.action, 180),
      visualDirection: "Canonical GEM call-to-action and accessible high-contrast typography.",
    },
  ];
  const carousel = ["CAROUSEL", "PHOTO_POST", "ARTICLE"].includes(
    input.draft.contentType,
  );
  return {
    type: carousel ? "CAROUSEL" : "SINGLE_IMAGE",
    headline: truncate(`${input.signal.topic}: ${input.source.title}`, 100),
    artDirection:
      "Professional, realistic security-operations aesthetic; use approved GEM brand assets; never depict real credentials, customer systems, exploit steps, or fabricated dashboards.",
    accessibilityText: `Educational visual about ${input.signal.topic} and ${input.source.title}.`,
    slides: carousel ? slides : [slides[0]],
  };
}

function publishingChecklist(
  provider: SocialMediaProviderId,
  approvalMode: "HUMAN" | "AUTO_POLICY",
): PublishingChecklistItem[] {
  const common: PublishingChecklistItem[] = [
    { code: "SOURCE_APPROVED", label: "Confirm the source material remains approved and current.", required: true, completed: false },
    { code: "CLAIMS_REVIEWED", label: "Resolve all unsupported, regulatory, and security-sensitive claim flags.", required: true, completed: false },
    { code: "MEDIA_RIGHTS", label: "Confirm ownership or licensing for every visual, voice, music, and media asset.", required: true, completed: false },
    { code: "ACCESSIBILITY", label: "Confirm captions, readable text, and image alt text.", required: true, completed: false },
    {
      code: "EXACT_VERSION_APPROVAL",
      label:
        approvalMode === "AUTO_POLICY"
          ? "Require a passing automated policy decision bound to the exact version hash."
          : "Obtain approval from a different authorized operator for the exact version hash.",
      required: true,
      completed: false,
    },
    { code: "DESTINATION_SELECTED", label: "Select the exact healthy destination connector; never auto-select an account.", required: true, completed: false },
    { code: "LIVE_GATES", label: "Confirm global and provider-specific publishing gates and emergency locks.", required: true, completed: false },
  ];
  if (provider === "NEXTDOOR") {
    common.splice(1, 0, {
      code: "LOCAL_CONTEXT",
      label: "Confirm documented local relevance and the authorized neighborhood or business identity.",
      required: true,
      completed: false,
    });
  }
  if (provider === "INDEED_EMPLOYER") {
    common.splice(1, 0, {
      code: "GENUINE_EMPLOYER_CONTENT",
      label: "Confirm a genuine open role with vacancy ID or an approved employer update.",
      required: true,
      completed: false,
    });
  }
  return common;
}

export function generateCrossPlatformContentPackage(input: {
  draft: DailyContentDraft;
  source: ApprovedSourceMaterial;
  signal: MarketSignal;
  localContext?: string;
  approvalMode?: "HUMAN" | "AUTO_POLICY";
}): CrossPlatformContentPackage {
  const hook = `What does ${input.signal.topic} mean for your organization today?`;
  const explanation = `${input.signal.summary} ${input.source.summary}`.trim();
  const action = input.source.callToAction.trim();
  const caption = platformCaption({
    provider: input.draft.provider,
    hook,
    explanation,
    action,
    localContext: input.localContext,
  });
  const scenes = buildScenes({ hook, signal: input.signal, source: input.source, action });
  const script = scenes.map((scene) => scene.narration).join("\n\n");
  const riskFlags = scanText(
    [
      input.source.title,
      input.source.summary,
      input.signal.topic,
      input.signal.summary,
      caption,
      script,
    ].join("\n"),
  );

  if (input.draft.provider === "NEXTDOOR" && !input.localContext?.trim()) {
    riskFlags.push({
      code: "NEXTDOOR_LOCAL_CONTEXT_REQUIRED",
      category: "LOCAL_CONTEXT_REQUIRED",
      severity: "BLOCK",
      message: "Nextdoor publication requires documented local context.",
    });
  }

  if (input.approvalMode === "AUTO_POLICY") {
    riskFlags.push({
      code: "EXACT_VERSION_AUTO_POLICY_REQUIRED",
      category: "AUTO_POLICY_REQUIRED",
      severity: "INFO",
      message:
        "The exact generated version must pass the autonomous policy gate before it can enter the publishing queue.",
    });
  } else {
    riskFlags.push({
      code: "EXACT_VERSION_HUMAN_APPROVAL_REQUIRED",
      category: "HUMAN_APPROVAL_REQUIRED",
      severity: "INFO",
      message:
        "A different authorized operator must approve the exact generated version before publication.",
    });
  }

  const format =
    input.draft.provider === "YOUTUBE" && input.draft.contentType === "LONG_VIDEO"
      ? "LANDSCAPE"
      : "VERTICAL_SHORT";
  const durationSeconds = scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );

  return {
    fingerprint: input.draft.fingerprint,
    provider: input.draft.provider,
    contentType: input.draft.contentType,
    title: truncate(`${input.signal.topic} — ${input.draft.angle}`, 190),
    shortVideo: {
      format,
      durationSeconds,
      aspectRatio: format === "LANDSCAPE" ? "16:9" : "9:16",
      voiceDirection:
        "Natural, confident human delivery. Avoid synthetic urgency, fear tactics, and claims beyond the approved source.",
      cameraDirection:
        "Use a real presenter where available; medium close-up, direct eye contact, clean lighting, and realistic operations visuals.",
      musicDirection:
        "Optional low-volume licensed instrumental bed; narration and accessibility captions remain primary.",
      captionsRequired: true,
      script,
      scenes,
      rendererInput: {
        version: 1,
        scenes,
        subtitles: true,
        humanReviewRequired: input.approvalMode !== "AUTO_POLICY",
      },
    },
    visualBrief: buildVisualBrief({
      draft: input.draft,
      source: input.source,
      signal: input.signal,
      action,
    }),
    publication: {
      provider: input.draft.provider,
      caption,
      hashtags: platformHashtags(input.draft.provider, input.signal.topic),
      callToAction: action,
      localContext: input.localContext?.trim() || undefined,
    },
    sourceEvidence: {
      sourceMaterialId: input.source.id,
      sourceReference: input.source.sourceReference,
      signalId: input.signal.id,
      signalReference: input.signal.sourceReference,
    },
    riskFlags,
    publishingChecklist: publishingChecklist(
      input.draft.provider,
      input.approvalMode ?? "HUMAN",
    ),
    approvalRequired: true,
    complianceReviewRequired: true,
    externalActionTaken: false,
  };
}
