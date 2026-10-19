export type GtmPhase = "FOUNDATION" | "AUTHORITY" | "CAMPAIGN" | "CONVERSION";

export interface GtmCalendarItem {
  day: number;
  phase: GtmPhase;
  channel: string;
  deliverable: string;
  hook: string;
  cta: string;
}

export const activationGuardrails = [
  "All public claims must remain evidence-led and bounded to verified GEM capabilities.",
  "No outreach, campaign, social post, referral message, or Telegram post is sent automatically from this activation pack.",
  "One-to-one prospect outreach requires operator verification of current fit, public evidence, decision-maker relevance, and jurisdiction.",
  "Marketing email requires an ALLOWED EMAIL / MARKETING preference and the existing governed campaign send gate.",
  "External publishing remains subject to provider authorization, connector health, exact-version approval, live-publishing gates, and emergency locks.",
  "The $199 founding review does not imply penetration testing, guaranteed findings, certification, legal advice, or automatic remediation.",
] as const;

export const readinessChecklist = [
  { key: "identity", question: "Do all staff and contractors use individual business accounts rather than shared logins?", why: "Individual identity makes access review, offboarding, and accountability possible." },
  { key: "mfa", question: "Is MFA enabled on business email, administrator accounts, finance tools, and other high-impact systems?", why: "MFA reduces the impact of stolen or reused passwords." },
  { key: "departed-users", question: "Can you quickly identify and remove access for people who no longer work with the business?", why: "Dormant accounts and forgotten access increase avoidable exposure." },
  { key: "admin-separation", question: "Are administrator privileges limited and separated from routine day-to-day accounts where practical?", why: "Reducing standing privilege limits the impact of account compromise and mistakes." },
  { key: "domain-email", question: "Do you know who controls your domain, DNS, business email, and recovery methods?", why: "Loss of control over these systems can disrupt customer communications and account recovery." },
  { key: "payment-diversion", question: "Does your business verify unusual payment, bank-detail, or wire-change requests through a second trusted channel?", why: "Independent verification helps reduce business-email-compromise and payment-diversion risk." },
  { key: "vendors", question: "Do you know which vendors and external tools can access business data or critical workflows?", why: "Third-party dependencies can become operational and security dependencies." },
  { key: "backups", question: "Are critical files and systems backed up, and has the business confirmed it can restore what matters?", why: "A backup is useful only when restoration is understood and tested." },
  { key: "data", question: "Can you identify where customer, employee, financial, or other sensitive information is stored and who can access it?", why: "Basic data visibility supports practical security and compliance decisions." },
  { key: "continuity", question: "If one person, account, device, or online service became unavailable today, does the business have a workable fallback?", why: "Operational single points of failure can turn small incidents into business interruptions." },
] as const;

export const nurtureSequence = [
  {
    day: 0,
    subject: "Your GEM Business Review request — what happens next",
    purpose: "Confirm receipt without implying approval or activation.",
    body: "Thanks for requesting the GEM Business Security & Operations Review. We will review the information you submitted for fit, scope, jurisdiction, and the appropriate next step. A request does not automatically activate a service or create a charge. If the founding review fits, the next step is a confirmed scope and proposal before any work begins.",
    cta: "Review the bounded Business Review scope",
  },
  {
    day: 2,
    subject: "What GEM looks for before small problems become incidents",
    purpose: "Teach the review model and reinforce practical value.",
    body: "Many business-security problems begin with ordinary operating dependencies: shared access, unclear administrator ownership, fragile recovery paths, third-party tools, payment-change requests, or no tested fallback when a key system stops. The GEM review is designed to identify which of these areas deserve attention first, without destructive testing or unsupported assumptions about your environment.",
    cta: "Use the 10-question readiness checklist",
  },
  {
    day: 5,
    subject: "Do you know which business risk should be fixed first?",
    purpose: "Move from general awareness to prioritization.",
    body: "A long security checklist is less useful when a small team does not know what matters most. The founding review is structured to turn access, public exposure, operational dependencies, incident readiness, and basic data-handling observations into a prioritized 30-day action plan. Any remediation or expanded work is separately scoped and approved.",
    cta: "Review the $199 founding review",
  },
  {
    day: 9,
    subject: "Ready for the next step on your Business Review?",
    purpose: "Invite a qualified next action without pressure.",
    body: "If the Business Security & Operations Review still fits your needs, you can continue with the governed GEM intake and qualification process. If your situation has changed or requires a different scope, that can be identified before any engagement is activated.",
    cta: "Continue through the governed request process",
  },
] as const;

