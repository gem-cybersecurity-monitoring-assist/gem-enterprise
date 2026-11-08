/** Vendor-neutral, tenant-scoped security event normalization. Never accept tenant scope from untrusted connector payloads. */
export const SECURITY_EVENT_SOURCES = ["wazuh", "suricata", "osquery", "prowler", "trivy", "gem"] as const;
export type SecurityEventSource = (typeof SECURITY_EVENT_SOURCES)[number];
export type SecuritySeverity = "informational" | "low" | "medium" | "high" | "critical";
export type SecurityEvent = Readonly<{
  id: string;
  tenantId: string;
  source: SecurityEventSource;
  sourceEventId: string;
  occurredAt: string;
  receivedAt: string;
  severity: SecuritySeverity;
  title: string;
  description: string;
  assetId?: string;
  evidenceRef?: string;
  responseState: "observe_only";
}>;
type RawAlert = Record<string, unknown>;
function record(value: unknown): RawAlert { return value && typeof value === "object" && !Array.isArray(value) ? value as RawAlert : {}; }
function scalar(value: unknown, max = 240): string {
  return typeof value === "string" || typeof value === "number" ? String(value).slice(0, max) : "";
}
function severityForWazuh(level: number): SecuritySeverity {
  if (level >= 13) return "critical";
  if (level >= 10) return "high";
  if (level >= 7) return "medium";
  if (level >= 4) return "low";
  return "informational";
}
function severityForSuricata(value: number): SecuritySeverity {
  if (value === 1) return "high";
  if (value === 2) return "medium";
  if (value === 3) return "low";
  return "informational";
}
export function normalizeSecurityEvent(input: {
  tenantId: string; source: SecurityEventSource; payload: unknown; receivedAt: string;
}): SecurityEvent {
  const {tenantId, source, receivedAt} = input;
  if (!tenantId || !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId)) throw new Error("Valid server-authorized tenant scope required");
  if (!SECURITY_EVENT_SOURCES.includes(source)) throw new Error("Unsupported security event source");
  if (!Number.isFinite(Date.parse(receivedAt))) throw new Error("Invalid received timestamp");
  const p = record(input.payload), rule = record(p.rule), alert = record(p.alert);
  const sourceEventId = scalar(p.id ?? p.event_id ?? p.uuid, 128);
  if (!sourceEventId) throw new Error("Source event ID required");
  const rawLevel = source === "wazuh" ? Number(rule.level) : source === "suricata" ? Number(alert.severity) : NaN;
  const severity: SecuritySeverity = source === "wazuh" && Number.isFinite(rawLevel)
    ? severityForWazuh(rawLevel)
    : source === "suricata" && Number.isFinite(rawLevel)
      ? severityForSuricata(rawLevel)
      : "informational";
  const candidateTime = scalar(p.timestamp ?? p.time, 64);
  const occurredAt = candidateTime && Number.isFinite(Date.parse(candidateTime)) ? new Date(candidateTime).toISOString() : receivedAt;
  const title = scalar(rule.description ?? alert.signature ?? p.title, 200) || "Security event";
  return Object.freeze({
    id: `${source}:${sourceEventId}`,
    tenantId,
    source,
    sourceEventId,
    occurredAt,
    receivedAt,
    severity,
    title,
    description: scalar(p.description, 1000),
    responseState: "observe_only" as const,
  });
}
