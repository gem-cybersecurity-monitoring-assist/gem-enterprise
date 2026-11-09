import type { SaaSArea } from "@/lib/saasCapabilityCatalog";

export const saasAreaArchitecture: Record<SaaSArea, {
  title: string;
  subtitle: string;
  eyebrow: string;
  purpose: string;
  steps: readonly [string, string, string][];
  accent: "cyan" | "sky" | "emerald" | "violet" | "amber";
}> = {
  owner: {
    title: "Enterprise governance",
    subtitle: "One command view for your policies, leadership decisions and operating posture.",
    eyebrow: "01 / GOVERNANCE",
    purpose: "Review authorizations, organization access, audit evidence and implementation readiness using the GEM Enterprise authority model.",
    steps: [
      ["Inspect", "Review current operating context", "Use existing enterprise metrics and audit records"],
      ["Decide", "Open controlled approval queues", "Existing authority checks remain in force"],
      ["Verify", "Review the supporting evidence", "Confirm recorded outcomes before publication"],
    ],
    accent: "cyan",
  },
  operations: {
    title: "Enterprise operations",
    subtitle: "Coordinate service delivery, cases, teams, social operations and connectors.",
    eyebrow: "02 / OPERATIONS",
    purpose: "Find the right operational workspace and follow governed handoffs without maintaining a second system.",
    steps: [
      ["Discover", "Locate the active work queue", "Review scoped requests and assigned responsibilities"],
      ["Operate", "Continue in the existing workspace", "Preserve service-specific approval controls"],
      ["Review", "Reconcile delivery evidence", "Check actual provider and workflow readiness"],
    ],
    accent: "sky",
  },
  client: {
    title: "Client experience",
    subtitle: "Organize the journey from customer intake to private delivery and support.",
    eyebrow: "03 / CLIENT SERVICES",
    purpose: "Access the client-facing operational surfaces already supported by the platform, without weakening tenant isolation.",
    steps: [
      ["Onboard", "Establish approved client access", "Identity, invitations and membership remain authoritative"],
      ["Deliver", "Coordinate requests and service work", "Use existing service and workspace permissions"],
      ["Support", "Keep communication accountable", "Review tickets, documents and meeting status"],
    ],
    accent: "emerald",
  },
  community: {
    title: "Community development",
    subtitle: "Shape the future moderated GEM network without presenting prototypes as live memberships.",
    eyebrow: "04 / COMMUNITY",
    purpose: "Review the nonbinding application route, experience prototypes and responsible launch requirements.",
    steps: [
      ["Apply", "Gather future-member interest", "Applications do not grant membership"],
      ["Design", "Review group and resource previews", "All mock profiles and events are disclosed"],
      ["Govern", "Prepare identity and moderation rules", "Launch requires real operations and owner authorization"],
    ],
    accent: "violet",
  },
  market: {
    title: "Marketplace & growth",
    subtitle: "Bring offerings, qualification and partner workflows together on a controlled commercial journey.",
    eyebrow: "05 / COMMERCIAL",
    purpose: "Review request-only store and service paths, sales qualification and approved future commercial infrastructure.",
    steps: [
      ["Present", "Review existing service offerings", "Use accurate claims and verified qualifications"],
      ["Qualify", "Route enquiries to staff", "Orders and subscriptions remain unactivated"],
      ["Prepare", "Assess commerce release requirements", "Pricing, payment and partner agreements need approval"],
    ],
    accent: "amber",
  },
};

export const saasAreaOrder: readonly SaaSArea[] = ["owner", "operations", "client", "community", "market"];
