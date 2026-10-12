import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { collectorStatus } from "../lib/security-operations/collector-status";
const mocks = vi.hoisted(()=>({
  gate:vi.fn(),members:vi.fn(),member:vi.fn(),list:vi.fn(),get:vi.fn(),
  create:vi.fn(),update:vi.fn(),audit:vi.fn(),transaction:vi.fn(),
}));
vi.mock("@/lib/api/auth-helpers",()=>({requirePlatformOwner:mocks.gate}));
vi.mock("@/lib/db",()=>({db:{
  user:{findMany:mocks.members,findFirst:mocks.member},
  sentinelCollector:{findMany:mocks.list,findUnique:mocks.get},
  $transaction:mocks.transaction,
}}));
import { GET, POST, PATCH } from "../app/api/admin/sentinel/collectors/route";

describe("Sentinel registry authorization and consent",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  const record={id,tenantId:"tenant_a",source:"wazuh",enabled:false,revokedAt:null,
    consentReference:"signed-consent-reference",expiresAt:new Date("2099-01-01T00:00:00Z")};
  function request(method:string,body:unknown){return new NextRequest("https://gem.example/api/admin/sentinel/collectors",{method,body:JSON.stringify(body),headers:{"Content-Type":"application/json"}});}
  beforeEach(()=>{
    vi.clearAllMocks();mocks.gate.mockResolvedValue({ok:true,session:{userId:"owner"}});
    mocks.members.mockResolvedValue([{organizationId:"tenant_a"}]);mocks.member.mockResolvedValue({id:"member"});
    mocks.list.mockResolvedValue([]);mocks.get.mockResolvedValue(record);
    mocks.transaction.mockImplementation(async fn=>fn({sentinelCollector:{create:mocks.create,update:mocks.update},auditLog:{create:mocks.audit}}));
  });
  it("rejects non-owner reads and writes before database access",async()=>{
    mocks.gate.mockResolvedValue({ok:false,response:NextResponse.json({error:"Forbidden"},{status:403})});
    expect((await GET()).status).toBe(403);
    expect((await POST(request("POST",{}))).status).toBe(403);
    expect((await PATCH(request("PATCH",{}))).status).toBe(403);
    expect(mocks.members).not.toHaveBeenCalled();expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("lists only active organization identifiers without member personal data",async()=>{
    const response=await GET();expect(response.status).toBe(200);
    expect(await response.json()).toEqual({collectors:[],organizations:["tenant_a"]});
    expect(mocks.members).toHaveBeenCalledWith(expect.objectContaining({
      where:{organizationId:{not:null},isActive:true},select:{organizationId:true},distinct:["organizationId"],
    }));
    expect(mocks.list.mock.calls[0][0].select).not.toHaveProperty("keyHash");
  });
  it("does not report an enabled readiness status without valid consent",async()=>{
    mocks.list.mockResolvedValue([{...record,enabled:true,consentVerifiedAt:null}]);
    const body=await (await GET()).json();
    expect(body.collectors[0].readinessStatus).toBe("disabled");
  });
  it("fails closed on invalid collector expiry in the registry response",async()=>{
    mocks.list.mockResolvedValue([{...record,enabled:true,consentVerifiedAt:new Date(),expiresAt:new Date("invalid")}]);
    const body=await (await GET()).json();
    expect(body.collectors[0].readinessStatus).toBe("expired");
  });
  it("fails closed when the organization registry is unavailable",async()=>{
    mocks.members.mockRejectedValue(new Error("storage"));
    expect((await GET()).status).toBe(503);
  });
  it("will not register an unknown organization",async()=>{
    mocks.member.mockResolvedValue(null);
    const response=await POST(request("POST",{tenantId:"tenant_a",source:"wazuh",label:"Office lab",consentReference:"signed-consent-reference"}));
    expect(response.status).toBe(409);expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("registers disabled and stores only a hash plus audit evidence",async()=>{
    const response=await POST(request("POST",{tenantId:"tenant_a",source:"wazuh",label:"Office lab",consentReference:"signed-consent-reference"}));
    expect(response.status).toBe(201);const body=await response.json();
    const saved=mocks.create.mock.calls[0][0].data;
    expect(saved.enabled).toBe(false);expect(saved.keyHash).not.toContain(body.collectorKey);
    expect(saved).not.toHaveProperty("collectorKey");expect(mocks.audit).toHaveBeenCalled();
  });
  it("rejects activation without explicit consent confirmation",async()=>{
    const response=await PATCH(request("PATCH",{action:"activate",id,consentReference:"signed-consent-reference"}));
    expect(response.status).toBe(400);expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects activation with a different consent reference",async()=>{
    const response=await PATCH(request("PATCH",{action:"activate",id,consentReference:"wrong-consent-reference",consentConfirmed:true}));
    expect(response.status).toBe(409);expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects activation of revoked or expired collectors",async()=>{
    for(const patch of [{revokedAt:new Date()},{expiresAt:new Date("2000-01-01")}]) {
      mocks.get.mockResolvedValue({...record,...patch});
      expect((await PATCH(request("PATCH",{action:"activate",id,consentReference:record.consentReference,consentConfirmed:true}))).status).toBe(409);
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("activates with matching verified consent and records audit evidence",async()=>{
    expect((await PATCH(request("PATCH",{action:"activate",id,consentReference:record.consentReference,consentConfirmed:true}))).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).toEqual({enabled:true,consentVerifiedAt:expect.any(Date)});
    expect(mocks.audit.mock.calls[0][0].data.resource).toBe("sentinel_collector_activated");
  });
  it("revokes the credential with audit evidence",async()=>{
    expect((await PATCH(request("PATCH",{action:"revoke",id}))).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).toEqual({enabled:false,revokedAt:expect.any(Date)});
    expect(mocks.audit.mock.calls[0][0].data.resource).toBe("sentinel_collector_revoked");
  });
});
describe("Sentinel displayed collector readiness",()=>{
  const now=Date.parse("2026-10-12T00:00:00Z");
  const collector={enabled:true,consentVerifiedAt:"2026-10-11T00:00:00Z",revokedAt:null,expiresAt:"2026-10-13T00:00:00Z"};
  it("requires valid consent for an enabled badge",()=>{
    expect(collectorStatus(collector,now)).toBe("enabled");
    expect(collectorStatus({...collector,consentVerifiedAt:null},now)).toBe("disabled");
    expect(collectorStatus({...collector,consentVerifiedAt:"invalid"},now)).toBe("disabled");
  });
  it("never displays malformed expiry as enabled",()=>{
    expect(collectorStatus({...collector,expiresAt:"invalid"},now)).toBe("expired");
    expect(collectorStatus({...collector,expiresAt:"2026-10-12T00:00:00Z"},now)).toBe("expired");
  });
  it("shows revocation even if enabled is incorrectly still set",()=>{
    expect(collectorStatus({...collector,revokedAt:"2026-10-12T00:00:00Z"},now)).toBe("revoked");
  });
});
