import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSentinelDb } from "@/lib/security-operations/sentinel-store";
import { collectorIdFromCredential, credentialMatches, isCollectorReady } from "@/lib/security-operations/collector-auth";
import { evaluateIncomingSecurityAlert } from "@/lib/security-operations/ingestion-contract";
import { normalizeSecurityEvent } from "@/lib/security-operations/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 16 * 1024;
const WINDOW_MS = 5 * 60 * 1000;
const PER_MINUTE = 60;
const alertSchema = z.object({
  id: z.union([z.string().min(1).max(128), z.number().finite()]).optional(),
  event_id: z.union([z.string().min(1).max(128), z.number().finite()]).optional(),
  uuid: z.string().min(1).max(128).optional(),
  rule: z.object({ level: z.number().min(0).max(100).optional(), description: z.string().max(300).optional() }).passthrough().optional(),
  alert: z.object({ severity: z.number().int().min(1).max(4).optional(), signature: z.string().max(300).optional() }).passthrough().optional(),
  timestamp: z.string().max(64).optional(),
  time: z.string().max(64).optional(),
  description: z.string().max(1000).optional(),
  title: z.string().max(200).optional(),
}).passthrough().refine((v) => v.id !== undefined || v.event_id !== undefined || !!v.uuid, "Event ID required");

function response(body: unknown, status: number) {
  return NextResponse.json(body, {status,headers:{"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
}
function isDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
export async function POST(request: NextRequest) {
  const key = request.headers.get("x-gem-sentinel-key") ?? "";
  const collectorId = collectorIdFromCredential(key);
  if (!collectorId) return response({error:"Collector authentication failed"},401);
  const stamp = request.headers.get("x-gem-sentinel-timestamp") ?? "";
  const stampMs = Date.parse(stamp);
  const nonce = request.headers.get("x-gem-sentinel-nonce") ?? "";
  if (!Number.isFinite(stampMs) || Math.abs(Date.now()-stampMs)>WINDOW_MS || !/^[A-Za-z0-9_-]{16,96}$/.test(nonce)) {
    return response({error:"Invalid request freshness"},400);
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declaredLength) || declaredLength>MAX_BYTES) return response({error:"Payload too large"},413);
  let payload: z.infer<typeof alertSchema>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return response({error:"Alert payload required"},400);
    const decoder = new TextDecoder("utf-8",{fatal:true});
    let data = "";
    let size = 0;
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return response({error:"Payload too large"},413);
      }
      data += decoder.decode(value,{stream:true});
    }
    data += decoder.decode();
    payload = alertSchema.parse(JSON.parse(data));
  } catch {
    return response({error:"Invalid alert payload"},400);
  }
  try {
    const securityDb = getSentinelDb();
    const collector = await securityDb.sentinelCollector.findUnique({where:{id:collectorId}});
    if (!collector || !credentialMatches(key,collector)) return response({error:"Collector authentication failed"},401);
    if (!isCollectorReady(collector)) return response({error:"Collector is not enabled or consent has expired"},403);
    const recent = await securityDb.sentinelNonce.count({
      where:{collectorId,createdAt:{gte:new Date(Date.now()-60000)}},
    });
    if (recent>=PER_MINUTE) return response({error:"Rate limit exceeded"},429);
    const now = new Date();
    const evaluation = evaluateIncomingSecurityAlert({
      tenantId:collector.tenantId,
      source:collector.source as "wazuh"|"suricata"|"osquery"|"prowler"|"trivy"|"gem",
      integrationId:collector.id.replaceAll("-","_"),
      authenticated:true,
      enabled:collector.enabled,
      tenantConsentVerified:!!collector.consentVerifiedAt,
      replayProtectionVerified:true,
    },payload,now.toISOString());
    if (!evaluation.accepted) return response({error:"Alert rejected",code:evaluation.code},400);
    const incident = evaluation.incident;
    const event = normalizeSecurityEvent({tenantId:collector.tenantId, source:collector.source as "wazuh"|"suricata"|"osquery"|"prowler"|"trivy"|"gem", payload, receivedAt:now.toISOString()});
    const result = await securityDb.$transaction(async(tx)=>{
      await tx.sentinelNonce.create({data:{collectorId,nonce}});
      const prior = await tx.sentinelSecurityEvent.findUnique({
        where:{tenantId_source_sourceEventId:{
          tenantId:collector.tenantId,source:collector.source,sourceEventId:incident.sourceEventId,
        }},
        select:{id:true},
      });
      if(prior) return {id:prior.id,duplicate:true};
      const item = await tx.sentinelSecurityEvent.create({
        data:{
          collectorId,tenantId:collector.tenantId,source:collector.source,
          sourceEventId:incident.sourceEventId,severity:incident.severity,
          title:event.title,description:event.description,
          occurredAt:new Date(event.occurredAt),receivedAt:now,
          requiresReview:incident.requiresHumanReview,
        },
        select:{id:true},
      });
      return {id:item.id,duplicate:false};
    });
    return response({accepted:true,...result,state:"triage_pending"},result.duplicate?200:202);
  } catch (error) {
    if(isDuplicate(error)) return response({error:"Duplicate request or concurrent event; retry with a new nonce"},409);
    console.error("[sentinel-ingest] storage unavailable",error instanceof Error?error.name:"unknown");
    return response({error:"Security ingestion unavailable"},503);
  }
}
