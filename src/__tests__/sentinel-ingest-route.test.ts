import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { generateCollectorCredential } from "../lib/security-operations/collector-auth";

const mocks = vi.hoisted(() => ({
  collector: { findUnique: vi.fn() },
  nonce: { count: vi.fn(), create: vi.fn() },
  event: { findUnique: vi.fn(), create: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {
  sentinelCollector: mocks.collector, sentinelNonce: mocks.nonce,
  $transaction: mocks.transaction,
}}));
import { POST } from "../app/api/security/sentinel/ingest/route";

describe("Sentinel ingestion route security boundaries", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  const credential = generateCollectorCredential();
  const ready = { ...credential, tenantId: "authorized_tenant", source: "wazuh", enabled: true,
    consentVerifiedAt: now, revokedAt: null, expiresAt: new Date("2026-10-13T00:00:00Z") };
  function request(payload: unknown = {id:"event-1",rule:{level:13,description:"Lab alert"}},
    headers: Record<string,string> = {}) {
    return new NextRequest("https://gem.example/api/security/sentinel/ingest", {
      method:"POST", body: typeof payload === "string" ? payload : JSON.stringify(payload),
      headers: {"x-gem-sentinel-key":credential.key,"x-gem-sentinel-timestamp":now.toISOString(),
        "x-gem-sentinel-nonce":"unique_nonce_1234567890","content-type":"application/json",...headers},
    });
  }
  beforeEach(()=>{
    vi.useFakeTimers();vi.setSystemTime(now);vi.clearAllMocks();
    mocks.collector.findUnique.mockResolvedValue(ready);
    mocks.nonce.count.mockResolvedValue(0);mocks.nonce.create.mockResolvedValue({});
    mocks.event.findUnique.mockResolvedValue(null);mocks.event.create.mockResolvedValue({id:"incident-1"});
    mocks.transaction.mockImplementation(async fn=>fn({
      sentinelNonce:mocks.nonce,sentinelSecurityEvent:mocks.event,
    }));
    vi.spyOn(console,"error").mockImplementation(()=>{});
  });
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
  it("rejects malformed credentials before database access",async()=>{
    expect((await POST(request(undefined,{"x-gem-sentinel-key":"invalid"}))).status).toBe(401);
    expect(mocks.collector.findUnique).not.toHaveBeenCalled();
  });
  it("rejects stale request timestamps before storage",async()=>{
    expect((await POST(request(undefined,{"x-gem-sentinel-timestamp":"2026-10-11T23:54:00Z"}))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects invalid nonces",async()=>{
    expect((await POST(request(undefined,{"x-gem-sentinel-nonce":"short"}))).status).toBe(400);
  });
  it("rejects oversized streaming payloads without content-length",async()=>{
    expect((await POST(request("a".repeat(16385)))).status).toBe(413);
    expect(mocks.collector.findUnique).not.toHaveBeenCalled();
  });
  it("rejects declared oversized payloads",async()=>{
    expect((await POST(request(undefined,{"content-length":"16385"}))).status).toBe(413);
  });
  it("rejects malformed JSON",async()=>{
    expect((await POST(request("{"))).status).toBe(400);
  });
  it("requires source event identity",async()=>{
    expect((await POST(request({rule:{level:10}}))).status).toBe(400);
  });
  it("rejects unknown collectors",async()=>{
    mocks.collector.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
  });
  it("rejects a validly shaped key with a different stored hash",async()=>{
    mocks.collector.findUnique.mockResolvedValue({...ready,keyHash:generateCollectorCredential().keyHash});
    expect((await POST(request())).status).toBe(401);
  });
  it.each([
    {enabled:false},{consentVerifiedAt:null},{revokedAt:now},{expiresAt:now},
  ])("rejects collectors without active consent and authority: %j",async(patch)=>{
    mocks.collector.findUnique.mockResolvedValue({...ready,...patch});
    expect((await POST(request())).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rate limits before writes",async()=>{
    mocks.nonce.count.mockResolvedValue(60);
    expect((await POST(request())).status).toBe(429);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("persists only server-authorized tenant scope and summarized metadata",async()=>{
    const r=await POST(request({id:"event-1",tenantId:"attacker_tenant",
      rule:{level:13,description:"Lab alert"},raw_log:"private raw log"}));
    expect(r.status).toBe(202);expect(await r.json()).toMatchObject({accepted:true,duplicate:false});
    expect(mocks.event.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where:{tenantId_source_sourceEventId:{tenantId:"authorized_tenant",source:"wazuh",sourceEventId:"event-1"}},
    }));
    const data=mocks.event.create.mock.calls[0][0].data;
    expect(data).toMatchObject({tenantId:"authorized_tenant",severity:"critical",requiresReview:true});
    expect(data).not.toHaveProperty("raw_log");
    expect(JSON.stringify(data)).not.toContain(credential.key);
  });
  it("deduplicates existing tenant event with a fresh nonce",async()=>{
    mocks.event.findUnique.mockResolvedValue({id:"existing"});
    const r=await POST(request());expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({id:"existing",duplicate:true});
    expect(mocks.nonce.create).toHaveBeenCalled();expect(mocks.event.create).not.toHaveBeenCalled();
  });
  it("rejects database-enforced nonce replay",async()=>{
    mocks.nonce.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Replay",{
      code:"P2002",clientVersion:"5.22.0",
    }));
    expect((await POST(request())).status).toBe(409);
    expect(mocks.event.create).not.toHaveBeenCalled();
  });
  it("fails closed on database outage without returning storage details",async()=>{
    mocks.collector.findUnique.mockRejectedValue(new Error("sensitive database connection detail"));
    const r=await POST(request());expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("sensitive");
  });
});
