import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/api/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:NextRequest) {
  const gate=await requirePlatformOwner();
  if(!gate.ok) return gate.response;
  const tenantId=request.nextUrl.searchParams.get("tenantId")?.trim() ?? "";
  if(tenantId && !/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)){
    return NextResponse.json({error:"Invalid organization"},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  try {
    const events=await db.sentinelSecurityEvent.findMany({
      where:tenantId?{tenantId}:{},
      select:{id:true,tenantId:true,source:true,sourceEventId:true,severity:true,title:true,description:true,occurredAt:true,receivedAt:true,state:true,requiresReview:true},
      take:100,orderBy:{receivedAt:"desc"},
    });
    return NextResponse.json({status:"connected",events,limit:100},{
      headers:{"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}
    });
  } catch {
    return NextResponse.json({status:"not_connected",events:[],error:"Sentinel incident storage unavailable"},{
      status:503,headers:{"Cache-Control":"no-store"}
    });
  }
}
