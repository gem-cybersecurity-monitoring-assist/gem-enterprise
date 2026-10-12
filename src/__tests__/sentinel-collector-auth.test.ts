import { describe, expect, it } from "vitest";
import {
  collectorIdFromCredential,
  credentialMatches,
  generateCollectorCredential,
  hashCollectorCredential,
  isCollectorReady,
} from "../lib/security-operations/collector-auth";

describe("GEM Sentinel collector credentials",()=>{
  it("creates unique, non-recoverable stored key hashes",()=>{
    const a=generateCollectorCredential();
    const b=generateCollectorCredential();
    expect(a.key).not.toBe(b.key);
    expect(a.keyHash).not.toContain(a.key);
    expect(hashCollectorCredential(a.key)).toBe(a.keyHash);
    expect(collectorIdFromCredential(a.key)).toBe(a.id);
    expect(credentialMatches(a.key,{keyHash:a.keyHash})).toBe(true);
    expect(credentialMatches(b.key,{keyHash:a.keyHash})).toBe(false);
    expect(credentialMatches(a.key,{keyHash:"bad"})).toBe(false);
  });
  it("rejects malformed collector keys",()=>{
    expect(collectorIdFromCredential("")).toBeNull();
    expect(collectorIdFromCredential("snt_fake")).toBeNull();
    expect(collectorIdFromCredential("Bearer secret")).toBeNull();
  });
  it("requires enabled consented, unexpired and unrevoked collectors",()=>{
    const now=new Date("2026-10-11T21:00:00Z");
    const ready={enabled:true,consentVerifiedAt:now,revokedAt:null,expiresAt:new Date("2026-10-12T21:00:00Z")};
    expect(isCollectorReady(ready,now)).toBe(true);
    expect(isCollectorReady({...ready,enabled:false},now)).toBe(false);
    expect(isCollectorReady({...ready,consentVerifiedAt:null},now)).toBe(false);
    expect(isCollectorReady({...ready,revokedAt:now},now)).toBe(false);
    expect(isCollectorReady({...ready,expiresAt:now},now)).toBe(false);
  });
});
