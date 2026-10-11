import type { SecurityEvent, SecuritySeverity } from "./events";

/** Pure Sentinel decision stage. No external actions, persistence, provider calls or credentials. */
export type SentinelCase = Readonly<{
  caseKey: string;
  tenantId: string;
  source: SecurityEvent["source"];
  sourceEventId: string;
  severity: SecuritySeverity;
  state: "triage_pending";
  requiresHumanReview: boolean;
  recommendedSteps: readonly string[];
  evidence: Readonly<{eventId: string; receivedAt: string}>;
}>;

const PRIORITY: Record<SecuritySeverity, number> = {
  informational: 0, low: 1, medium: 2, high: 3, critical: 4,
};

export function assessSentinelEvent(event: SecurityEvent): SentinelCase {
  if (!event.tenantId || !event.sourceEventId || !Number.isFinite(Date.parse(event.receivedAt))) {
    throw new Error("Incomplete security event");
  }
  const priority = PRIORITY[event.severity];
  if (priority === undefined) throw new Error("Unsupported severity");
  const steps = priority >= 3
    ? ["Verify source authenticity and asset ownership", "Escalate to a human security operator", "Collect minimally necessary evidence", "Request authorization before containment"]
    : ["Verify source authenticity", "Correlate with recent authorized telemetry", "Document disposition"];
  return Object.freeze({
    caseKey: JSON.stringify([event.tenantId,event.source,event.sourceEventId]),
    tenantId: event.tenantId,
    source: event.source,
    sourceEventId: event.sourceEventId,
    severity: event.severity,
    state: "triage_pending" as const,
    requiresHumanReview: priority >= 3,
    recommendedSteps: Object.freeze(steps),
    evidence: Object.freeze({eventId: event.id,receivedAt: event.receivedAt}),
  });
}
