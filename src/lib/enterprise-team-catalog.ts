/** Evidence-based GEM Enterprise team directory: functional editorial records,
 * not a staffing or licensing certification. Deliberately omits headcounts,
 * employment claims, invented portraits and unsupported partner claims.
 * Source: GEM + ATR Notion Organizational Structure, Division Overview, Staff Directory
 * and the original role-labelled media page.
 */
export type EnterpriseDivision = "executive" | "security" | "realty" | "shared";
export type FunctionalStatus = "documented" | "planned" | "restricted";
export type RegistryStatus = "role-recorded" | "assignment-pending" | "evidence-required" | "function-recorded" | "restricted" | "planned";
export interface EnterpriseTeam {
 slug: string; title: string; division: EnterpriseDivision; status: FunctionalStatus;
 strap: string; summary: string; responsibilities: readonly string[];
 deliverables: readonly string[]; collaborators: readonly string[]; sourceUrl: string; notionDetailUrl: string;
}
export interface RosterReference {
 slug: string; label: string; title: string; department: string;
 status: RegistryStatus; sourceUrl: string; notice: string;
}
export const divisions: readonly {id:EnterpriseDivision; title:string; subtitle:string; note:string}[] = [
  {
    "id": "executive",
    "title": "Executive leadership",
    "subtitle": "Strategic oversight and restricted executive decisions",
    "note": "Company-wide executive oversight from the Notion organizational chart."
  },
  {
    "id": "security",
    "title": "GEM Cybersecurity & Monitoring Assist",
    "subtitle": "Security, threat intelligence and compliance",
    "note": "Core GEM security division, including documented and proposed service functions."
  },
  {
    "id": "realty",
    "title": "Alliance Trust Realty (ATR)",
    "subtitle": "Realty advisory and client coordination",
    "note": "ATR-related functional structure, subject to regulated-role and licensing checks."
  },
  {
    "id": "shared",
    "title": "Enterprise-wide shared services",
    "subtitle": "Operations, technology, customer service and communications",
    "note": "Cross-division service functions that support the three main organizational layers."
  }
];
export const enterpriseTeams: readonly EnterpriseTeam[] = [
  {
    "slug": "executive-office",
    "title": "Executive Office & Governance",
    "division": "executive",
    "status": "documented",
    "strap": "Strategic governance and controlled executive decision-making",
    "summary": "Coordinates enterprise priorities, executive sign-off and oversight across GEM and ATR without implying unverified board appointments.",
    "responsibilities": [
      "Maintain organizational priorities and change decisions",
      "Review material approvals and company-level risks",
      "Coordinate cross-division ownership and escalation"
    ],
    "deliverables": [
      "Executive decision register",
      "Division operating priorities",
      "Governance review summary"
    ],
    "collaborators": [
      "security-leadership",
      "atr-advisory",
      "vip-relationships"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281d186bdfd5d254ef2e9",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281398a86d4650108ca61"
  },
  {
    "slug": "vip-relationships",
    "title": "VIP Relationship & Board Desk",
    "division": "executive",
    "status": "restricted",
    "strap": "Restricted executive client coordination",
    "summary": "Defines processes for priority requests and sensitive executive relationships, without exposing client identities or implying specific VIP accounts.",
    "responsibilities": [
      "Control confidential client and executive requests",
      "Route high-sensitivity matters to approved owners",
      "Maintain privacy, access and escalation records"
    ],
    "deliverables": [
      "Restricted access policy",
      "Priority-case escalation log",
      "Executive service playbook"
    ],
    "collaborators": [
      "executive-office",
      "client-support"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281b09a26caa756f7e3da",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281089a2bcc31cbc985c7"
  },
  {
    "slug": "security-leadership",
    "title": "Cybersecurity Leadership & Risk Oversight",
    "division": "security",
    "status": "documented",
    "strap": "Security priorities and control accountability",
    "summary": "Describes the cybersecurity leadership function represented in the organization's structure; named appointments and credentials require evidence.",
    "responsibilities": [
      "Define defensive security priorities and review standards",
      "Coordinate threat intelligence and monitoring objectives",
      "Escalate security findings and readiness decisions"
    ],
    "deliverables": [
      "Security policy roadmap",
      "Risk review record",
      "Leadership decision memo"
    ],
    "collaborators": [
      "security-operations",
      "threat-intelligence",
      "security-compliance"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281bf838ae7d7f69645fe",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281a28373ea8d539e99d7"
  },
  {
    "slug": "security-operations",
    "title": "Security Monitoring & SOC Operations",
    "division": "security",
    "status": "planned",
    "strap": "Authorized defensive event monitoring",
    "summary": "Proposed operational unit for security telemetry, alert triage and documented incident coordination; 24/7 staffed coverage is not claimed.",
    "responsibilities": [
      "Design monitoring runbooks and alert triage",
      "Coordinate authorized telemetry and response escalations",
      "Track control effectiveness and monitoring gaps"
    ],
    "deliverables": [
      "Alert triage runbook",
      "Security observation summary",
      "Monitoring service readiness checklist"
    ],
    "collaborators": [
      "security-leadership",
      "incident-response",
      "client-support"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281bf838ae7d7f69645fe",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281118308c8d2e913d25b"
  },
  {
    "slug": "threat-intelligence",
    "title": "Threat Intelligence & Defensive Research",
    "division": "security",
    "status": "documented",
    "strap": "Evidence-based risk intelligence",
    "summary": "Supports research on threats, signals and relevant exposure trends while distinguishing research plans from verified operational capabilities.",
    "responsibilities": [
      "Develop repeatable intelligence collection workflows",
      "Analyze indicators and credible source evidence",
      "Produce risk-focused defensive briefs"
    ],
    "deliverables": [
      "Threat intelligence bulletin",
      "Research evidence register",
      "Risk assessment memo"
    ],
    "collaborators": [
      "security-operations",
      "security-leadership",
      "data-analytics"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281c586cee47c75f3113c",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac28132946bc0bd0a336cd8"
  },
  {
    "slug": "security-compliance",
    "title": "Security Compliance & Audit Readiness",
    "division": "security",
    "status": "documented",
    "strap": "Control evidence and audit coordination",
    "summary": "Maintains a clear process for security policy control mapping, compliance documentation and specialist review.",
    "responsibilities": [
      "Document security controls and ownership",
      "Maintain evidence and audit gap registers",
      "Coordinate compliance escalations"
    ],
    "deliverables": [
      "Control matrix",
      "Audit evidence register",
      "Remediation tracker"
    ],
    "collaborators": [
      "security-leadership",
      "international-compliance",
      "platform-engineering"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281ecad5ac86771f1fbdb",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281f59e92f5b8390d2118"
  },
  {
    "slug": "incident-response",
    "title": "Incident Response & Digital Forensics",
    "division": "security",
    "status": "planned",
    "strap": "Documented investigation readiness",
    "summary": "Planned controlled investigation and forensic-coordination capability, not a representation that the enterprise operates a certified forensic laboratory.",
    "responsibilities": [
      "Document incident intake, severity and response flow",
      "Preserve evidence within authorized chain-of-custody limits",
      "Coordinate recovery, review and lessons learned"
    ],
    "deliverables": [
      "Response playbook",
      "Incident timeline and evidence record",
      "After-action review template"
    ],
    "collaborators": [
      "security-operations",
      "client-support",
      "security-compliance"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281bf838ae7d7f69645fe",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac2815999ebd2ba80044579"
  },
  {
    "slug": "data-analytics",
    "title": "Data Analytics & Intelligence Reporting",
    "division": "security",
    "status": "planned",
    "strap": "Reliable analysis and decision support",
    "summary": "Defines the proposed analytics role for reporting across security and enterprise operations using appropriate data permissions.",
    "responsibilities": [
      "Validate and document data sources",
      "Build interpretable dashboards and reports",
      "Communicate uncertainty and findings"
    ],
    "deliverables": [
      "Data source inventory",
      "Analysis notebook and metrics definitions",
      "Executive decision brief"
    ],
    "collaborators": [
      "threat-intelligence",
      "platform-engineering",
      "financial-support"
    ],
    "sourceUrl": "https://app.notion.com/p/413b5b56eac28115b42bfe301bc6293a",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281ea9f17ce0c90bae28f"
  },
  {
    "slug": "platform-engineering",
    "title": "Platform & Software Engineering",
    "division": "shared",
    "status": "planned",
    "strap": "Product architecture, quality and delivery",
    "summary": "Enables version-controlled product engineering, secure interfaces and deployment validation across existing software services.",
    "responsibilities": [
      "Maintain development and release runbooks",
      "Review software quality and accessibility",
      "Coordinate integration, testing and rollback plans"
    ],
    "deliverables": [
      "Architecture documentation",
      "Test and build evidence",
      "Release checklist"
    ],
    "collaborators": [
      "security-compliance",
      "platform-operations",
      "automation-governance"
    ],
    "sourceUrl": "https://app.notion.com/p/413b5b56eac281028a64dda6acafc4d2",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281e9902dd1e716153acc"
  },
  {
    "slug": "platform-operations",
    "title": "Cloud, Reliability & Internal IT",
    "division": "shared",
    "status": "planned",
    "strap": "Operational resilience and service maintenance",
    "summary": "Proposed capability for cloud configuration, deployment visibility, runtime monitoring and incident escalation without claiming 24/7 staffing.",
    "responsibilities": [
      "Maintain hosting and service dependency inventory",
      "Coordinate deployment health checks and rollback",
      "Track operational issues and access controls"
    ],
    "deliverables": [
      "Service runbook",
      "Deployment verification record",
      "Continuity checklist"
    ],
    "collaborators": [
      "platform-engineering",
      "client-support",
      "security-operations"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac2814fac16f4b2f730ad8d",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281c6916df462763bc4a1"
  },
  {
    "slug": "automation-governance",
    "title": "AI Agent Oversight & Automation Governance",
    "division": "shared",
    "status": "planned",
    "strap": "Supervised automation with auditability",
    "summary": "Defines a proposed AI operations function with human approval boundaries, scoped permissions and evidence of each permitted action.",
    "responsibilities": [
      "Document automation permissions and limits",
      "Review exception and approval queues",
      "Monitor audit evidence and operational safety"
    ],
    "deliverables": [
      "Agent policy matrix",
      "Approval and audit log specification",
      "Automation verification checklist"
    ],
    "collaborators": [
      "executive-office",
      "platform-engineering",
      "security-compliance"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281c4a3fbd5c9e56e5939",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac2811faf74e3f1d335feef"
  },
  {
    "slug": "client-support",
    "title": "Client Support & Escalation Desk",
    "division": "shared",
    "status": "documented",
    "strap": "Customer intake and operational follow-through",
    "summary": "Coordinates enquiries, service routing and documented follow-up across approved company workflows.",
    "responsibilities": [
      "Receive and classify support enquiries",
      "Direct cases to accountable service owners",
      "Maintain resolution notes and escalate exceptions"
    ],
    "deliverables": [
      "Intake and triage record",
      "Escalation matrix",
      "Customer follow-up template"
    ],
    "collaborators": [
      "platform-operations",
      "vip-relationships",
      "security-operations"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281a3a6def0768082e0ce",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac28116b405cc0a553ed055"
  },
  {
    "slug": "financial-support",
    "title": "Affiliate Financial Support Coordination",
    "division": "shared",
    "status": "documented",
    "strap": "Financial-support routing without regulated mandates",
    "summary": "Represents a documented affiliate coordination function, not an assertion of banking, asset-management or investment advisory authorization.",
    "responsibilities": [
      "Track supporting financial-service documentation",
      "Route permitted affiliate requests",
      "Escalate authorization and compliance questions"
    ],
    "deliverables": [
      "Affiliate-scope checklist",
      "Financial support tracking register",
      "Escalation and risk memo"
    ],
    "collaborators": [
      "international-compliance",
      "executive-office",
      "client-support"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281d9bc89d8c935fe1716",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281df88f8f47be73d4c22"
  },
  {
    "slug": "international-compliance",
    "title": "International Compliance & Legal Coordination",
    "division": "shared",
    "status": "planned",
    "strap": "Jurisdiction-aware governance research",
    "summary": "Proposed coordination among qualified legal advisers, policy owners, contract reviewers and compliance documentation teams.",
    "responsibilities": [
      "Map relevant jurisdictional obligations",
      "Prepare legal and regulatory review questions",
      "Document cross-border control evidence"
    ],
    "deliverables": [
      "Requirements matrix",
      "Contract review checklist",
      "Regulatory evidence log"
    ],
    "collaborators": [
      "security-compliance",
      "atr-advisory",
      "financial-support"
    ],
    "sourceUrl": "https://app.notion.com/p/413b5b56eac28115bf18d2b2fb12dd5e",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281c5907df458af1f5625"
  },
  {
    "slug": "human-resources",
    "title": "People, HR & Regional Sales Operations",
    "division": "shared",
    "status": "planned",
    "strap": "Workforce processes and professional development",
    "summary": "Planned coordination of role design, onboarding, training and ethical regional sales operations. No staff headcount or established HR employment is implied.",
    "responsibilities": [
      "Maintain role and onboarding processes",
      "Coordinate training and performance feedback",
      "Review regional client-service processes"
    ],
    "deliverables": [
      "Onboarding checklist",
      "Role responsibility matrix",
      "Regional service plan"
    ],
    "collaborators": [
      "client-support",
      "executive-office",
      "marketing-communications"
    ],
    "sourceUrl": "https://app.notion.com/p/413b5b56eac2810db352de835576d496",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac2812da620e13eb878ddca"
  },
  {
    "slug": "marketing-communications",
    "title": "Brand, Advertising & Corporate Communications",
    "division": "shared",
    "status": "planned",
    "strap": "Responsible educational content and brand stewardship",
    "summary": "Plans campaigns, editorial storytelling, video and social content with evidence review and publication authorization.",
    "responsibilities": [
      "Prepare editorial and image-production briefs",
      "Coordinate brand approval and captions",
      "Analyze marketing feedback and accessibility"
    ],
    "deliverables": [
      "Content storyboard",
      "Creative asset review checklist",
      "Campaign learning report"
    ],
    "collaborators": [
      "executive-office",
      "human-resources",
      "atr-sales"
    ],
    "sourceUrl": "https://app.notion.com/p/413b5b56eac281a684bff4cf11c5b49a",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac2818caa44c88ed870c17d"
  },
  {
    "slug": "atr-advisory",
    "title": "ATR Advisory & Realty Governance",
    "division": "realty",
    "status": "documented",
    "strap": "Property advisory process and license-review coordination",
    "summary": "Describes ATR's proposed professional advisory leadership; brokerage and regulated real-estate representation depend on verified appointment and applicable licensure.",
    "responsibilities": [
      "Coordinate advisory requirements and client disclosures",
      "Track property documentation and due diligence",
      "Escalate transactions requiring licensed professionals"
    ],
    "deliverables": [
      "Property advisory checklist",
      "Authority and license review record",
      "Client consultation plan"
    ],
    "collaborators": [
      "atr-sales",
      "atr-property-operations",
      "international-compliance"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac2810fb5f2f111f8491abb",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac2811fb8cded24a2ae7351"
  },
  {
    "slug": "atr-sales",
    "title": "ATR Sales, Agent & Client Relationships",
    "division": "realty",
    "status": "documented",
    "strap": "Approved sales and client-coordination workflow",
    "summary": "Supports property enquiry handling, client communications and agent handoffs, subject to confirming the scope of agency and each individual's license.",
    "responsibilities": [
      "Route leads and maintain client communication",
      "Coordinate property presentations and appointments",
      "Document agency authority before regulated activities"
    ],
    "deliverables": [
      "Client enquiry record",
      "Agent onboarding and license checklist",
      "Property presentation outline"
    ],
    "collaborators": [
      "atr-advisory",
      "atr-property-operations",
      "marketing-communications"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac28148a9e7f7dd6b00e23a",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac2819db536ed74cc8a2fbb"
  },
  {
    "slug": "atr-property-operations",
    "title": "ATR Property & Transaction Coordination",
    "division": "realty",
    "status": "planned",
    "strap": "Real-estate transaction administration",
    "summary": "A proposed administrative unit for property records, document status and closing-coordination support; it does not imply brokerage, title insurance, or trust-fund handling authorization.",
    "responsibilities": [
      "Prepare property document request lists",
      "Track transaction milestones and disclosures",
      "Escalate legal/title/finance questions to verified professionals"
    ],
    "deliverables": [
      "Property records checklist",
      "Transaction milestone register",
      "Escalation protocol"
    ],
    "collaborators": [
      "atr-advisory",
      "atr-sales",
      "international-compliance"
    ],
    "sourceUrl": "https://app.notion.com/p/413b5b56eac281c6b9a3d5becb1ff5a0",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac281be9d21ee8bd4ee091e"
  },
  {
    "slug": "partner-relations",
    "title": "Partners, Vendors & Stakeholder Coordination",
    "division": "shared",
    "status": "planned",
    "strap": "Evidence-based organizational relationships",
    "summary": "Proposed partner-onboarding and vendor-review function that does not claim affiliation or membership until documentary confirmation.",
    "responsibilities": [
      "Verify agreements and authorized public naming",
      "Coordinate vendor onboarding and risk assessment",
      "Record review status and stakeholder contacts"
    ],
    "deliverables": [
      "Partner evidence checklist",
      "Vendor due-diligence record",
      "Public claims approval record"
    ],
    "collaborators": [
      "executive-office",
      "security-compliance",
      "marketing-communications"
    ],
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281b29c2eedd3307902c8",
    "notionDetailUrl": "https://app.notion.com/p/414b5b56eac28137960ff702129fda48"
  }
];
export const historicalRoster: readonly RosterReference[] = [
  {
    "slug": "leonard-diana",
    "label": "Leonard Diana",
    "title": "CEO / Founder",
    "department": "executive-office",
    "status": "role-recorded",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281b5b277ff6c2438aafa",
    "notice": "Executive designation recorded in the Notion directory; identity photo, authority evidence and current status remain subject to verification."
  },
  {
    "slug": "sarah-johnson",
    "label": "Sarah Johnson",
    "title": "CISO",
    "department": "security-leadership",
    "status": "assignment-pending",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281e8995fef08ff82e28f",
    "notice": "Historical Notion bio exists; current GEM staff appointment and claimed professional certifications are not substantiated by this source."
  },
  {
    "slug": "michael-chen",
    "label": "Michael Chen",
    "title": "Security Compliance Manager",
    "department": "security-compliance",
    "status": "assignment-pending",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281ecad5ac86771f1fbdb",
    "notice": "Historical Notion bio exists; assignment and external credentials remain unverified."
  },
  {
    "slug": "aisha-patel",
    "label": "Aisha Patel",
    "title": "Threat Intelligence Analyst",
    "department": "threat-intelligence",
    "status": "assignment-pending",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281c586cee47c75f3113c",
    "notice": "Historical Notion bio exists; assignment and certifications remain pending evidence."
  },
  {
    "slug": "gregor-stewart",
    "label": "Gregor Stewart",
    "title": "Principal Consultant / Broker designation under review",
    "department": "atr-advisory",
    "status": "evidence-required",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac2810fb5f2f111f8491abb",
    "notice": "Brokerage, professional appointment and applicable licenses remain in review; do not assert licensed practice."
  },
  {
    "slug": "ck",
    "label": "Ck",
    "title": "Sales Manager / Agent designation under review",
    "department": "atr-sales",
    "status": "evidence-required",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac28148a9e7f7dd6b00e23a",
    "notice": "Full legal name, original portrait, appointment and applicable realty license remain unverified."
  },
  {
    "slug": "support-operations-desk",
    "label": "Support Operations Desk",
    "title": "Client Support Function",
    "department": "client-support",
    "status": "function-recorded",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281a3a6def0768082e0ce",
    "notice": "Company function rather than a named person; SOP and ownership evidence still require confirmation."
  },
  {
    "slug": "financial-team-supports",
    "label": "Financial Team Supports",
    "title": "Affiliate Financial Coordination Function",
    "department": "financial-support",
    "status": "evidence-required",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281d9bc89d8c935fe1716",
    "notice": "Recorded service desk, not a named individual; regulated financial authority and affiliate agreements not established."
  },
  {
    "slug": "vip-board-desk",
    "label": "VIP Board Desk",
    "title": "Restricted Executive Relationship Function",
    "department": "vip-relationships",
    "status": "restricted",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281b09a26caa756f7e3da",
    "notice": "Restricted business desk; client identities and private executive matters are not to be published."
  },
  {
    "slug": "ai-agent-overseer",
    "label": "AI Agent Overseer",
    "title": "Proposed Automation Oversight Function",
    "department": "automation-governance",
    "status": "planned",
    "sourceUrl": "https://app.notion.com/p/393b5b56eac281c4a3fbd5c9e56e5939",
    "notice": "Proposed automation function, not a human person or verified active production service."
  }
];
export const getEnterpriseTeam = (slug:string):EnterpriseTeam | null => enterpriseTeams.find(t=>t.slug===slug)??null;
export const getRosterReference = (slug:string):RosterReference | null => historicalRoster.find(t=>t.slug===slug)??null;
export const getDivision = (id:string) => divisions.find(d=>d.id===id)??null;
