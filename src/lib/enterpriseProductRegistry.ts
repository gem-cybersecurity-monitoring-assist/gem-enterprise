export type ProductBoundary = "gem_internal" | "independent_saas";
export type ProductReadiness = "LIVE" | "CONTROLLED" | "PLANNED";

export interface EnterpriseProduct {
  id: "gem-workspace-os" | "iww" | "crypto-signal-bot" | "btcc-copy-manager";
  name: string;
  summary: string;
  boundary: ProductBoundary;
  readiness: ProductReadiness;
  launchHref: string | null;
  authentication: string;
  dataAuthority: string;
  repository: string;
  owner: string;
  capabilities: readonly string[];
}

export interface EnterpriseControlDomain {
  id: "production" | "teams" | "marketing-sales" | "development" | "crypto" | "ai-agents" | "integrations";
  label: string;
  href: string;
  purpose: string;
}

export const IWW_PRODUCTION_ORIGIN = "https://infinite-wealth-wellbeing.vercel.app";
export const IWW_WORKSPACE_LAUNCH_URL = `${IWW_PRODUCTION_ORIGIN}/workspaces`;

export const enterpriseProducts: readonly EnterpriseProduct[] = [
  {
    id: "gem-workspace-os",
    name: "GEM Enterprise Workspace OS",
    summary: "Internal company control plane for delivery, governance, operations, commercial teams, engineering, and product oversight.",
    boundary: "gem_internal",
    readiness: "LIVE",
    launchHref: "/app/workspace",
    authentication: "GEM Enterprise session and server-authoritative GEM role",
    dataAuthority: "GEM Enterprise database and organization scopes",
    repository: "support371/gem-enterprise",
    owner: "GEM platform operations",
    capabilities: ["Company operations", "Team delivery", "Marketing and sales", "Development", "AI governance"],
  },
  {
    id: "iww",
    name: "Infinite World of Well-Being",
    summary: "Independent multi-tenant wealth and wellbeing SaaS for organization owners, staff, members, and explicitly delegated family access.",
    boundary: "independent_saas",
    readiness: "LIVE",
    launchHref: IWW_WORKSPACE_LAUNCH_URL,
    authentication: "Dedicated IWW Supabase Auth session; GEM sessions are never forwarded",
    dataAuthority: "Dedicated IWW Supabase project with organization-scoped RLS",
    repository: "support371/infinite-wealth-wellbeing",
    owner: "IWW platform administration",
    capabilities: ["Tenant workspaces", "Member portal", "Wealth planning", "Wellbeing planning", "306-app integration catalog"],
  },
  {
    id: "crypto-signal-bot",
    name: "Crypto Signal Bot",
    summary: "A separately governed crypto intelligence product boundary. It must not inherit trading authority from GEM or IWW.",
    boundary: "independent_saas",
    readiness: "PLANNED",
    launchHref: null,
    authentication: "Separate product identity boundary required",
    dataAuthority: "Separate product data store required",
    repository: "Separate repository required before activation",
    owner: "Crypto product governance",
    capabilities: ["Market intelligence", "Signal review", "Human approval", "Risk controls"],
  },
  {
    id: "btcc-copy-manager",
    name: "BTCC Copy Manager",
    summary: "A separately governed execution-management product boundary with mandatory consent, exchange authorization, and human controls.",
    boundary: "independent_saas",
    readiness: "PLANNED",
    launchHref: null,
    authentication: "Separate product identity and exchange authorization required",
    dataAuthority: "Separate encrypted product data store required",
    repository: "Separate repository required before activation",
    owner: "Crypto product governance",
    capabilities: ["Consent records", "Execution controls", "Position limits", "Audit evidence"],
  },
] as const;

export const enterpriseControlDomains: readonly EnterpriseControlDomain[] = [
  { id: "production", label: "Production operations", href: "/app/command-center/monitoring", purpose: "Deployment health, incidents, evidence, and operating readiness." },
  { id: "teams", label: "Teams and roles", href: "/app/command-center/teams", purpose: "Internal delivery teams, assigned projects, ownership, and weekly execution." },
  { id: "marketing-sales", label: "Marketing and sales", href: "/app/command-center/marketing", purpose: "Campaigns, content, opportunities, client success, and governed publishing." },
  { id: "development", label: "Digital development", href: "/app/command-center/development", purpose: "Repositories, APIs, preview environments, release gates, and production delivery." },
  { id: "crypto", label: "Crypto product governance", href: "/app/command-center/compliance", purpose: "Product boundaries, human approvals, risk limits, consent, and evidence." },
  { id: "ai-agents", label: "AI and agent flows", href: "/app/command-center/agents", purpose: "Agent registry, permitted actions, quality, cost, errors, and human approvals." },
  { id: "integrations", label: "Integration estate", href: "/app/command-center/integrations", purpose: "Provider catalog, connection state, scope, ownership, revocation, and health." },
] as const;

export function getEnterpriseProduct(id: EnterpriseProduct["id"]) {
  return enterpriseProducts.find((product) => product.id === id);
}

export function isApprovedExternalProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === IWW_PRODUCTION_ORIGIN;
  } catch {
    return false;
  }
}
