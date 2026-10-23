export interface SupportKnowledgeLink {
  title: string;
  href: string;
  description: string;
}

interface SupportKnowledgeEntry extends SupportKnowledgeLink {
  keywords: readonly string[];
  guidance: string;
}

const SUPPORT_KNOWLEDGE: readonly SupportKnowledgeEntry[] = [
  {
    title: "Account security",
    href: "/app/security",
    description: "Password, access, and account-security controls.",
    keywords: ["password", "login", "sign in", "access", "locked", "security"],
    guidance:
      "Direct authenticated members to Account Security for password and access controls. Never ask for a password, one-time code, recovery code, API key, private key, or session cookie.",
  },
  {
    title: "Organization workspace",
    href: "/app/workspace",
    description: "Organization projects, members, workstreams, and workspace status.",
    keywords: ["workspace", "organization", "organisation", "company", "team", "project", "member"],
    guidance:
      "Use the organization workspace for the member's own projects and team activity. Access remains limited by membership and assigned workspace role.",
  },
  {
    title: "Requests",
    href: "/app/requests",
    description: "Create and track service or operational requests.",
    keywords: ["request", "case", "ticket", "help", "issue", "problem", "follow up"],
    guidance:
      "Use Requests to create a durable service case and track its status. Do not promise a response time unless the signed service scope states one.",
  },
  {
    title: "Human support",
    href: "/app/support",
    description: "Contact GEM support or continue with a human-support case.",
    keywords: ["human", "agent", "advisor", "representative", "live support", "customer service", "support"],
    guidance:
      "A member can request human support at any time. Record the handoff as a durable GEM support case and state truthfully whether an external service desk accepted it.",
  },
  {
    title: "Verification status",
    href: "/app/compliance",
    description: "Review verification and compliance status.",
    keywords: ["kyc", "verify", "verification", "compliance", "identity", "review status"],
    guidance:
      "Explain where the member can review verification status. Never decide identity, fraud, eligibility, or compliance outcomes; route those decisions to an authorized reviewer.",
  },
  {
    title: "Documents",
    href: "/app/documents",
    description: "Review available account and compliance documents.",
    keywords: ["document", "statement", "report", "upload", "file", "certificate"],
    guidance:
      "Direct members to Documents for available records. Sensitive upload remains unavailable unless private storage and malware scanning are verified end to end.",
  },
  {
    title: "Products and services",
    href: "/app/products",
    description: "Review scoped products, services, and entitlements.",
    keywords: [
      "product",
      "service",
      "entitlement",
      "plan",
      "coverage",
      "activate",
      "offer",
      "capability",
      "capabilities",
      "feature",
      "gem assist",
      "what can gem",
    ],
    guidance:
      "Products shown in the portal are subject to eligibility, scope, provider availability, jurisdiction, and contract checks. Display does not itself activate a service.",
  },
  {
    title: "Portfolios",
    href: "/app/portfolios",
    description: "Review assigned portfolio information and access.",
    keywords: ["portfolio", "allocation", "holding", "asset", "exposure"],
    guidance:
      "Direct members to Portfolios for information already assigned to their account. Never recommend an allocation, trade, investment, or financial action.",
  },
  {
    title: "Meetings",
    href: "/app/meetings",
    description: "Request and review meetings with the GEM team.",
    keywords: ["meeting", "appointment", "schedule", "booking", "consultation", "call me"],
    guidance:
      "Use Meetings to request a consultation. A request is not confirmed until an authorized team member confirms it.",
  },
  {
    title: "GEM News",
    href: "/intel/news",
    description: "Read native GEM news, saved stories, and video coverage.",
    keywords: ["news", "newsletter", "article", "video", "digest", "feed"],
    guidance:
      "GEM News is informational and may change rapidly. Encourage members to verify material claims with the original publisher before making security, financial, legal, or operational decisions.",
  },
  {
    title: "Notifications",
    href: "/app/notifications",
    description: "Review account alerts and workflow updates.",
    keywords: ["notification", "alert", "update", "message", "unread"],
    guidance:
      "Direct members to Notifications for account and workflow updates. Do not claim that an email, SMS, or external alert was sent without verified delivery evidence.",
  },
  {
    title: "Command Center",
    href: "/app/command-center",
    description: "Open the role-scoped operational overview and its dedicated work areas.",
    keywords: ["command center", "dashboard", "operations", "overview", "admin dashboard"],
    guidance:
      "Use the Command Center as the authenticated operational overview. Dedicated production, development, marketing, sales, finance, support, and administration work remains separated into role-scoped pages.",
  },
  {
    title: "Social Media Hub",
    href: "/app/social-media",
    description: "Manage governed content, connected channels, approvals, and publishing activity.",
    keywords: ["social media", "tiktok", "facebook", "instagram", "youtube", "campaign", "publish", "post"],
    guidance:
      "Use the Social Media Hub for channel connections, content governance, approvals, publishing queues, and analytics. Provider posting stays disabled until the required official authorization and approval evidence exist.",
  },
  {
    title: "Video Studio",
    href: "/app/social-media/video",
    description: "Review, render, approve, and publish governed video assets.",
    keywords: ["video studio", "create video", "render", "comfyui", "obs", "video upload", "video publish"],
    guidance:
      "Use Video Studio for approved video content and publishing preparation. Cloud workflows can manage content and approvals; physical OBS, camera, microphone, GPU, and ComfyUI acceptance remains a Windows-host step.",
  },
  {
    title: "Access intake",
    href: "/eligibility",
    description: "Start or review the controlled access and eligibility path.",
    keywords: [
      "signup",
      "sign up",
      "register",
      "eligibility",
      "application",
      "apply",
      "onboarding",
      "account",
      "create account",
      "new account",
      "open account",
      "join gem",
      "get started",
    ],
    guidance:
      "Use Access Intake to select the supported applicant track and begin the controlled onboarding flow. Applicant input cannot grant a privileged role or entitlement.",
  },
  {
    title: "Administration",
    href: "/app/admin",
    description: "Manage authorized users and operational controls when your role permits it.",
    keywords: ["admin", "administrator", "role", "permission", "assign access", "user management"],
    guidance:
      "Administration is role-scoped. Only authorized administrators can manage users or access, and routing input never changes a member's authority.",
  },
] as const;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function retrieveSupportKnowledge(query: string, limit = 3): SupportKnowledgeEntry[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  return SUPPORT_KNOWLEDGE.map((entry) => ({
    entry,
    score: entry.keywords.reduce((total, keyword) => {
      const normalizedKeyword = normalize(keyword);
      return total + (normalized.includes(normalizedKeyword) ? normalizedKeyword.split(" ").length + 1 : 0);
    }, 0),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title))
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => entry);
}

