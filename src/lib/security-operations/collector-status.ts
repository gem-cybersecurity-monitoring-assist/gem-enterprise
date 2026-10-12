export type CollectorReadiness = {
  enabled: boolean;
  consentVerifiedAt: string | Date | null;
  revokedAt: string | Date | null;
  expiresAt: string | Date;
};
function time(value: string | Date) { return value instanceof Date ? value.getTime() : Date.parse(value); }
export function collectorStatus(collector: CollectorReadiness, now = Date.now()) {
  if (collector.revokedAt) return "revoked" as const;
  const expiry = time(collector.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) return "expired" as const;
  if (!collector.enabled || !collector.consentVerifiedAt ||
      !Number.isFinite(time(collector.consentVerifiedAt))) return "disabled" as const;
  return "enabled" as const;
}
