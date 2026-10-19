export type CommandCenterSection =
  | "overview"
  | "executive"
  | "development"
  | "marketing"
  | "sales"
  | "monitoring"
  | "security"
  | "compliance"
  | "revenue"
  | "clients"
  | "teams"
  | "support"
  | "agents"
  | "integrations";

export type MetricTone = "cyan" | "emerald" | "amber" | "rose" | "violet" | "blue";

export interface CommandCenterMetric {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  tone: MetricTone;
}

export const commandCenterSections: Record<
  CommandCenterSection,
  { title: string; description: string }
> = {
  overview: {
    title: "Enterprise Command Center",
    description: "Unified operating view across revenue, security, compliance, clients, and AI automation.",
  },
  executive: {
    title: "Executive Intelligence",
    description: "Decision-grade performance, risk, delivery, and growth indicators for leadership.",
  },
  development: {
    title: "Development Operations",
    description: "Repositories, APIs, releases, deployment readiness, and platform delivery controls.",
  },
  marketing: {
    title: "Marketing Operations",
    description: "Campaigns, social content, news distribution, audience journeys, and governed publishing.",
  },
  sales: {
    title: "Sales Operations",
    description: "Service requests, opportunities, client onboarding, proposals, and commercial handoffs.",
  },
  monitoring: {
    title: "Monitoring & Trends",
    description: "Live platform health, audit evidence, security signals, intelligence, and operational trends.",
  },
  security: {
    title: "Security Operations",
    description: "Incident, vulnerability, posture, response-time, and managed-service operations.",
  },
  compliance: {
    title: "Compliance Management",
    description: "Framework readiness, controls, evidence, policy, risk, audit, and task oversight.",
  },
  revenue: {
    title: "Revenue Operations",
    description: "Subscriptions, service products, usage metering, pipeline, and expansion opportunities.",
  },
  clients: {
    title: "Client Portfolio",
    description: "Tenant health, service adoption, renewal risk, open actions, and upgrade demand.",
  },
  teams: {
    title: "Team Delivery",
    description: "Assigned workspaces, projects, meetings, messages, documents, and weekly delivery updates.",
  },
  support: {
    title: "Support Operations",
    description: "Client requests, support cases, AI assistance, human escalation, and service follow-through.",
  },
  agents: {
    title: "AI Agent Operations",
    description: "Agent registry, task performance, human approvals, cost controls, and error monitoring.",
  },
  integrations: {
    title: "Integration Control Plane",
    description: "Truthful connection state, configuration ownership, health checks, and remediation.",
  },
};

export const commandCenterNavigationGroups: Array<{
  label: string;
  sections: CommandCenterSection[];
}> = [
  {
    label: "Leadership & health",
    sections: ["overview", "executive", "monitoring"],
  },
  {
    label: "Delivery & growth",
    sections: ["development", "marketing", "sales", "revenue"],
  },
  {
    label: "Trust & service",
    sections: ["security", "compliance", "clients", "teams", "support"],
  },
  {
    label: "Automation & connections",
    sections: ["agents", "integrations"],
  },
];

// ---------------------------------------------------------------------------
// Operational datasets (WS-B demo-data remediation, 2026-09-29).
//
// These datasets previously shipped with fabricated illustrative records
// (invented revenue figures, incidents, tenants, agents, and integration
// health). Every dataset below is now explicitly NOT CONNECTED: values are
// empty arrays until a real service backs them and persisted organization
// records exist. Exported names and element types are unchanged so existing
// consumers keep compiling; an empty array must never be read as "zero" or
// as live operational evidence. See `commandCenterConnectionState` for the
// machine-readable connection state.
// ---------------------------------------------------------------------------

export interface CommandCenterRevenueTrendPoint {
  label: string;
  revenue: number;
  target: number;
}

export interface CommandCenterServiceMixSlice {
  name: string;
  percentage: number;
  value: string;
}

export interface CommandCenterActionItem {
  id: string;
  title: string;
  owner: string;
  priority: string;
  due: string;
}

export interface CommandCenterSecurityIncident {
  id: string;
  title: string;
  tenant: string;
  severity: string;
  status: string;
  sla: string;
}

export interface CommandCenterComplianceFramework {
  name: string;
  readiness: number;
  controls: string;
  evidence: string;
  status: string;
}

export interface CommandCenterComplianceTask {
  task: string;
  framework: string;
  owner: string;
  due: string;
  state: string;
}

export interface CommandCenterRevenueProduct {
  name: string;
  model: string;
  customers: number;
  revenue: string;
  margin: string;
  state: string;
}

export interface CommandCenterUsageMeter {
  label: string;
  used: number;
  limit: number;
  display: string;
}

export interface CommandCenterTenantHealth {
  name: string;
  plan: string;
  health: number;
  security: number;
  compliance: number;
  mrr: string;
  renewal: string;
  signal: string;
}

export interface CommandCenterAIAgent {
  name: string;
  purpose: string;
  status: string;
  success: string;
  tasks: string;
  errors: string;
  approval: string;
}

export interface CommandCenterApprovalRequest {
  id: string;
  action: string;
  agent: string;
  tenant: string;
  risk: string;
  age: string;
}

