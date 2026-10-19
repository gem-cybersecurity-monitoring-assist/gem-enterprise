import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, requireSession } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { db } from "@/lib/db";
import { isSameOriginWorkspaceRequest, OrganizationWorkspaceError, requireWorkspacePermission } from "@/lib/organizationWorkspace";
import { getGatewaySessionToken } from "@/lib/auth";
import { GatewayRequestError, workspaceGateway } from "@/lib/supabase-gateway";

const createSchema = z.object({ workspaceId:z.string().min(1).max(128), projectId:z.string().min(1).max(128).optional().nullable(), weekEnding:z.string().date(), accomplishments:z.string().trim().min(10).max(5000), inProgress:z.string().trim().min(10).max(5000), blockers:z.string().trim().max(5000).optional().nullable(), decisionsNeeded:z.string().trim().max(5000).optional().nullable(), nextPriorities:z.string().trim().min(10).max(5000), submit:z.boolean().default(false) }).strict();
const reviewSchema = z.object({ updateId:z.string().min(1).max(128), workspaceId:z.string().min(1).max(128), decision:z.enum(["APPROVED","RETURNED"]), reviewNote:z.string().trim().min(3).max(2000) }).strict();

function failure(error: unknown) {
  if(error instanceof GatewayRequestError)return NextResponse.json({error:error.message,code:error.code},{status:error.statusCode});
  if (error instanceof OrganizationWorkspaceError) return NextResponse.json({error:error.message,code:error.code},{status:error.statusCode});
  console.error("[weekly-updates] failed",error); return NextResponse.json({error:"Weekly update operation failed"},{status:500});
}
function writeGate(request:NextRequest,userId:string){if(!isSameOriginWorkspaceRequest(request.headers.get("origin"),request.nextUrl.origin))return NextResponse.json({error:"A same-origin request is required.",code:"SAME_ORIGIN_REQUIRED"},{status:403});const {ipAddress}=getRequestContext(request);const limit=rateLimit(`${userId}:${ipAddress}`,{key:"workspace:weekly-updates",windowMs:60_000,max:20});return limit.ok?null:rateLimitedResponse(limit.retryAfterSeconds)}
export async function POST(request:NextRequest){
  const gate=await requireSession(); if(!gate.ok)return gate.response;
  const blocked=writeGate(request,gate.session.userId);if(blocked)return blocked;
  const parsed=createSchema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:"Validation failed",details:parsed.error.flatten()},{status:400});
  try{
    if(gate.session.authSource==="supabase_gateway"){const token=await getGatewaySessionToken();if(!token)return NextResponse.json({error:"Gateway session required"},{status:401});return NextResponse.json(await workspaceGateway("create_update",token,parsed.data),{status:201})}
    await requireWorkspacePermission(gate.session.userId,parsed.data.workspaceId,"manage","weekly_updates");
    if(parsed.data.projectId){const project=await db.organizationProject.findFirst({where:{id:parsed.data.projectId,workspaceId:parsed.data.workspaceId}});if(!project)throw new OrganizationWorkspaceError("Project is not in this workspace.",400,"PROJECT_SCOPE_MISMATCH");}
    const update=await db.workspaceWeeklyUpdate.create({data:{workspaceId:parsed.data.workspaceId,projectId:parsed.data.projectId||null,authorUserId:gate.session.userId,weekEnding:new Date(`${parsed.data.weekEnding}T00:00:00.000Z`),accomplishments:parsed.data.accomplishments,inProgress:parsed.data.inProgress,blockers:parsed.data.blockers||null,decisionsNeeded:parsed.data.decisionsNeeded||null,nextPriorities:parsed.data.nextPriorities,status:parsed.data.submit?"SUBMITTED":"DRAFT",submittedAt:parsed.data.submit?new Date():null}});
    const ctx=getRequestContext(request);await db.auditLog.create({data:{userId:gate.session.userId,action:"admin_action",resource:"workspace_weekly_update",resourceId:update.id,metadata:{operation:parsed.data.submit?"weekly_update_submitted":"weekly_update_drafted",workspaceId:update.workspaceId},...ctx}});
    return NextResponse.json({update},{status:201});
  }catch(error){return failure(error)}
}
export async function PATCH(request:NextRequest){
  const gate=await requireSession();if(!gate.ok)return gate.response;
  const blocked=writeGate(request,gate.session.userId);if(blocked)return blocked;
  const parsed=reviewSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Validation failed",details:parsed.error.flatten()},{status:400});
  try{
    if(gate.session.authSource==="supabase_gateway"){const token=await getGatewaySessionToken();if(!token)return NextResponse.json({error:"Gateway session required"},{status:401});return NextResponse.json(await workspaceGateway("review_update",token,parsed.data))}
    await requireWorkspacePermission(gate.session.userId,parsed.data.workspaceId,"manage","weekly_updates");
    const current=await db.workspaceWeeklyUpdate.findFirst({where:{id:parsed.data.updateId,workspaceId:parsed.data.workspaceId,status:"SUBMITTED"}});if(!current)throw new OrganizationWorkspaceError("Submitted update not found in this workspace.",404,"UPDATE_NOT_REVIEWABLE");
    if(current.authorUserId===gate.session.userId)throw new OrganizationWorkspaceError("Authors cannot approve their own weekly update.",403,"SEPARATION_OF_DUTIES_REQUIRED");
    const update=await db.workspaceWeeklyUpdate.update({where:{id:current.id},data:{status:parsed.data.decision,reviewedById:gate.session.userId,reviewedAt:new Date(),reviewNote:parsed.data.reviewNote}});
    const ctx=getRequestContext(request);await db.auditLog.create({data:{userId:gate.session.userId,action:"admin_action",resource:"workspace_weekly_update",resourceId:update.id,metadata:{operation:"weekly_update_reviewed",workspaceId:update.workspaceId,decision:update.status},...ctx}});
    return NextResponse.json({update});
  }catch(error){return failure(error)}
}
