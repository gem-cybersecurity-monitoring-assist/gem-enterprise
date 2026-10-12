import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformOwner } from "@/lib/api/auth-helpers";
import { getSentinelDb, resolveSentinelStorageConfig } from "@/lib/security-operations/sentinel-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const create = z.object({
  tenantId: z.string().regex(/^[A-Za-z0-9_-]{3,128}$/),
  name: z.string().trim().min(3).max(100),
  consentReference: z.string().trim().min(12).max(160),
}).strict();
const activate = z.discriminatedUnion("action", [
  z.object({action:z.literal("approve"),tenantId:z.string(),consentReference:z.string(),consentConfirmed:z.literal(true)}).strict(),
  z.object({action:z.literal("disable"),tenantId:z.string()}).strict(),
]);
function reply(payload:unknown,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"no-store"}});}
export async function GET(){
  const gate=await requirePlatformOwner();
  if(!gate.ok)return gate.response;
  try {
    if(resolveSentinelStorageConfig().mode!=="dedicated")return reply({tenants:[],status:"shared_mode"});
    const tenants=await getSentinelDb().sentinelTenant.findMany({
      take:100,orderBy:{createdAt:"desc"},
      select:{id:true,name:true,consentReference:true,enabled:true,consentVerifiedAt:true,createdAt:true},
    });
    return reply({status:"dedicated",tenants});
  }catch{return reply({error:"Sentinel tenant registry unavailable"},503);}
}
export async function POST(request:NextRequest){
  const gate=await requirePlatformOwner();
  if(!gate.ok)return gate.response;
  if(resolveSentinelStorageConfig().mode!=="dedicated")return reply({error:"Tenant provisioning is available in dedicated mode only"},409);
  let body:z.infer<typeof create>;
  try{body=create.parse(await request.json());}catch{return reply({error:"Invalid organization registration"},400);}
  try {
    const store=getSentinelDb();
    await store.$transaction(async tx=>{
      await tx.sentinelTenant.create({data:{
        id:body.tenantId,name:body.name,consentReference:body.consentReference,
        consentVerifiedAt:null,registeredBy:gate.session.userId,enabled:false,
      }});
      await tx.sentinelOperationAudit.create({data:{
        tenantId:body.tenantId,actorId:gate.session.userId,action:"tenant_registration",
        detail:{enabled:false,consentReference:body.consentReference},
      }});
    });
    return reply({id:body.tenantId,enabled:false,message:"Organization registered but disabled until owner approval."},201);
  }catch{return reply({error:"Organization registration failed or already exists"},409);}
}
export async function PATCH(request:NextRequest){
  const gate=await requirePlatformOwner();
  if(!gate.ok)return gate.response;
  if(resolveSentinelStorageConfig().mode!=="dedicated")return reply({error:"Dedicated mode required"},409);
  let body:z.infer<typeof activate>;
  try{body=activate.parse(await request.json());}catch{return reply({error:"Invalid action"},400);}
  try {
    const store=getSentinelDb();
    const tenant=await store.sentinelTenant.findUnique({where:{id:body.tenantId}});
    if(!tenant)return reply({error:"Organization not found"},404);
    if(body.action==="approve" && tenant.consentReference!==body.consentReference)return reply({error:"Consent reference mismatch"},409);
    await store.$transaction(async tx=>{
      await tx.sentinelTenant.update({where:{id:tenant.id},data:{enabled:body.action==="approve",...(body.action==="approve"?{consentVerifiedAt:new Date()}:{})}});
      await tx.sentinelOperationAudit.create({data:{tenantId:tenant.id,actorId:gate.session.userId,action:body.action==="approve"?"tenant_approved":"tenant_disabled"}});
      if(body.action==="disable")await tx.sentinelCollector.updateMany({where:{tenantId:tenant.id},data:{enabled:false,revokedAt:new Date()}});
    });
    return reply({id:tenant.id,enabled:body.action==="approve",success:true});
  }catch{return reply({error:"Organization action unavailable"},503);}
}