export const alreadyATargetCampaign = {
  name: "Already a Target",
  positioning: "Every connected business can face account, fraud, access, vendor, and operational risks. The campaign creates urgency around readiness without claiming that a specific prospect is compromised.",
  approvedHooks: [
    "Your business does not need to be famous to depend on accounts attackers value.",
    "The first security question for a small business is often not ‘Are we breached?’ but ‘Would we know what to do if access failed today?’",
    "Shared access, payment changes, vendor tools, and email recovery are business risks before they become security incidents.",
    "Know what to fix first before a security or operational problem becomes an incident.",
  ],
  prohibitedClaims: [
    "You have been breached.",
    "We detected compromised credentials.",
    "Your systems are insecure.",
    "GEM guarantees prevention or recovery.",
  ],
  primaryCta: "Take the 10-question Business Security & Operations Readiness Checklist",
  conversionCta: "Request the $199 GEM Business Security & Operations Review",
} as const;

export const socialProfileDrafts = [
  { platform: "LinkedIn", bio: "GEM Enterprise helps small and growing businesses identify priority security, access, operational, and incident-readiness risks through governed, evidence-led services. Defend. Protect. Prevail." },
  { platform: "X", bio: "Business security + operational resilience for small and growing teams. Evidence-led. Controlled scope. Defend. Protect. Prevail." },
  { platform: "Facebook", bio: "GEM Enterprise provides controlled cybersecurity, compliance-readiness, financial-security coordination, and property-risk services, including a founding Business Security & Operations Review for qualified small businesses." },
  { platform: "Instagram", bio: "Security and operational resilience for small teams. Practical readiness. Controlled scope. Evidence-led services. Defend. Protect. Prevail." },
  { platform: "TikTok", bio: "Practical business-security readiness: access, fraud prevention, resilience and what to fix first. GEM Enterprise." },
  { platform: "YouTube", bio: "GEM Enterprise publishes practical, evidence-led guidance on business security, fraud prevention, operational resilience, incident readiness, and controlled service workflows." },
  { platform: "Nextdoor", bio: "GEM Enterprise helps qualified local businesses review practical security, access, fraud-prevention, and operational-resilience priorities before problems escalate." },
  { platform: "Telegram", bio: "GEM Business Security Intelligence — concise security, fraud-prevention, operational-resilience, and incident-readiness education. No investment-return or guaranteed-outcome claims." },
] as const;

export const telegramPack = {
  channelName: "GEM Business Security Intelligence",
  description: "A controlled education channel for small-business security, fraud prevention, access hygiene, operational resilience, and incident readiness.",
  launchPosts: [
    "Welcome to GEM Business Security Intelligence. This channel focuses on practical actions small and growing businesses can use to reduce avoidable security and operational risk. Content is educational and does not imply that any reader or business has been compromised.",
    "Start with access: identify who controls business email, domain/DNS, finance tools, cloud storage, and administrator accounts. If ownership is unclear, make that visible before an incident forces the question.",
    "Payment-change rule: unexpected bank-detail, invoice-routing, or wire instructions should be verified through a second trusted channel before money moves.",
    "Readiness question: if your main email account, laptop, or cloud service stopped working today, what would your team do first? A documented first response is better than discovering the answer during an incident.",
  ],
} as const;

export const referralTracks = [
  { audience: "MSPs / IT consultants / vCISOs", value: "Independent bounded review that can identify prioritized follow-up work without displacing the customer's existing IT relationship." },
  { audience: "CPAs / bookkeeping / financial advisors", value: "Security and operational-readiness referral path for small clients handling financial information, payment workflows, and cloud accounts." },
  { audience: "Attorneys / legal-service firms", value: "Evidence-led readiness review for access, data-handling, continuity, and incident-preparation concerns outside legal advice." },
  { audience: "Real-estate / title / mortgage professionals", value: "Practical review of account access, transaction communications, vendor dependencies, payment-diversion controls, and continuity." },
  { audience: "Insurance / business associations", value: "A low-friction readiness entry point that helps small businesses identify priority controls before pursuing deeper specialist work." },
] as const;

