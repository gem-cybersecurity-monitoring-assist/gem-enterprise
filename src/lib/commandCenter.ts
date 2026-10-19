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

export const executiveMetrics: CommandCenterMetric[] = [
  { label: "Monthly recurring revenue", value: "$148.2K", detail: "Illustrative recurring revenue", trend: "+8.6%", tone: "emerald" },
  { label: "Active client organizations", value: "142", detail: "Across enabled service modules", trend: "+11", tone: "cyan" },
  { label: "Security posture", value: "91/100", detail: "Weighted tenant average", trend: "+3", tone: "blue" },
  { label: "Compliance readiness", value: "84%", detail: "Control evidence completion", trend: "+5%", tone: "violet" },
  { label: "Open critical actions", value: "7", detail: "Security, compliance, and billing", trend: "-4", tone: "rose" },
  { label: "AI automation savings", value: "386h", detail: "Estimated analyst hours this month", trend: "+14%", tone: "amber" },
];

export const revenueTrend = [
  { label: "Jan", revenue: 96, target: 105 },
  { label: "Feb", revenue: 104, target: 108 },
  { label: "Mar", revenue: 111, target: 114 },
  { label: "Apr", revenue: 119, target: 121 },
  { label: "May", revenue: 132, target: 130 },
  { label: "Jun", revenue: 148, target: 142 },
];

export const serviceMix = [
  { name: "Managed cybersecurity", percentage: 34, value: "$50.4K" },
  { name: "Compliance management", percentage: 24, value: "$35.6K" },
  { name: "SaaS subscriptions", percentage: 18, value: "$26.7K" },
  { name: "Consulting", percentage: 10, value: "$14.8K" },
  { name: "AI automation", percentage: 7, value: "$10.4K" },
  { name: "API, training, white label", percentage: 7, value: "$10.3K" },
];

export const actionQueue = [
  { id: "ACT-1042", title: "Contain critical identity alert", owner: "Security Ops", priority: "Critical", due: "18 min" },
  { id: "ACT-1039", title: "Review expired PCI evidence", owner: "Compliance", priority: "High", due: "Today" },
  { id: "ACT-1036", title: "Approve enterprise expansion proposal", owner: "Revenue", priority: "High", due: "Today" },
  { id: "ACT-1031", title: "Resolve degraded Cloudflare health check", owner: "Platform", priority: "Medium", due: "4 hours" },
];

export const securityIncidents = [
  { id: "INC-2088", title: "Suspicious privileged sign-in", tenant: "Northstar Health", severity: "Critical", status: "Investigating", sla: "18m" },
  { id: "INC-2084", title: "Endpoint malware blocked", tenant: "Apex Realty Group", severity: "High", status: "Contained", sla: "42m" },
  { id: "INC-2079", title: "Public bucket exposure", tenant: "Harbor Financial", severity: "High", status: "Remediating", sla: "1h 12m" },
  { id: "INC-2072", title: "Repeated authentication failures", tenant: "Cobalt Logistics", severity: "Medium", status: "Triaged", sla: "3h 05m" },
];

export const securityMetrics: CommandCenterMetric[] = [
  { label: "Active incidents", value: "23", detail: "4 high or critical", trend: "-6", tone: "rose" },
  { label: "Mean time to acknowledge", value: "7m", detail: "Target below 10 minutes", trend: "-2m", tone: "emerald" },
  { label: "Mean time to resolve", value: "3.8h", detail: "Across closed incidents", trend: "-11%", tone: "cyan" },
  { label: "Managed assets", value: "8,412", detail: "Endpoints, cloud, identity, network", trend: "+238", tone: "blue" },
];

export const complianceFrameworks = [
  { name: "SOC 2", readiness: 88, controls: "76 / 86", evidence: "12 due", status: "In progress" },
  { name: "ISO 27001", readiness: 82, controls: "93 / 114", evidence: "18 due", status: "In progress" },
  { name: "NIST CSF", readiness: 91, controls: "97 / 106", evidence: "5 due", status: "Healthy" },
  { name: "HIPAA", readiness: 79, controls: "61 / 77", evidence: "14 due", status: "Attention" },
  { name: "PCI DSS", readiness: 74, controls: "228 / 308", evidence: "29 due", status: "Attention" },
  { name: "GDPR / CCPA", readiness: 86, controls: "49 / 57", evidence: "7 due", status: "In progress" },
];

export const complianceTasks = [
  { task: "Approve access-control policy revision", framework: "ISO 27001", owner: "C. Morgan", due: "Today", state: "Under review" },
  { task: "Upload quarterly vulnerability evidence", framework: "PCI DSS", owner: "Security Ops", due: "Tomorrow", state: "Assigned" },
  { task: "Complete business associate inventory", framework: "HIPAA", owner: "J. Patel", due: "Jul 17", state: "In progress" },
  { task: "Review data-retention exception", framework: "GDPR", owner: "Legal", due: "Jul 19", state: "Draft" },
];