export function formatSupportKnowledge(entries: readonly SupportKnowledgeEntry[]): string {
  if (entries.length === 0) {
    return "No directly matching verified knowledge entry was found. Ask one concise clarifying question or offer human support.";
  }

  return entries
    .map(
      (entry) =>
        `- ${entry.title} (${entry.href}): ${entry.guidance}`,
    )
    .join("\n");
}

export function toSupportKnowledgeLinks(
  entries: readonly SupportKnowledgeEntry[],
): SupportKnowledgeLink[] {
  return entries.map(({ title, href, description }) => ({ title, href, description }));
}

const DETERMINISTIC_RESPONSES: Readonly<Record<string, string>> = {
  "Account security":
    "For login or account access, open Account Security and use the protected recovery or access controls there. Do not place a password, one-time code, recovery code, or session token in this chat.",
  "Organization workspace":
    "Open Organization Workspace to manage the projects, workstreams, and members assigned to your organization. What you can view or change is determined by your verified membership and workspace role.",
  Requests:
    "Open Requests to create a durable service case or review an existing one. The case status is the source of truth for assignment and follow-up.",
  "Human support":
    "You can request human support at any time. I will create a tracked GEM case, show its real reference, and route it to the appropriate queue without pretending that an unavailable agent is already connected.",
  "Verification status":
    "Open Compliance to review your current verification status and any documented next step. Identity, fraud, eligibility, and compliance decisions must come from an authorized reviewer.",
  Documents:
    "Open Documents to review records currently available to your account. Only use an approved private upload flow for sensitive files; do not paste document numbers into chat.",
  "Products and services":
    "GEM Assist combines an organization Workspace OS with project operations, team and client collaboration, service requests, meetings, governed AI support, news, social publishing, security monitoring, and approved integrations. Open Products and Services to review what is available to your account; availability still depends on your role, service scope, provider readiness, jurisdiction, and contract.",
  Portfolios:
    "Open Portfolios to review information already assigned to your account. I can explain navigation and records, but investment or allocation decisions require an authorized human advisor.",
  Meetings:
    "Open Meetings to request a consultation and provide the preferred time and topic. The meeting remains requested until a GEM team member confirms it.",
  "GEM News":
    "Open GEM News for the native news, newsletter, saved-story, and video experience. Material claims should still be checked against the original publisher before acting on them.",
  Notifications:
    "Open Notifications to review account alerts and workflow updates. An update shown there is recorded platform activity; I will not claim that an external email or SMS was delivered without evidence.",
  "Command Center":
    "Open Command Center for your role-scoped operational overview. Use its dedicated work areas for production, development, marketing, sales, finance, support, and administration instead of treating one crowded dashboard as every tool.",
  "Social Media Hub":
    "Open Social Media Hub to manage content, connected channels, approvals, publishing queues, and analytics. Provider posting remains fail-closed until official authorization and approval evidence are present.",
  "Video Studio":
    "Open Video Studio to select approved content, verify the exact media asset, and prepare governed publishing. Local OBS, camera, microphone, GPU, and ComfyUI checks still require the prepared Windows media host.",
  "Access intake":
    "I understand that you want to create a GEM account. Open Access Intake, choose the applicant type that matches you, complete the application, and submit it for review. After approval, use the portal assigned to your verified role; choosing an applicant track cannot grant administrator access.",
  Administration:
    "Open Administration if your verified role permits it. User, role, and access changes remain server-authorized and cannot be elevated through chat or routing input.",
};

