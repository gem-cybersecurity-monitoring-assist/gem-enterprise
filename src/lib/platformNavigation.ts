export type PlatformNavIcon =
  | "LayoutDashboard"
  | "Package"
  | "Briefcase"
  | "FileText"
  | "ClipboardList"
  | "HeadphonesIcon"
  | "MessageSquare"
  | "Bell"
  | "ShieldCheck"
  | "User"
  | "Settings"
  | "Lock"
  | "Shield"
  | "Users"
  | "CheckCircle"
  | "PieChart"
  | "UserCheck"
  | "Wallet"
  | "PiggyBank"
  | "Mail"
  | "Rss"
  | "Activity"
  | "BarChart3"
  | "ShieldAlert"
  | "Scale"
  | "BadgeDollarSign"
  | "Bot"
  | "Plug"
  | "Megaphone"
  | "Building2";

export interface PlatformSurface {
  id: "marketing-mobile" | "enterprise-web-app";
  label: string;
  kind: "public" | "authenticated";
  defaultPath: string;
  preserveBrandPreview: boolean;
  notes: string;
}

export interface PlatformNavItem {
  href: string;
  icon: PlatformNavIcon;
  label: string;
  description: string;
  ownerOnly?: boolean;
}

export interface PlatformNavGroup {
  label: string;
  items: PlatformNavItem[];
  adminOnly?: boolean;
}

export const platformSurfaces: PlatformSurface[] = [
  {
    id: "marketing-mobile",
    label: "Mobile Platform Surface",
    kind: "public",
    defaultPath: "/",
    preserveBrandPreview: true,
    notes:
      "Mobile-first industrial presentation shell for discovery, preview, onboarding, and public service navigation.",
  },
  {
    id: "enterprise-web-app",
    label: "Enterprise Web App",
    kind: "authenticated",
    defaultPath: "/app/dashboard",
    preserveBrandPreview: true,
    notes:
      "Full service workspace shell for authenticated client and admin operations.",
  },
];

export const platformBrandContract = {
  name: "GEM Enterprise",
  backgroundClass: "bg-background",
  previewMode: "preserve",
  primaryAccentHsl: "185 100% 45%",
  shellIntent:
    "Maintain the current dark industrial brand system while allowing the web app shell to be restructured without removing service tabs.",
};

export const clientPortalNavGroups: PlatformNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/app/workspace",
        icon: "Building2",
        label: "Organization Workspace",
        description: "Manage your organization, projects, team, tools, and weekly reporting.",
      },
      {
        href: "/app/dashboard",
        icon: "LayoutDashboard",
        label: "Dashboard",
        description: "Client overview, status, and operational summary.",
      },
      {
        href: "/intel",
        icon: "Rss",
        label: "Intelligence",
        description: "Live cross-domain intelligence operations console.",
      },
      {
        href: "/app/social-media",
        icon: "Megaphone",
        label: "Social Media Suite",
        description:
          "Social accounts, content, governed video, TokMetric, approvals, scheduling, and analytics.",
      },
      {
        href: "/app/portfolios",
        icon: "Briefcase",
        label: "Portfolios",
        description: "Portfolio views, allocations, and reporting.",
      },
      {
        href: "/app/my-portfolio",
        icon: "Wallet",
        label: "My Portfolio",
        description: "Personalized holdings and position-level summary.",
      },
      {
        href: "/app/savings-vault",
        icon: "PiggyBank",
        label: "Savings Vault",
        description: "Protected savings and yield products.",
      },
      {
        href: "/app/products",
        icon: "Package",
        label: "Products",
        description: "Available products and gated service offerings.",
      },
      {
        href: "/app/products/real-estate",
        icon: "Package",
        label: "ATR Property Trust",
        description: "Institutional real estate trust intelligence and consultation routing.",
      },
      {
        href: "/app/profiles",
        icon: "UserCheck",
        label: "Profiles",
        description: "Identity, access, and operating profiles.",
      },
    ],
  },
  {
    label: "Command Center",
    adminOnly: true,
    items: [
      {
        href: "/app/command-center",
        icon: "BarChart3",
        label: "Enterprise Operations",
        description: "Role-directed directory for focused platform operating workspaces.",
      },
      {
        href: "/app/command-center/development",
        icon: "Activity",
        label: "Development",
        description: "Repositories, APIs, releases, deployments, and delivery readiness.",
      },
      {
        href: "/app/command-center/tokmetric",
        icon: "BarChart3",
        label: "TikTok Operations",
        description: "Campaign performance, creator signals, approvals, and publishing readiness.",
      },
      {
        href: "/app/command-center/monitoring",
        icon: "Activity",
        label: "Monitoring",
        description: "Live health, evidence, security signals, intelligence, and trends.",
      },
      {
        href: "/app/command-center/agents",
        icon: "Bot",
        label: "AI Agents",
        description: "Agent registry, task quality, approvals, costs, and errors.",
      },
      {
        href: "/app/command-center/integrations",
        icon: "Plug",
        label: "Integrations",
        description: "Connection state, health checks, owners, and remediation.",
      },
    ],
  },
  {
    label: "Portal",
    items: [
      {
        href: "/app/services",
        icon: "Package",
        label: "Services",
        description: "Operational service catalog and workflows.",
      },
      {
        href: "/app/community",
        icon: "Users",
        label: "Community",
        description: "Member and relationship surface inside the portal.",
      },
      {
        href: "/app/workspace",
        icon: "MessageSquare",
        label: "Workspace",
        description: "Execution workspace and collaboration view.",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/app/documents",
        icon: "FileText",
        label: "Documents",
        description: "Statements, agreements, and document vault.",
      },
      {
        href: "/app/meetings",
        icon: "ClipboardList",
        label: "Meetings",
        description: "Consultation requests and scheduling workflow.",
      },
      {
        href: "/app/requests",
        icon: "ClipboardList",
        label: "Requests",
        description: "Service requests, submissions, and tracking.",
      },
      {
        href: "/app/messages",
        icon: "MessageSquare",
        label: "Messages",
        description: "Secure messaging and conversation threads.",
      },
      {
        href: "/app/notifications",
        icon: "Bell",
        label: "Notifications",
        description: "Alerts, updates, and operational notices.",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/app/support",
        icon: "HeadphonesIcon",
        label: "Support",
        description: "Support operations and concierge channels.",
      },
      {
        href: "/app/compliance",
        icon: "ShieldCheck",
        label: "Compliance",
        description: "Compliance review, disclosures, and acknowledgements.",
      },
      {
        href: "/app/profile",
        icon: "User",
        label: "Profile",
        description: "Profile and client identity management.",
      },
      {
        href: "/app/settings",
        icon: "Settings",
        label: "Settings",
        description: "Preferences, account options, and controls.",
      },
      {
        href: "/app/security",
        icon: "Lock",
        label: "Security",
        description: "Security posture, password, and access controls.",
      },
    ],
  },
];