export const revenueProducts = [
  { name: "Analytics SaaS", model: "Subscription", customers: 64, revenue: "$26.7K", margin: "82%", state: "Active" },
  { name: "Managed Cybersecurity", model: "Recurring service", customers: 38, revenue: "$50.4K", margin: "61%", state: "Active" },
  { name: "Compliance Management", model: "Recurring service", customers: 29, revenue: "$35.6K", margin: "68%", state: "Active" },
  { name: "AI Automation", model: "Usage + subscription", customers: 18, revenue: "$10.4K", margin: "74%", state: "Active" },
  { name: "White Label", model: "License", customers: 6, revenue: "$6.9K", margin: "87%", state: "Active" },
  { name: "API and Training", model: "Usage / cohort", customers: 22, revenue: "$3.4K", margin: "71%", state: "Pilot" },
];

export const usageMeters = [
  { label: "API calls", used: 684000, limit: 1000000, display: "684K / 1M" },
  { label: "AI actions", used: 12480, limit: 20000, display: "12.5K / 20K" },
  { label: "Managed assets", used: 8412, limit: 10000, display: "8,412 / 10,000" },
  { label: "Storage", used: 720, limit: 1000, display: "720 GB / 1 TB" },
];

export const tenantHealth = [
  { name: "Northstar Health", plan: "Enterprise", health: 72, security: 68, compliance: 81, mrr: "$8,900", renewal: "Aug 28", signal: "At risk" },
  { name: "Apex Realty Group", plan: "Professional", health: 91, security: 94, compliance: 86, mrr: "$4,200", renewal: "Oct 04", signal: "Healthy" },
  { name: "Harbor Financial", plan: "Enterprise", health: 84, security: 79, compliance: 92, mrr: "$11,600", renewal: "Sep 16", signal: "Watch" },
  { name: "Cobalt Logistics", plan: "Professional", health: 88, security: 90, compliance: 82, mrr: "$3,800", renewal: "Nov 11", signal: "Healthy" },
  { name: "Evergreen Legal", plan: "Basic", health: 76, security: 83, compliance: 69, mrr: "$1,450", renewal: "Aug 09", signal: "Expansion" },
];

export const aiAgents = [
  { name: "Security Triage Agent", purpose: "Classify and enrich alerts", status: "Running", success: "96.4%", tasks: "1,842", errors: "7", approval: "Containment actions" },
  { name: "Compliance Evidence Agent", purpose: "Map evidence to controls", status: "Running", success: "93.1%", tasks: "624", errors: "11", approval: "Evidence approval" },
  { name: "Revenue Insight Agent", purpose: "Identify service expansion", status: "Review", success: "89.8%", tasks: "188", errors: "4", approval: "Client outreach" },
  { name: "Executive Briefing Agent", purpose: "Create daily leadership brief", status: "Running", success: "98.0%", tasks: "142", errors: "1", approval: "External distribution" },
];

export const approvalQueue = [
  { id: "APR-441", action: "Send upgrade recommendation", agent: "Revenue Insight Agent", tenant: "Evergreen Legal", risk: "External message", age: "12m" },
  { id: "APR-439", action: "Contain suspicious identity", agent: "Security Triage Agent", tenant: "Northstar Health", risk: "Security action", age: "18m" },
  { id: "APR-436", action: "Accept uploaded audit evidence", agent: "Compliance Evidence Agent", tenant: "Harbor Financial", risk: "Compliance approval", age: "37m" },
];

export const integrations = [
  { name: "Supabase", category: "Data and identity", state: "Configuration required", lastCheck: "Never", owner: "Platform" },
  { name: "Stripe", category: "Billing", state: "Not configured", lastCheck: "Never", owner: "Finance" },
  { name: "Cloudflare", category: "Infrastructure", state: "Degraded", lastCheck: "7 min ago", owner: "Platform" },
  { name: "Vercel", category: "Frontend hosting", state: "Connected", lastCheck: "3 min ago", owner: "Engineering" },
  { name: "GitHub", category: "Source control", state: "Connected", lastCheck: "1 min ago", owner: "Engineering" },
  { name: "Google Analytics", category: "Analytics", state: "Not configured", lastCheck: "Never", owner: "Marketing" },
  { name: "Gmail and Calendar", category: "Communication", state: "Configuration required", lastCheck: "Never", owner: "Operations" },
  { name: "Slack / Teams", category: "Collaboration", state: "Not configured", lastCheck: "Never", owner: "Operations" },
  { name: "Twilio", category: "Messaging", state: "Not configured", lastCheck: "Never", owner: "Support" },
  { name: "CRM and accounting", category: "Business systems", state: "Not configured", lastCheck: "Never", owner: "Revenue" },
];

export const demoDisclosure =
  "Demo data: values in this command center are illustrative until backed by connected services and persisted organization records.";

export function isCommandCenterSection(value: string): value is CommandCenterSection {
  return value in commandCenterSections && value !== "overview";
}