export function createDeterministicSupportReply(
  query: string,
  entries: readonly SupportKnowledgeEntry[],
) {
  const normalized = normalize(query);
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return "Hello — I can help with your organization workspace, account access, projects, requests, verification, products, GEM News, social media, video, or a tracked human-support case. Tell me the outcome you are trying to reach.";
  }

  const primary = entries[0];
  if (primary) return DETERMINISTIC_RESPONSES[primary.title] ?? primary.description;

  return "I want to make sure I understand your request correctly. Are you trying to create or access an account, manage an organization or project, or resolve an existing request? Describe the result you need, and I will give you the verified next step or transfer the conversation to a human support agent.";
}

export function createSupportSuggestedReplies(
  query: string,
  entries: readonly SupportKnowledgeEntry[],
): string[] {
  const normalized = normalize(query);
  const primary = entries[0]?.title;

  if (primary === "Access intake" || /\b(create|open|new|need|want)\b.*\baccount\b/.test(normalized)) {
    return ["I already submitted an application", "I cannot sign in", "Speak with human support"];
  }
  if (primary === "Products and services") {
    return ["How does Workspace OS work?", "Which services can clients use?", "Speak with human support"];
  }
  if (primary === "Account security") {
    return ["I forgot my password", "My account is locked", "Speak with human support"];
  }
  if (primary === "Organization workspace") {
    return ["Create an organization workspace", "Open my projects", "Speak with human support"];
  }
  if (primary === "Human support") return [];

  return ["Help me create an account", "Explain GEM Assist services", "Speak with human support"];
}