export const adminPortalNavGroups: PlatformNavGroup[] = [
  {
    label: "Organizations & access",
    items: [
      {
        href: "/app/admin",
        icon: "Shield",
        label: "Admin Center",
        description: "Administrative overview and route directory.",
      },
      {
        href: "/app/admin/organization-reports",
        icon: "ClipboardList",
        label: "Organization Highlights",
        description: "Review approved weekly highlights submitted by organization workspaces.",
      },
      {
        href: "/app/admin/workspace-access",
        icon: "Building2",
        label: "Workspace Access",
        description: "Owner-only roles, memberships, and organization workspace access.",
        ownerOnly: true,
      },
      {
        href: "/app/admin/plan-workspaces",
        icon: "Building2",
        label: "Plan Workspaces",
        description: "Owner-only preview of every plan and representative workspace role.",
        ownerOnly: true,
      },
    ],
  },
  {
    label: "Identity & decisions",
    items: [
      {
        href: "/app/admin/market",
        icon: "ClipboardList",
        label: "Market Pipeline",
        description: "Track enterprise leads from first request through qualification and conversion.",
      },
      {
        href: "/app/admin/market/operations",
        icon: "Briefcase",
        label: "Commercial Operations",
        description: "Govern the full market, sales, delivery, success, expansion, and referral lifecycle without duplicate systems.",
      },
      {
        href: "/app/admin/market/research",
        icon: "ClipboardList",
        label: "Market Research",
        description: "Review evidence-safe First-20 company research before any one-to-one outreach or intake creation.",
      },
      {
        href: "/app/admin/customer-success",
        icon: "Users",
        label: "Customer Success",
        description: "Track client health, outcomes, reviews, expansion, renewal, referral, and win-back planning.",
      },
      {
        href: "/app/admin/intake",
        icon: "ClipboardList",
        label: "Intake Queue",
        description: "Review enterprise, community, and product intake submissions.",
      },
      {
        href: "/app/admin/kyc",
        icon: "CheckCircle",
        label: "KYC Queue",
        description: "KYC review queue and decisioning.",
      },
      {
        href: "/app/admin/approvals",
        icon: "ClipboardList",
        label: "Approvals",
        description: "Operational approvals and manual reviews.",
      },
      {
        href: "/app/admin/users",
        icon: "Users",
        label: "Users",
        description: "User management and role administration.",
      },
      {
        href: "/app/admin/allocations",
        icon: "PieChart",
        label: "Allocations",
        description: "Allocation, entitlement, and portfolio administration.",
      },
      {
        href: "/app/admin/gem-verify",
        icon: "ShieldCheck",
        label: "GEM Verify",
        description: "Verification system readiness, cases, evidence, and assurance controls.",
      },
      {
        href: "/app/admin/verification-pilot",
        icon: "UserCheck",
        label: "Verification Pilot",
        description: "Controlled analyst and decision-maker readiness workflow.",
      },
    ],
  },
  {
    label: "Operations & evidence",
    items: [
      {
        href: "/app/admin/api",
        icon: "Activity",
        label: "API Operations",
        description: "Operational API domains, OpenAPI descriptor, connector status, and guardrails.",
      },
      {
        href: "/app/admin/audit",
        icon: "Activity",
        label: "Audit Logs",
        description: "Compliance evidence, admin events, and platform activity.",
      },
      {
        href: "/app/admin/communications",
        icon: "Mail",
        label: "Communication Governance",
        description: "Review marketing-email permission, evidence, jurisdiction, unsubscribe state, and delivery gates.",
      },
      {
        href: "/app/admin/campaigns",
        icon: "Mail",
        label: "Campaigns",
        description: "Email campaign management and controlled delivery.",
      },
      {
        href: "/app/admin/news",
        icon: "Rss",
        label: "News Ingestion",
        description: "Intelligence source management and ingestion run history.",
      },
    ],
  },
];

export const adminPortalNavItems: PlatformNavItem[] = adminPortalNavGroups.flatMap(
  (group) => group.items,
);

export const adminPrimaryNavItems: PlatformNavItem[] = adminPortalNavItems.filter(
  (item) =>
    [
      "/app/admin",
      "/app/admin/organization-reports",
      "/app/admin/workspace-access",
      "/app/admin/api",
      "/app/admin/audit",
    ].includes(item.href),
);

export function resolvePreferredSurface(destination?: string | null) {
  if (!destination) return "marketing-mobile" as const;
  return destination.startsWith("/app")
    ? ("enterprise-web-app" as const)
    : ("marketing-mobile" as const);
}
