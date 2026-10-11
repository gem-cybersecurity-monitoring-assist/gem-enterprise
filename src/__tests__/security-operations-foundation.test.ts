import {describe,expect,it} from "vitest";
import {normalizeSecurityEvent} from "../lib/security-operations/events";
import {evaluateSecurityResponse} from "../lib/security-operations/response-policy";
describe("GEM Security Operations free-first foundation",()=>{
  const receivedAt="2026-10-11T18:00:00.000Z";
  it("normalizes a Wazuh alert and enforces server supplied tenant",()=>{
    const result=normalizeSecurityEvent({tenantId:"tenant_one",source:"wazuh",receivedAt,payload:{id:"42",rule:{level:12,description:"Test rule"},tenantId:"malicious"}});
    expect(result.tenantId).toBe("tenant_one");
    expect(result.severity).toBe("high");
    expect(result.responseState).toBe("observe_only");
  });
  it("classifies Suricata high priority alerts",()=>{
    const result=normalizeSecurityEvent({tenantId:"t",source:"suricata",receivedAt,payload:{event_id:"alert1",alert:{severity:1,signature:"Test"}}});
    expect(result.severity).toBe("high");
  });
  it("rejects missing tenant identity and event ID",()=>{
    expect(()=>normalizeSecurityEvent({tenantId:"",source:"wazuh",receivedAt,payload:{id:"1"}})).toThrow();
    expect(()=>normalizeSecurityEvent({tenantId:"t",source:"wazuh",receivedAt,payload:{}})).toThrow();
  });
  it("requires client consent and verified integration for any action",()=>{
    expect(evaluateSecurityResponse({action:"notify_operator",tenantAuthorized:false,integrationVerified:true,policyEnabled:true}).allowed).toBe(false);
    expect(evaluateSecurityResponse({action:"notify_operator",tenantAuthorized:true,integrationVerified:false,policyEnabled:true}).allowed).toBe(false);
  });
  it("requires explicit approval for protective changes",()=>{
    const base={action:"isolate_endpoint" as const,tenantAuthorized:true,integrationVerified:true,policyEnabled:true};
    expect(evaluateSecurityResponse(base).allowed).toBe(false);
    expect(evaluateSecurityResponse({...base,approvalId:"approved-case"}).allowed).toBe(true);
  });
});
