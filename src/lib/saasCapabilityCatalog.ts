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
  { id: "owner-audit", area: "owner", title: "Audit evidence", description: "Review administrative actions and accountability.", href: "/app/admin/audit", readiness: "existing-surface", activationGate: "Authorized reviewer, evidence retention and audit integrity" },
  { id: "owner-access", area: "owner", title: "Owner workspace access", description: "Control organization access, invitations and workspace ownership.", href: "/app/admin/workspace-access", readiness: "existing-surface", activationGate: "Named owner authorization, MFA and revocation" },
  { id: "owner-development", area: "owner", title: "Development and release center", description: "Inspect platform delivery, integrations and release readiness.", href: "/app/command-center/development", readiness: "existing-surface", activationGate: "Authenticated operator and verified deployment metadata" },
  { id: "owner-monitoring", area: "owner", title: "System monitoring", description: "Inspect evidence-led health, incidents and operating readiness.", href: "/app/command-center/monitoring", readiness: "existing-surface", activationGate: "Real telemetry, provenance and verified monitoring coverage" },
  { id: "intake-queue", area: "operations", title: "Customer intake", description: "Review enterprise, community and product requests.", href: "/app/admin/intake", readiness: "existing-surface", activationGate: "Authenticated reviewer, intake audit and queue permissions" },
  { id: "customer-success", area: "operations", title: "Customer success", description: "Track handoffs, renewal readiness and support needs.", href: "/app/admin/customer-success", readiness: "existing-surface", activationGate: "Authoritative client record and workspace-scoped authorization" },
  { id: "commercial-pipeline", area: "operations", title: "Sales pipeline", description: "Manage business enquiries and market qualification.", href: "/app/admin/market", readiness: "existing-surface", activationGate: "Approval-gated contact and accurate lead attribution" },
  { id: "commercial-operations", area: "operations", title: "Commercial workflows", description: "Coordinate proposals, service delivery and handoffs.", href: "/app/admin/market/operations", readiness: "existing-surface", activationGate: "Approved scopes and signed commercial agreements" },
  { id: "content-governance", area: "operations", title: "Content & campaigns", description: "Manage campaign drafts and communication governance.", href: "/app/admin/campaigns", readiness: "existing-surface", activationGate: "Consent, approved messaging and provider authorization" },
  { id: "news-operations", area: "operations", title: "News publishing", description: "Review intelligence sources and ingestion history.", href: "/app/admin/news", readiness: "existing-surface", activationGate: "Source provenance and publication approval" },
  { id: "kyc-review", area: "operations", title: "Identity review", description: "Handle KYC requests and decisions via approved routes.", href: "/app/admin/kyc", readiness: "existing-surface", activationGate: "Encrypted storage, privacy review and human decisions" },
  { id: "verification", area: "operations", title: "Verification evidence", description: "Review applicable evidence and credential claims.", href: "/app/admin/gem-verify", readiness: "existing-surface", activationGate: "Issuer evidence and publication approval" },
  { id: "api-operations", area: "operations", title: "API operations", description: "Inspect documented API domains and security controls.", href: "/app/admin/api", readiness: "existing-surface", activationGate: "Scoped credentials, rate limits and contract tests" },
  { id: "integrations", area: "operations", title: "Connector management", description: "Review provider configuration and remediation.", href: "/app/command-center/integrations", readiness: "existing-surface", activationGate: "Connection tests, authorization and owner action" },
  { id: "social-command", area: "operations", title: "Social command center", description: "Coordinate social posts, video, analytics and approvals.", href: "/app/command-center/social-media", readiness: "existing-surface", activationGate: "Provider OAuth and governed publishing flow" },
  { id: "client-requests", area: "client", title: "Client service requests", description: "Track service requests and assigned work.", href: "/app/requests", readiness: "existing-surface", activationGate: "Organization-scoped and user-scoped access" },
  { id: "client-documents", area: "client", title: "Client documents", description: "Review authorized document metadata and uploads.", href: "/app/documents", readiness: "existing-surface", activationGate: "Private storage readiness, retention and file scanning" },
  { id: "client-messages", area: "client", title: "Client messages", description: "Communicate through existing governed channels.", href: "/app/messages", readiness: "existing-surface", activationGate: "Authenticated threads and verified delivery state" },
  { id: "client-meetings", area: "client", title: "Client meetings", description: "Coordinate meetings and approved consultations.", href: "/app/meetings", readiness: "existing-surface", activationGate: "Accurate booking state and participant permissions" },
  { id: "client-notifications", area: "client", title: "Client notifications", description: "Review service updates and approval notifications.", href: "/app/notifications", readiness: "existing-surface", activationGate: "Verified delivery and recipient isolation" },
  { id: "client-security", area: "client", title: "Account security", description: "Review authorized account protection settings.", href: "/app/security", readiness: "existing-surface", activationGate: "Strong authenticated sessions and user verification" },
  { id: "client-settings", area: "client", title: "Workspace preferences", description: "Manage accessible account preferences.", href: "/app/settings", readiness: "existing-surface", activationGate: "Owned settings and server-side validation" },
  { id: "community-applications", area: "community", title: "Member applications", description: "Accept nonbinding expressions of interest for future review.", href: "/community/apply", readiness: "existing-surface", activationGate: "Consent, review workflow and no auto-membership" },
  { id: "community-knowledge", area: "community", title: "Knowledge library", description: "Preview member guides and controlled resources.", href: "/community-hub/knowledge", readiness: "preview-only", activationGate: "Content approval and rights verification" },
  { id: "community-events", area: "community", title: "Community events", description: "Preview event and briefing experiences.", href: "/community-hub/events", readiness: "preview-only", activationGate: "Real hosts, event terms and scheduling ownership" },
  { id: "community-circles", area: "community", title: "Member circles", description: "Preview moderated topic groups.", href: "/community-hub/circles", readiness: "preview-only", activationGate: "Member identity, moderation and abuse controls" },
  { id: "product-catalog", area: "market", title: "Service catalog", description: "Request review for approved products and packages.", href: "/store", readiness: "request-only", activationGate: "Product scope, provider readiness and approved commercial terms" },
  { id: "enterprise-services", area: "market", title: "Business service offering", description: "Explain cybersecurity and consulting services.", href: "/services", readiness: "existing-surface", activationGate: "Truthful service scope and personnel qualifications" },
  { id: "enterprise-intake", area: "market", title: "Business qualification", description: "Use the controlled business onboarding pathway.", href: "/business-review", readiness: "existing-surface", activationGate: "Commercial terms and verified service coverage" },
  { id: "partner-application", area: "market", title: "Operator and partner enquiry", description: "Review existing prospective operator contact route.", href: "/operator-invitation", readiness: "request-only", activationGate: "Affiliation, license and onboarding review" },
  { id: "market-research", area: "market", title: "Go-to-market research", description: "Inspect lead qualification and market discovery.", href: "/app/admin/market/research", readiness: "existing-surface", activationGate: "Consent and evidence-safe contact authorization" },
  { id: "public-trust", area: "market", title: "Trust and disclosure", description: "Inspect public trust information before market launch.", href: "/trust-center", readiness: "existing-surface", activationGate: "Public claims evidence, approved language and legal review" },
] as const;

export function listSaaSCapabilities(area?: SaaSArea): readonly SaaSCapability[] {
  return area ? saasCapabilityCatalog.filter((capability) => capability.area === area) : saasCapabilityCatalog;
}