export const seoClusters = [
  { cluster: "Small-business security review", queries: ["small business security review", "cybersecurity review for small business", "business security assessment for small team"] },
  { cluster: "Fraud and payment diversion", queries: ["business email compromise prevention small business", "invoice fraud prevention", "payment diversion controls"] },
  { cluster: "Access and vendor risk", queries: ["small business access control checklist", "vendor access security checklist", "remove former employee access"] },
  { cluster: "Incident and operational readiness", queries: ["small business incident readiness", "cyber incident plan small business", "business continuity security checklist"] },
] as const;

export const utmContract = {
  campaign: "founding-first-20",
  destinations: {
    review: "/business-review",
    checklist: "/resources/business-readiness-checklist",
  },
  sources: [
    "homepage",
    "market-entry",
    "enterprise-solutions",
    "social",
    "direct-outreach",
    "linkedin",
    "x",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "nextdoor",
    "telegram",
    "referral",
    "organic-search",
  ],
  mediums: [
    "hero",
    "footer-cta",
    "official-path",
    "one-to-one",
    "organic-social",
    "video",
    "community",
    "partner-referral",
    "organic",
  ],
  rule: "Use lowercase stable source/medium values and the single founding-first-20 campaign identity. Preserve campaign attribution into GEM intake instead of creating provider-specific campaign names for the same experiment.",
} as const;

export type GtmUtmSource = (typeof utmContract.sources)[number];
export type GtmUtmMedium = (typeof utmContract.mediums)[number];

export function buildBusinessReviewCampaignUrl(input: {
  source: GtmUtmSource;
  medium: GtmUtmMedium;
  leadSource?: "direct" | "campaign" | "referral" | "social" | "search" | "partner" | "event" | "outbound" | "other";
}) {
  const params = new URLSearchParams({
    lead: input.leadSource ?? "campaign",
    campaign: utmContract.campaign,
    utm_source: input.source,
    utm_medium: input.medium,
    utm_campaign: utmContract.campaign,
  });
  return `${utmContract.destinations.review}?${params.toString()}`;
}

