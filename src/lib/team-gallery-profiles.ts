/** Role-based editorial content for private staff gallery preview.
 * Role descriptions are not a verified person's biography. Photo variation
 * titles below are PRODUCTION BRIEFS, not generated images.
 */
export interface EditorialShotBrief {
  order: number;
  title: string;
  description: string;
}
export interface TeamProfileEditorial {
  slug: string;
  functionalArea: string;
  purpose: string;
  narrative: string;
  outputs: readonly string[];
  workflow: readonly string[];
  shotBriefs: readonly EditorialShotBrief[];
}
export const teamProfileEditorials: readonly TeamProfileEditorial[] = [
  {
    "slug": "legal-consultant",
    "functionalArea": "Legal advisory & corporate governance",
    "purpose": "Help business stakeholders identify contractual obligations, coordinate legal review, and document governance decisions without claiming unverified professional authority.",
    "narrative": "A disciplined advisory workflow begins with intake, document review, issue identification and appropriately qualified escalation.",
    "outputs": [
      "Legal review request",
      "Risk and action register",
      "Executive briefing"
    ],
    "workflow": [
      "Scope intake",
      "Document assessment",
      "Qualified counsel review",
      "Decision and follow-up"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Formal studio portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Corporate client consultation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Reviewing contracts",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Legal research desk",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Governance briefing",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Boardroom presentation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Professional conference setting",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Collaborative policy workshop",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Environmental office portrait",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Full-length editorial photograph",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "public-speaker-attorney",
    "functionalArea": "Public education & stakeholder engagement",
    "purpose": "Make complex governance topics more understandable through carefully sourced talks, moderated discussions and audience education.",
    "narrative": "A presentation can follow the preparation of a topic, evidence checks, speaker rehearsal, delivery and follow-up questions.",
    "outputs": [
      "Session brief",
      "Event presentation outline",
      "Post-event question summary"
    ],
    "workflow": [
      "Topic research",
      "Content approval",
      "Speaking session",
      "Feedback and follow-up"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Speaker headshot",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Conference keynote",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Panel moderation",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Workshop session",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Podcast discussion",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Backstage preparation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Audience question session",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Studio interview",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Team briefing",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Editorial event portrait",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "regional-hr-sales",
    "functionalArea": "Regional human resources & sales operations",
    "purpose": "Support responsible recruiting, onboarding, team development and coordination of regional sales or customer-service processes.",
    "narrative": "The regional team story emphasizes people development and measurable service processes rather than sales claims.",
    "outputs": [
      "Onboarding overview",
      "Regional activity report",
      "Training and follow-up plan"
    ],
    "workflow": [
      "Staff requirements",
      "Recruitment and development",
      "Regional service planning",
      "Performance review"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Leadership portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Onboarding workshop",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Regional team meeting",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Sales coaching",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "CRM planning desk",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Client experience review",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Recruitment interview setting",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Training presentation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Cross-office collaboration",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Full-length office portrait",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "data-analyst-cybersecurity",
    "functionalArea": "Defensive cybersecurity & data analysis",
    "purpose": "Interpret business and security signals, analyze anomalies and translate authorized investigations into clear reports.",
    "narrative": "An evidence-driven analyst investigates verified observations with proper authorization, then documents findings and remedies.",
    "outputs": [
      "Monitoring summary",
      "Risk analysis brief",
      "Remediation tracking list"
    ],
    "workflow": [
      "Authorized data access",
      "Signal review",
      "Evidence analysis",
      "Defensive recommendations"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Security analyst portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Security monitoring wall",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Data visualization briefing",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Authorized assessment session",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Technical peer review",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Incident documentation desk",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Threat-analysis workstation",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Team security workshop",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Engineering collaboration",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Corporate technology studio",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "international-compliance",
    "functionalArea": "International compliance & assurance",
    "purpose": "Organize cross-border regulatory research, policy checks, due diligence and evidence for expert review.",
    "narrative": "Compliance work is shown as structured research, careful records, and coordinated risk escalation—not as an implied regulator approval.",
    "outputs": [
      "Jurisdictional requirements matrix",
      "Evidence inventory",
      "Governance review brief"
    ],
    "workflow": [
      "Jurisdiction research",
      "Evidence mapping",
      "Professional review",
      "Corrective-action tracking"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Professional compliance portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "International policy meeting",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Document evidence review",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Governance presentation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Audit preparation desk",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Due-diligence session",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Regulatory reading room",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Cross-border call",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Board briefing",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Full-length executive portrait",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "attorney-it-consultant",
    "functionalArea": "Technology governance & legal IT coordination",
    "purpose": "Connect technology implementation plans with contractual and governance requirements, keeping regulated legal conclusions with authorized advisers.",
    "narrative": "The hybrid advisory narrative centers on reducing misunderstandings between legal, privacy and engineering teams.",
    "outputs": [
      "Technology governance brief",
      "Vendor-review checklist",
      "Privacy and risk question log"
    ],
    "workflow": [
      "Technical scope review",
      "Contract questions",
      "Risk escalation",
      "Documented implementation guidance"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Legal technology portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Contract and computer workstation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Vendor governance meeting",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Privacy workshop",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Software architecture briefing",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Regulatory discussion",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "IT leadership conference",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Collaborative risk review",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Formal studio headshot",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Boardroom interview",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "software-engineer",
    "functionalArea": "Enterprise software engineering",
    "purpose": "Translate requirements into maintainable applications, tested services and documented release changes.",
    "narrative": "The engineering story should show design, implementation, peer review, testing and operational learning rather than invented project achievements.",
    "outputs": [
      "Architecture proposal",
      "Reviewed implementation",
      "Test and release record"
    ],
    "workflow": [
      "Requirements planning",
      "Design and development",
      "QA and security review",
      "Controlled delivery"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Software engineer headshot",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Modern development workstation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Architecture whiteboard",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Team code review",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "QA testing setup",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "API design discussion",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Cloud operations environment",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Product demonstration",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Technical workshop",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Full-length contemporary studio portrait",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "financial-tech-markets",
    "functionalArea": "Financial technology & market information",
    "purpose": "Organize market data research, analytical reporting and risk questions without implying authorization to manage money or provide regulated investment advice.",
    "narrative": "A credible financial-technology story documents research assumptions, evidence sources and supervisory review.",
    "outputs": [
      "Data research brief",
      "Market-tech operating report",
      "Risk and source checklist"
    ],
    "workflow": [
      "Data sourcing",
      "Research and methodology",
      "Compliance review",
      "Operational reporting"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Financial technology portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Market research workstation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Charts and risk analysis",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Analyst discussion",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Data-quality meeting",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Board briefing",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Enterprise finance technology lab",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Workflow documentation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Team risk workshop",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Formal office profile",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "advertising",
    "functionalArea": "Brand communication & marketing production",
    "purpose": "Shape professional campaigns, coordinate visual production and measure reach while respecting brand, claims and publication approval.",
    "narrative": "The creative workflow progresses from business brief to storyboard, filming, editing and careful review.",
    "outputs": [
      "Creative campaign brief",
      "Production storyboard",
      "Approved media and review summary"
    ],
    "workflow": [
      "Business objective",
      "Concept and production",
      "Editorial review",
      "Reporting and improvement"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Advertising professional portrait",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Creative brainstorm",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "On-set direction",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Editing workstation",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Storyboard review",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Social content filming",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Campaign analysis",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Brand planning meeting",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Client creative presentation",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Editorial corporate portrait",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  },
  {
    "slug": "unassigned-photo",
    "functionalArea": "Unassigned staff photo — attribution pending",
    "purpose": "Preserve the tenth image and its source history until the depicted person's role, employment and permission to publish are documented.",
    "narrative": "This is a source-media record, not a biography. No individualized story or professional achievements should be attached without identification.",
    "outputs": [
      "Image provenance record",
      "Person-to-role verification checklist",
      "Editorial approval decision"
    ],
    "workflow": [
      "Source preservation",
      "Identity verification",
      "Consent review",
      "Final assignment"
    ],
    "shotBriefs": [
      {
        "order": 1,
        "title": "Source image reference",
        "description": "Maintain a natural, recognizable likeness and realistic professional appearance."
      },
      {
        "order": 2,
        "title": "Natural light portrait study",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 3,
        "title": "Neutral office framing",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 4,
        "title": "Wide horizontal crop",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 5,
        "title": "Vertical profile crop",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 6,
        "title": "Background consistency check",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 7,
        "title": "Image clarity comparison",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 8,
        "title": "Studio-lighting reference",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      },
      {
        "order": 9,
        "title": "Corporate visual palette study",
        "description": "Use grounded workspace context with no invented company clients, credentials or results."
      },
      {
        "order": 10,
        "title": "Accessibility alt-text review",
        "description": "Keep the photographed person's appearance consistent and avoid false project or event attribution."
      }
    ]
  }
];

export function getTeamProfileEditorial(slug: string): TeamProfileEditorial | null {
  return teamProfileEditorials.find((profile) => profile.slug === slug) ?? null;
}
