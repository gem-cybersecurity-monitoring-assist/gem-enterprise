import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, requireSession } from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import { db } from "@/lib/db";
import { isSameOriginWorkspaceRequest, OrganizationWorkspaceError, requireWorkspacePermission } from "@/lib/organizationWorkspace";
import { getGatewaySessionToken } from "@/lib/auth";
import { GatewayRequestError, workspaceGateway } from "@/lib/supabase-gateway";

const schema=z.object({workspaceId:z.string().min(1).max(128),email:z.string().trim().email().max(254),confirmEmail:z.string().trim().email().max(254),roleId:z.string().min(1).max(128),reason:z.string().trim().min(12).max(500)}).strict().refine(v=>v.email.toLowerCase()===v.confirmEmail.toLowerCase(),{path:["confirmEmail"],message:"Email confirmation does not match."});
export async function POST(request:NextRequest){
  const gate=await requireSession();if(!gate.ok)return gate.response;
  if(!isSameOriginWorkspaceRequest(request.headers.get("origin"),request.nextUrl.origin))return NextResponse.json({error:"A same-origin request is required.",code:"SAME_ORIGIN_REQUIRED"},{status:403});
  const context=getRequestContext(request);const limit=rateLimit(`${gate.session.userId}:${context.ipAddress}`,{key:"workspace:members",windowMs:60_000,max:10});if(!limit.ok)return rateLimitedResponse(limit.retryAfterSeconds);
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Validation failed",details:parsed.error.flatten()},{status:400});
  try{
    if(gate.session.authSource==="supabase_gateway"){const token=await getGatewaySessionToken();if(!token)return NextResponse.json({error:"Gateway session required"},{status:401});return NextResponse.json(await workspaceGateway("add_member",token,parsed.data),{status:201})}
    await requireWorkspacePermission(gate.session.userId,parsed.data.workspaceId,"manage","members");
    const [user,role,existing]=await Promise.all([db.user.findUnique({where:{email:parsed.data.email.toLowerCase()},select:{id:true,email:true,role:true,status:true,isActive:true}}),db.role.findUnique({where:{id:parsed.data.roleId},select:{id:true,workspaceId:true,name:true}}),db.workspaceMember.findFirst({where:{workspaceId:parsed.data.workspaceId,user:{email:parsed.data.email.toLowerCase()}}})]);
    if(!user||!user.isActive||user.status!=="active")throw new OrganizationWorkspaceError("Existing active member not found.",404,"MEMBER_ACCOUNT_NOT_FOUND");
    if(user.role!=="client")throw new OrganizationWorkspaceError("Only client accounts can be assigned by an organization owner.",400,"MEMBER_PLATFORM_ROLE_INVALID");
    if(!role||role.workspaceId!==parsed.data.workspaceId)throw new OrganizationWorkspaceError("Role does not belong to this workspace.",400,"ROLE_SCOPE_MISMATCH");
    if(existing)throw new OrganizationWorkspaceError("Member already belongs to this workspace.",409,"MEMBERSHIP_EXISTS");
    const membership=await db.workspaceMember.create({data:{workspaceId:parsed.data.workspaceId,userId:user.id,roleId:role.id,status:"active"}});
    await db.auditLog.create({data:{userId:gate.session.userId,action:"admin_action",resource:"workspace_membership",resourceId:membership.id,metadata:{operation:"organization_member_assigned",workspaceId:parsed.data.workspaceId,targetUserId:user.id,targetEmail:user.email,workspaceRole:role.name,targetPlatformRole:user.role,reason:parsed.data.reason},...context}});
    return NextResponse.json({membership},{status:201});
  }catch(error){if(error instanceof GatewayRequestError)return NextResponse.json({error:error.message,code:error.code},{status:error.statusCode});if(error instanceof OrganizationWorkspaceError)return NextResponse.json({error:error.message,code:error.code},{status:error.statusCode});console.error("[workspace-members] failed",error);return NextResponse.json({error:"Member assignment failed"},{status:500})}
}