export interface CommandCenterIntegrationEntry {
  name: string;
  category: string;
  state: string;
  lastCheck: string;
  owner: string;
}

export type CommandCenterDatasetKey =
  | "executiveMetrics"
  | "revenueTrend"
  | "serviceMix"
  | "actionQueue"
  | "securityIncidents"
  | "securityMetrics"
  | "complianceFrameworks"
  | "complianceTasks"
  | "revenueProducts"
  | "usageMeters"
  | "tenantHealth"
  | "aiAgents"
  | "approvalQueue"
  | "integrations";

/**
 * Machine-readable connection state for every operational dataset.
 * "not_configured" means no verified service backs the dataset in this
 * surface; consumers must render the not-connected notice rather than
 * treating the (empty) dataset as live.
 */
export const commandCenterConnectionState: Record<CommandCenterDatasetKey, "not_configured"> = {
  executiveMetrics: "not_configured",
  revenueTrend: "not_configured",
  serviceMix: "not_configured",
  actionQueue: "not_configured",
  securityIncidents: "not_configured",
  securityMetrics: "not_configured",
  complianceFrameworks: "not_configured",
  complianceTasks: "not_configured",
  revenueProducts: "not_configured",
  usageMeters: "not_configured",
  tenantHealth: "not_configured",
  aiAgents: "not_configured",
  approvalQueue: "not_configured",
  integrations: "not_configured",
};

export function isCommandCenterDatasetConfigured(key: CommandCenterDatasetKey): boolean {
  return commandCenterConnectionState[key] !== "not_configured";
}

/**
 * Sections whose content previously rendered fabricated datasets. Page-level
 * consumers use this to render the explicit "Not connected — setup required"
 * notice. Keep in sync with the illustrative-analytics section list in the
 * command-center view component.
 */
export const commandCenterNotConnectedSections: CommandCenterSection[] = [
  "executive",
  "security",
  "compliance",
  "revenue",
  "clients",
  "agents",
  "integrations",
];

// Not connected: empty until backed by connected services and persisted records.
export const executiveMetrics: CommandCenterMetric[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const revenueTrend: CommandCenterRevenueTrendPoint[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const serviceMix: CommandCenterServiceMixSlice[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const actionQueue: CommandCenterActionItem[] = [];

// Not connected: empty until backed by connected services and persisted records.
// Must never render as real production incidents.
export const securityIncidents: CommandCenterSecurityIncident[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const securityMetrics: CommandCenterMetric[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const complianceFrameworks: CommandCenterComplianceFramework[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const complianceTasks: CommandCenterComplianceTask[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const revenueProducts: CommandCenterRevenueProduct[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const usageMeters: CommandCenterUsageMeter[] = [];

// Not connected: empty until backed by connected services and persisted records.
// Must never render as real production tenants.
export const tenantHealth: CommandCenterTenantHealth[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const aiAgents: CommandCenterAIAgent[] = [];

// Not connected: empty until backed by connected services and persisted records.
export const approvalQueue: CommandCenterApprovalRequest[] = [];

/**
 * Integration catalog. This shared module has no server context, so entries
 * cannot derive live connector state here: every entry is explicitly marked
 * "Not configured" and no health-check timestamps are claimed ("Never" means
 * no check has been performed from this surface — previously invented values
 * such as "Degraded / 7 min ago" have been removed). Name, category, and
 * owner are structural catalog metadata; the authoritative connector
 * readiness surface is the governed integrations page.
 */
export const integrations: CommandCenterIntegrationEntry[] = [
  { name: "Supabase", category: "Data and identity", state: "Not configured", lastCheck: "Never", owner: "Platform" },
  { name: "Stripe", category: "Billing", state: "Not configured", lastCheck: "Never", owner: "Finance" },
  { name: "Cloudflare", category: "Infrastructure", state: "Not configured", lastCheck: "Never", owner: "Platform" },
  { name: "Vercel", category: "Frontend hosting", state: "Not configured", lastCheck: "Never", owner: "Engineering" },
  { name: "GitHub", category: "Source control", state: "Not configured", lastCheck: "Never", owner: "Engineering" },
  { name: "Google Analytics", category: "Analytics", state: "Not configured", lastCheck: "Never", owner: "Marketing" },
  { name: "Gmail and Calendar", category: "Communication", state: "Not configured", lastCheck: "Never", owner: "Operations" },
  { name: "Slack / Teams", category: "Collaboration", state: "Not configured", lastCheck: "Never", owner: "Operations" },
  { name: "Twilio", category: "Messaging", state: "Not configured", lastCheck: "Never", owner: "Support" },
  { name: "CRM and accounting", category: "Business systems", state: "Not configured", lastCheck: "Never", owner: "Revenue" },
];

export const demoDisclosure =
  "Demo data: values in this command center are illustrative until backed by connected services and persisted organization records. A dataset that renders empty is not connected — setup is required before its values exist. Empty never means zero activity, and nothing here should be treated as live operational evidence.";

export function isCommandCenterSection(value: string): value is CommandCenterSection {
  return value in commandCenterSections && value !== "overview";
}
