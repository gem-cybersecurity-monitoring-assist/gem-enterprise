import { describe, expect, it } from "vitest";
import { normalizeSecurityEvent } from "../lib/security-operations/events";
import { assessSentinelEvent } from "../lib/security-operations/sentinel-flow";
describe("GEM Sentinel observe-only workflow", () => {
  it("produces a tenant-scoped review case without executing an action", () => {
    const receivedAt="2026-10-11T19:00:00.000Z";
    const event=normalizeSecurityEvent({tenantId:"customer_a", source:"wazuh", receivedAt, payload:{id:"abc",rule:{level:14,description:"Lab test"}}});
    const result=assessSentinelEvent(event);
    expect(result).toMatchObject({tenantId:"customer_a",severity:"critical",state:"triage_pending",requiresHumanReview:true});
    expect(result.recommendedSteps).toContain("Request authorization before containment");
    expect(result.caseKey).toContain("customer_a");
  });
  it("cannot collide between tenants with the same sensor event ID", () => {
    const make=(tenantId:string)=>assessSentinelEvent(normalizeSecurityEvent({tenantId,source:"suricata",receivedAt:"2026-10-11T19:00:00Z",payload:{event_id:"same",alert:{severity:1}}}));
    expect(make("tenant_a").caseKey).not.toBe(make("tenant_b").caseKey);
  });
  it("fails safe: unmapped sources require human review without containment", () => {
    const item=assessSentinelEvent(normalizeSecurityEvent({tenantId:"test",source:"osquery",receivedAt:"2026-10-11T19:00:00Z",payload:{id:"evt1"}}));
    expect(item.severity).toBe("unknown");
    expect(item.requiresHumanReview).toBe(true);
    expect(item.state).toBe("triage_pending");
  });
  it("treats missing or null Wazuh levels as unknown, and low mapped levels as not requiring review", () => {
    const mk=(payload:unknown)=>assessSentinelEvent(normalizeSecurityEvent({tenantId:"test",source:"wazuh",receivedAt:"2026-10-11T19:00:00Z",payload}));
    expect(mk({id:"a"}).severity).toBe("unknown");
    expect(mk({id:"b",rule:{level:null}}).severity).toBe("unknown");
    expect(mk({id:"c",rule:{level:3}}).requiresHumanReview).toBe(false);
    expect(mk({id:"d",rule:{level:13}}).requiresHumanReview).toBe(true);
  });
});
