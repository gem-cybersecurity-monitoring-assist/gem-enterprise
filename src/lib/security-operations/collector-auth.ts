import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { SentinelCollector } from "@prisma/client";

export const COLLECTOR_SOURCES = ["wazuh", "suricata", "osquery", "prowler", "trivy", "gem"] as const;
export type CollectorSource = (typeof COLLECTOR_SOURCES)[number];

export function generateCollectorCredential() {
  const id = randomUUID();
  const key = `snt_${id}.${randomBytes(32).toString("base64url")}`;
  return { id, key, keyHash: hashCollectorCredential(key) };
}
export function hashCollectorCredential(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
export function collectorIdFromCredential(key: string): string | null {
  const match = /^snt_([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.[A-Za-z0-9_-]{43}$/.exec(key);
  return match?.[1] ?? null;
}
export function credentialMatches(key: string, collector: Pick<SentinelCollector, "keyHash">) {
  const actual = Buffer.from(hashCollectorCredential(key), "hex");
  const expected = Buffer.from(collector.keyHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function isCollectorReady(collector: Pick<SentinelCollector, "enabled" | "consentVerifiedAt" | "revokedAt" | "expiresAt">, now = new Date()) {
  return collector.enabled && !!collector.consentVerifiedAt && !collector.revokedAt && collector.expiresAt > now;
}
