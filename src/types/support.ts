// ─── Core Support Domain Types ────────────────────────────────────────────────

export type SupportSessionStatus =
  | "pending_consent"
  | "active"
  | "escalated"
  | "ticket_created"
  | "booking_requested"
  | "closed";

export type MessageRole = "user" | "assistant" | "system";

export type EscalationReason =
  | "user_requested"
  | "policy_triggered"
  | "incident_detected"
  | "restricted_class"
  | "billing_query"
  | "consultation_request";

export type SupportQueue =
  | "General Member Support"
  | "Premium Member Support"
  | "VIP Concierge"
  | "Cybersecurity / Incident"
  | "Consultation Scheduling"
  | "Billing / Accounts";

export interface SupportMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO string
  metadata?: Record<string, unknown>;
}

export interface SupportSession {
  id: string;
  userId: string;
  userEmail: string;
  status: SupportSessionStatus;
  consentAccepted: boolean;
  consentAcceptedAt?: string;
  queue: SupportQueue;
  escalationReason?: EscalationReason;
  escalatedAt?: string;
  escalationPayload?: AtlassianHandoffPayload;
  ticketId?: string;
  bookingId?: string;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
  userTier?: "vip" | "premium" | "standard";
}

export interface AtlassianHandoffPayload {
  projectKey: string;
  issueType: string;
  summary: string;
  description: string;
  priority: "Highest" | "High" | "Medium" | "Low";
  labels: string[];
  customFields: Record<string, string>;
  transcript: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  queue: SupportQueue;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  sessionId: string;
  userId: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  atlassianIssueKey?: string;
}

export interface SupportBooking {
  id: string;
  sessionId: string;
  userId: string;
  type: "consultation" | "advisory" | "technical";
  notes: string;
  status: "requested" | "confirmed" | "cancelled";
  createdAt: string;
}

export interface PolicyEvaluationResult {
  shouldEscalate: boolean;
  escalationReason?: EscalationReason;
  restrictedClass?:
    | "LEGAL_ADVICE"
    | "FINANCIAL_ADVICE"
    | "SECURITY_CLOSURE"
    | "IDENTITY_DETERMINATION";
  queue?: SupportQueue;
  path?: "escalate" | "booking" | "billing" | "continue";
  triggerKeyword?: string;
}

export interface OrchestrationResult {
  reply: string;
  action?: "continue" | "escalate" | "booking" | "billing";
  shouldEscalate: boolean;
  escalationReason?: EscalationReason;
  queue?: SupportQueue;
  knowledgeLinks?: Array<{
    title: string;
    href: string;
    description: string;
  }>;
  suggestedReplies?: string[];
  responseSource?: "gateway" | "fallback" | "policy";
  providerStatus?: "available" | "disabled" | "budget_limited" | "rate_limited" | "unavailable";
  metadata?: Record<string, unknown>;
}
