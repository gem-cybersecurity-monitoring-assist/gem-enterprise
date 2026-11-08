import { normalizeSecurityEvent, type SecurityEventSource } from "./events";
import { assessSentinelEvent, type SentinelCase } from "./sentinel-flow";

/**
 * A trust-boundary contract for an eventual authenticated collector.
 * The transport/authentication layer must construct VerifiedCollectorContext ONLY
 * after independently validating the credential, tenant, integration and replay.
 * This pure function neither authenticates an HTTP caller nor stores any data.
 */
export type VerifiedCollectorContext = Readonly<{
  tenantId: string;
  source: SecurityEventSource;
  integrationId: string;
  authenticated: boolean;
  enabled: boolean;
  tenantConsentVerified: boolean;
  replayProtectionVerified: boolean;
}>;

export type IngestionEvaluation =
  | Readonly<{accepted: false; code: "UNAUTHENTICATED" | "NOT_ENABLED" | "CONSENT_REQUIRED" | "REPLAY_UNVERIFIED" | "INVALID_INTEGRATION" | "INVALID_ALERT"}>
  | Readonly<{accepted: true; code: "READY_FOR_PERSISTENCE"; incident: SentinelCase}>;

export function evaluateIncomingSecurityAlert(
  context: VerifiedCollectorContext,
  payload: unknown,
  receivedAt: string,
): IngestionEvaluation {
  if (!context.authenticated) return {accepted:false,code:"UNAUTHENTICATED"};
  if (!context.enabled) return {accepted:false,code:"NOT_ENABLED"};
  if (!context.tenantConsentVerified) return {accepted:false,code:"CONSENT_REQUIRED"};
  if (!context.replayProtectionVerified) return {accepted:false,code:"REPLAY_UNVERIFIED"};
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(context.integrationId)) return {accepted:false,code:"INVALID_INTEGRATION"};
  try {
    // Never take tenant scope or source from payload.
    const event = normalizeSecurityEvent({
      tenantId:context.tenantId,
      source:context.source,
      payload,
      receivedAt,
    });
    return {accepted:true,code:"READY_FOR_PERSISTENCE",incident:assessSentinelEvent(event)};
  } catch {
    return {accepted:false,code:"INVALID_ALERT"};
  }
}
