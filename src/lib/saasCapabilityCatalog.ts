/**
 * Pre-launch SaaS surface inventory. This is a product/navigation register,
 * NOT a runtime health attestation or a grant of access/entitlement.
 * Never infer production availability from a route existing.
 */
export type SaaSArea = "owner" | "operations" | "client" | "community" | "market";
export type SaaSReadiness = "existing-surface" | "preview-only" | "request-only" | "planned";
export type SaaSCapability = Readonly<{
  id: string;
  area: SaaSArea;
  title: string;
  description: string;
  href?: string;
  readiness: SaaSReadiness;
  activationGate: string;
}>;

export const saasCapabilityCatalog: readonly SaaSCapability[] = [
  { id: "owner-command", area: "owner", title: "Enterprise command center", description: "Executive, security, compliance, revenue, client and agent oversight.", href: "/app/command-center", readiness: "existing-surface", activationGate: "Existing staff authorization and verified backend readiness" },
  { id: "owner-approvals", area: "owner", title: "Approvals and audit", description: "Human authorization, evidence, security-event and decision controls.", href: "/app/admin/approvals", readiness: "existing-surface", activationGate: "Role authorization, evidence review and audit retention" },
  { id: "organization-management", area: "operations", title: "Organization management", description: "Tenant administration, memberships, invitations and workspace controls.", href: "/app/admin/users", readiness: "existing-surface", activationGate: "Server-side tenant isolation and least privilege" },
  { id: "service-operations", area: "operations", title: "Service operations", description: "Service requests, support, escalations, meetings and assigned work.", href: "/app/requests", readiness: "existing-surface", activationGate: "Authenticated, resource-scoped request access" },
  { id: "social-operations", area: "operations", title: "Social content operations", description: "Content production, approvals, campaigns and provider readiness.", href: "/app/social-media", readiness: "existing-surface", activationGate: "OAuth, human content approval and provider-specific activation" },
  { id: "agent-governance", area: "operations", title: "AI agent governance", description: "Agent visibility, human approval gates and restricted actions.", href: "/app/command-center/agents", readiness: "existing-surface", activationGate: "Agent policy, action boundaries and audited authorization" },
  { id: "client-workspace", area: "client", title: "Client workspace", description: "Private workspace, service status, documents and communication.", href: "/app/workspace", readiness: "existing-surface", activationGate: "Invitation, client session, membership and ownership checks" },
  { id: "client-support", area: "client", title: "Client support", description: "Tickets, follow-ups and documented service coordination.", href: "/app/support", readiness: "existing-surface", activationGate: "Authenticated requester and ticket-level authorization" },
  { id: "community", area: "community", title: "Member community", description: "Circles, events, resources, profiles and moderated discussion.", href: "/community-hub", readiness: "preview-only", activationGate: "Real identities, moderation, consent, privacy and member-access policy" },
  { id: "marketplace", area: "market", title: "Service marketplace", description: "Listings, service discovery, provider applications and matching.", href: "/store", readiness: "request-only", activationGate: "Approved offers, provider verification, policies and transaction authorization" },
  { id: "subscriptions", area: "market", title: "SaaS subscriptions and billing", description: "Plans, metering, invoicing, taxes, refunds and entitlement lifecycle.", readiness: "planned", activationGate: "Approved plans, legal review, payment integration, signed webhooks and reconciliation" },
  { id: "partner-network", area: "market", title: "Partner and reseller network", description: "Applications, qualification, referrals and future white-label workspaces.", readiness: "planned", activationGate: "Signed agreements, eligibility, tenant separation and approval workflows" },
] as const;

export function listSaaSCapabilities(area?: SaaSArea): readonly SaaSCapability[] {
  return area ? saasCapabilityCatalog.filter((capability) => capability.area === area) : saasCapabilityCatalog;
}
