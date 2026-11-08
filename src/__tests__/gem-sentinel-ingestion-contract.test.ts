import { describe, expect, it } from "vitest";
import { evaluateIncomingSecurityAlert, type VerifiedCollectorContext } from "../lib/security-operations/ingestion-contract";

const context: VerifiedCollectorContext = {
  tenantId: "tenantA", source: "wazuh", integrationId: "lab_agent_1",
  authenticated: true, enabled: true, tenantConsentVerified: true,
  replayProtectionVerified: true,
};
const alert = {id:"evt_1",tenantId:"attacker",rule:{level:13,description:"Lab signal"}};
const at = "2026-10-11T19:05:00.000Z";
describe("GEM Sentinel secure ingestion contract", () => {
  it.each([
    [{authenticated:false},"UNAUTHENTICATED"],
    [{enabled:false},"NOT_ENABLED"],
    [{tenantConsentVerified:false},"CONSENT_REQUIRED"],
    [{replayProtectionVerified:false},"REPLAY_UNVERIFIED"],
    [{integrationId:"../../other"},"INVALID_INTEGRATION"],
  ] as const)("fails closed when %o", (change,code) => {
    expect(evaluateIncomingSecurityAlert({...context,...change},alert,at)).toEqual({accepted:false,code});
  });
  it("rejects missing or malformed alerts",()=>{
    expect(evaluateIncomingSecurityAlert(context,{},at)).toEqual({accepted:false,code:"INVALID_ALERT"});
  });
  it("uses verified tenant scope, not event-provided tenant scope",()=>{
    const result=evaluateIncomingSecurityAlert(context,alert,at);
    expect(result.accepted).toBe(true);
    if(result.accepted){
      expect(result.incident.tenantId).toBe("tenantA");
      expect(result.incident.severity).toBe("critical");
      expect(result.incident.requiresHumanReview).toBe(true);
      expect(result.code).toBe("READY_FOR_PERSISTENCE");
    }
  });
});
