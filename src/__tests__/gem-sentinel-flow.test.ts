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
  it("keeps low-priority cases in manual triage without containment", () => {
    const item=assessSentinelEvent(normalizeSecurityEvent({tenantId:"test",source:"osquery",receivedAt:"2026-10-11T19:00:00Z",payload:{id:"evt1"}}));
    expect(item.requiresHumanReview).toBe(false);
    expect(item.state).toBe("triage_pending");
  });
});
