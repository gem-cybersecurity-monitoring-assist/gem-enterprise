export type WorkspaceModuleState = "AVAILABLE" | "SETUP_IN_PROGRESS" | "NOT_ACTIVATED";

export interface ClientWorkspaceModule {
  id: string;
  label: string;
  description: string;
  group: string;
  href: string;
  state: WorkspaceModuleState;
  /**
   * Optional capability inputs consumed by src/lib/workspaceModuleReadiness.ts.
   * When providerNeeded is true the module stays fail-closed until a usable
   * provider connector is recorded for the workspace. When entitlementSlug is
   * set, the module is NOT_ENTITLED unless the slug is in the viewer's
   * entitlements.
   */
  providerNeeded?: boolean;
  entitlementSlug?: string;
}

/**
 * Canonical GEM client workspace catalog.
 *
 * The catalog intentionally maps the full client journey onto existing GEM routes
 * instead of creating a second application. Provider-backed capabilities remain
 * fail-closed until their authoritative connector/service state is active.
 */
export const clientWorkspaceModules: ClientWorkspaceModule[] = [
  { id: "journey", label: "My Journey", description: "Current stage, milestones, progress, decisions, and next actions.", group: "Foundation", href: "/app/workspace", state: "AVAILABLE" },
  { id: "profile", label: "Profile & Company", description: "Client identity, organization profile, operating context, and account settings.", group: "Foundation", href: "/app/profile", state: "AVAILABLE" },
  { id: "projects", label: "Projects", description: "Active delivery work, project status, ownership, milestones, and weekly progress.", group: "Delivery", href: "#workspace-projects", state: "AVAILABLE" },
  { id: "team", label: "Team & Roles", description: "Authorized workspace members, teams, roles, and membership scope.", group: "Delivery", href: "#workspace-team", state: "AVAILABLE" },
  { id: "weekly_updates", label: "Reporting", description: "Weekly delivery updates, accomplishments, blockers, decisions, and priorities.", group: "Delivery", href: "#workspace-weekly-reporting", state: "AVAILABLE" },
  { id: "requests", label: "Service Requests", description: "Request, track, and review GEM services and operational work.", group: "Delivery", href: "/app/requests", state: "AVAILABLE" },
  { id: "opportunities", label: "Growth & Opportunities", description: "Discover and request relevant GEM services, expansion paths, and growth support from the same workspace.", group: "Delivery", href: "/app/services", state: "AVAILABLE" },
  { id: "documents", label: "Documents", description: "Statements, agreements, reports, evidence, and controlled document access.", group: "Records", href: "/app/documents", state: "AVAILABLE" },
  { id: "messages", label: "Messages", description: "Secure client communication and conversation history.", group: "Communication", href: "/app/messages", state: "AVAILABLE" },
  { id: "meetings", label: "Appointments & Meetings", description: "Consultations, meeting requests, scheduling, and engagement history.", group: "Communication", href: "/app/meetings", state: "AVAILABLE" },
  { id: "notifications", label: "Notifications", description: "Operational alerts, service updates, approvals, and required actions.", group: "Communication", href: "/app/notifications", state: "AVAILABLE" },
  { id: "support", label: "Support", description: "Concierge support, escalation, case handling, and guided assistance.", group: "Communication", href: "/app/support", state: "AVAILABLE" },

  { id: "finance", label: "Finance Management", description: "Unified financial management surface for portfolio, cash-flow, payment, and service-finance workflows.", group: "Finance", href: "/app/portfolios", state: "AVAILABLE", providerNeeded: true },
  { id: "portfolio", label: "Portfolio Management", description: "Portfolio views, holdings, allocations, reporting, and client portfolio workflows.", group: "Finance", href: "/app/my-portfolio", state: "AVAILABLE", providerNeeded: true },
  { id: "savings", label: "Savings & Vault", description: "Protected savings and vault products with controlled access and disclosures.", group: "Finance", href: "/app/savings-vault", state: "AVAILABLE", providerNeeded: true },
  { id: "digital_finance", label: "Digital Finance", description: "Digital-asset and digital-currency services exposed only through authorized, compliant product flows.", group: "Finance", href: "/app/products", state: "AVAILABLE", providerNeeded: true },

  { id: "security", label: "Cybersecurity", description: "Security posture, account protection, identity controls, and client security settings.", group: "Security & Compliance", href: "/app/security", state: "AVAILABLE" },
  { id: "threat_monitoring", label: "Threat Monitoring & Alerts", description: "Client-visible security status and governed escalation into GEM monitoring and incident operations.", group: "Security & Compliance", href: "/app/security", state: "AVAILABLE" },
  { id: "compliance", label: "Compliance", description: "Compliance review, disclosures, acknowledgements, evidence, and regulatory workflow.", group: "Security & Compliance", href: "/app/compliance", state: "AVAILABLE" },
  { id: "legal", label: "Legal & Regulatory", description: "Legal and regulatory service requests, evidence, policy, and approval workflows.", group: "Security & Compliance", href: "/app/requests", state: "AVAILABLE" },

  { id: "digital_services", label: "Digital Services", description: "Websites, domains, applications, social presence, stores, content, and connected digital operations.", group: "Digital", href: "/app/services", state: "AVAILABLE" },
  { id: "social_media", label: "Social Media", description: "Accounts, content, approvals, governed publishing, scheduling, and analytics.", group: "Digital", href: "/app/social-media", state: "AVAILABLE", providerNeeded: true },
  { id: "products", label: "Products & Services", description: "Available GEM products, gated offerings, and service activation paths.", group: "Digital", href: "/app/products", state: "AVAILABLE" },
  { id: "community", label: "Community", description: "Member, relationship, and community participation surface.", group: "Digital", href: "/app/community", state: "AVAILABLE" },

  { id: "integrations", label: "Connections & Integrations", description: "Connected provider accounts, connection health, authorized scopes, and governed reconnection.", group: "Connections", href: "/app/social-media/accounts", state: "AVAILABLE" },
  { id: "automations", label: "AI & Automations", description: "Governed automation policy, approval boundaries, and autopilot status.", group: "Connections", href: "/app/social-media/autopilot", state: "AVAILABLE" },
];

export const clientWorkspaceGroups = Array.from(
  new Set(clientWorkspaceModules.map((module) => module.group)),
);
