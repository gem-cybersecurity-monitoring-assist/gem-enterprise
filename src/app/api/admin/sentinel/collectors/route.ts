import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSentinelDb, resolveSentinelStorageConfig } from "@/lib/security-operations/sentinel-store";
import { requirePlatformOwner } from "@/lib/api/auth-helpers";
import { COLLECTOR_SOURCES, generateCollectorCredential } from "@/lib/security-operations/collector-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(data: unknown, status = 200) {
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});
}
const createSchema = z.object({
  tenantId:z.string().regex(/^[A-Za-z0-9_-]{3,128}$/),
  source:z.enum(COLLECTOR_SOURCES),
  label:z.string().trim().min(3).max(100),
  consentReference:z.string().trim().min(12).max(160),
}).strict();
const updateSchema = z.discriminatedUnion("action",[
  z.object({action:z.literal("activate"),id:z.string().uuid(),consentReference:z.string().min(12).max(160),consentConfirmed:z.literal(true)}).strict(),
  z.object({action:z.literal("revoke"),id:z.string().uuid()}).strict(),
]);
export async function GET() {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;
  try {
    const records = await getSentinelDb().sentinelCollector.findMany({
      select:{id:true,tenantId:true,source:true,label:true,consentReference:true,consentVerifiedAt:true,enabled:true,revokedAt:true,expiresAt:true,createdAt:true},
      orderBy:{createdAt:"desc"},take:100,
    });
    return response({collectors:records});
  } catch {
    return response({error:"Sentinel database is not provisioned"},503);
  }
}
export async function POST(request:NextRequest) {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;
  let body:z.infer<typeof createSchema>;
  try { body = createSchema.parse(await request.json()); }
  catch { return response({error:"Invalid collector registration"},400); }
  try {
    const securityDb=getSentinelDb();
    const dedicated=resolveSentinelStorageConfig().mode==="dedicated";
    // The standalone Sentinel database keeps its own explicitly approved organization registry.
    // In shared mode, retain GEM's pre-existing active member verification.
    if(dedicated) {
      const tenant=await securityDb.sentinelTenant.findUnique({where:{id:body.tenantId}});
      if(!tenant?.enabled || tenant.consentReference!==body.consentReference) {
        return response({error:"Organization requires recorded owner approval and matching consent"},409);
      }
    } else {
      const tenant=await db.user.findFirst({where:{organizationId:body.tenantId,isActive:true},select:{id:true}});
      if(!tenant)return response({error:"Organization does not have an active GEM member"},409);
    }
    const credential = generateCollectorCredential();
    const expiry = new Date(Date.now()+90*24*60*60*1000);
    await securityDb.$transaction(async tx=>{
      await tx.sentinelCollector.create({
        data:{
          id:credential.id,tenantId:body.tenantId,source:body.source,label:body.label,
          keyHash:credential.keyHash,consentReference:body.consentReference,
          enabled:false,expiresAt:expiry,
        },
      });
      if(dedicated) {
        await tx.sentinelOperationAudit.create({data:{
          tenantId:body.tenantId,collectorId:credential.id,actorId:gate.session.userId,
          action:"collector_registration",detail:{source:body.source,enabled:false},
        }});
      } else {
        await tx.auditLog.create({data:{userId:gate.session.userId,action:"admin_action",resource:"sentinel_collector_registration",resourceId:credential.id,metadata:{tenantId:body.tenantId,source:body.source,enabled:false}}});
      }
    });
    // Return key only once, to the authenticated owner; never persist or log it.
    return response({id:credential.id,collectorKey:credential.key,enabled:false,expiresAt:expiry.toISOString(),message:"Store the key securely. Collector remains disabled until verified consent activation."},201);
  } catch {
    return response({error:"Collector registration unavailable"},503);
  }
}
export async function PATCH(request:NextRequest) {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;
  let body:z.infer<typeof updateSchema>;
  try { body = updateSchema.parse(await request.json()); }
  catch { return response({error:"Invalid collector action"},400); }
  try {
    const securityDb=getSentinelDb();
    const dedicated=resolveSentinelStorageConfig().mode==="dedicated";
    const record=await securityDb.sentinelCollector.findUnique({where:{id:body.id}});
    if(!record) return response({error:"Collector not found"},404);
    if(body.action==="activate" && (record.revokedAt || record.expiresAt<=new Date() || record.consentReference!==body.consentReference)) {
      return response({error:"Collector cannot be activated without matching active consent"},409);
    }
    await securityDb.$transaction(async tx=>{
      await tx.sentinelCollector.update({
        where:{id:record.id},
        data:body.action==="revoke"
          ? {enabled:false,revokedAt:new Date()}
          : {enabled:true,consentVerifiedAt:new Date()},
      });
      if(dedicated) {
        await tx.sentinelOperationAudit.create({data:{
          tenantId:record.tenantId,collectorId:record.id,actorId:gate.session.userId,
          action:body.action==="revoke"?"collector_revoked":"collector_activated",
          detail:{source:record.source},
        }});
      } else {
        await tx.auditLog.create({data:{
          userId:gate.session.userId,action:"admin_action",
          resource:body.action==="revoke"?"sentinel_collector_revoked":"sentinel_collector_activated",
          resourceId:record.id,metadata:{tenantId:record.tenantId,source:record.source},
        }});
      }
    });
    return response({id:record.id,action:body.action,success:true});
  } catch {
    return response({error:"Collector action unavailable"},503);
  }
}