export const gtmCalendar: readonly GtmCalendarItem[] = [
  { day: 1, phase: "FOUNDATION", channel: "Website", deliverable: "Publish readiness-checklist resource and verify Business Review CTA", hook: "Know what to fix first", cta: "Take the checklist" },
  { day: 2, phase: "FOUNDATION", channel: "LinkedIn", deliverable: "Founder/brand post: 5 ordinary systems small businesses depend on", hook: "Security risk often starts as an operating dependency", cta: "Take the checklist" },
  { day: 3, phase: "FOUNDATION", channel: "X", deliverable: "Thread on individual accounts, MFA, and departed-user access", hook: "Shared access hides risk", cta: "Review the checklist" },
  { day: 4, phase: "FOUNDATION", channel: "Email", deliverable: "Prepare Day-0 nurture template in GEM campaigns; do not send until permission gate passes", hook: "What happens after a request", cta: "Review scope" },
  { day: 5, phase: "FOUNDATION", channel: "SEO", deliverable: "Optimize Business Review title/description/internal links around small-business security review intent", hook: "A bounded first step", cta: "Request review" },
  { day: 6, phase: "FOUNDATION", channel: "TikTok / Reels / Shorts", deliverable: "30–45s video: who controls your domain and email recovery?", hook: "Could your business recover its own email account?", cta: "Take the checklist" },
  { day: 7, phase: "FOUNDATION", channel: "Operations", deliverable: "Review first-week traffic, source attribution, checklist visits and Business Review starts", hook: "Measure before scaling", cta: "Adjust next week" },
  { day: 8, phase: "AUTHORITY", channel: "LinkedIn", deliverable: "Post: payment-change verification as an operating control", hook: "One callback can prevent an expensive mistake", cta: "Read checklist" },
  { day: 9, phase: "AUTHORITY", channel: "Telegram", deliverable: "Launch controlled education channel with welcome + access-control post", hook: "Practical readiness, no fear claims", cta: "Visit checklist" },
  { day: 10, phase: "AUTHORITY", channel: "Website / Resource", deliverable: "Article outline: former staff and forgotten access", hook: "Offboarding is a security control", cta: "Request review" },
  { day: 11, phase: "AUTHORITY", channel: "Facebook / Nextdoor", deliverable: "Local-business post on single-person operational dependencies", hook: "What stops if one person is unavailable?", cta: "Take checklist" },
  { day: 12, phase: "AUTHORITY", channel: "YouTube", deliverable: "2–4 minute explainer: what a bounded Business Security & Operations Review is and is not", hook: "Assessment without destructive testing", cta: "Review scope" },
  { day: 13, phase: "AUTHORITY", channel: "Referral", deliverable: "Prepare referral note for MSP/IT consultants and CPAs; no partner claims", hook: "Independent review without replacing existing advisors", cta: "Discuss referral fit" },
  { day: 14, phase: "AUTHORITY", channel: "Operations", deliverable: "Review search queries, top pages, social clicks, checklist traffic and qualified request quality", hook: "Authority must produce qualified movement", cta: "Prioritize best channel" },
  { day: 15, phase: "CAMPAIGN", channel: "Cross-channel", deliverable: "Launch approved ‘Already a Target’ awareness creative", hook: "Connected businesses depend on accounts attackers value", cta: "Take checklist" },
  { day: 16, phase: "CAMPAIGN", channel: "Direct outreach", deliverable: "Verify and personalize first 5 First-20 research records; operator sends individually if approved", hook: "Reference a public workflow, never an inferred weakness", cta: "View review scope" },
  { day: 17, phase: "CAMPAIGN", channel: "LinkedIn / X", deliverable: "Post: vendor access and third-party dependency map", hook: "Who else can reach your business systems?", cta: "Use checklist" },
  { day: 18, phase: "CAMPAIGN", channel: "Email", deliverable: "Prepare Day-2 nurture template and verify communication preference workflow", hook: "What GEM looks for before problems become incidents", cta: "Take checklist" },
  { day: 19, phase: "CAMPAIGN", channel: "Video", deliverable: "Short video: second-channel verification for payment changes", hook: "Pause before money moves", cta: "Review readiness" },
  { day: 20, phase: "CAMPAIGN", channel: "Direct outreach", deliverable: "Verify and personalize next 5 First-20 records; operator review required", hook: "Small-team resilience", cta: "View founding review" },
  { day: 21, phase: "CAMPAIGN", channel: "Operations", deliverable: "Compare organic, referral and one-to-one response quality; do not scale volume yet", hook: "Quality before volume", cta: "Choose next 10" },
  { day: 22, phase: "CONVERSION", channel: "Website", deliverable: "Review Business Review page friction, request starts, completion and proposal handoff", hook: "Reduce uncertainty, not governance", cta: "Request review" },
  { day: 23, phase: "CONVERSION", channel: "Email", deliverable: "Prepare Day-5 nurture template", hook: "Which risk should be fixed first?", cta: "Review the founding offer" },
  { day: 24, phase: "CONVERSION", channel: "Referral", deliverable: "Prepare tailored CPA/legal/property/logistics referral variants", hook: "A bounded first review for clients who need prioritization", cta: "Discuss referral fit" },
  { day: 25, phase: "CONVERSION", channel: "SEO", deliverable: "Create internal-link plan for access control, payment fraud, vendor risk and incident readiness clusters", hook: "Match buyer questions to controlled pages", cta: "Business Review" },
  { day: 26, phase: "CONVERSION", channel: "Direct outreach", deliverable: "Verify and personalize final 10 First-20 records only if first outreach quality supports continuation", hook: "Evidence-safe personalization", cta: "View scope" },
  { day: 27, phase: "CONVERSION", channel: "Email", deliverable: "Prepare Day-9 nurture template", hook: "Ready for the next step?", cta: "Continue governed request" },
  { day: 28, phase: "CONVERSION", channel: "Social", deliverable: "FAQ carousel/video: what the $199 review includes and excludes", hook: "Clear scope builds trust", cta: "Review scope" },
  { day: 29, phase: "CONVERSION", channel: "Customer success", deliverable: "Define post-review follow-up, outcome, expansion and referral review points for any converted founding customers", hook: "The relationship continues after delivery", cta: "Record next action" },
  { day: 30, phase: "CONVERSION", channel: "Operations", deliverable: "Monthly decision review: qualified visits, checklist use, requests, qualified leads, proposals, approvals, conversions, revenue and channel quality", hook: "Scale only what produces governed outcomes", cta: "Approve next 30-day experiment" },
] as const;
