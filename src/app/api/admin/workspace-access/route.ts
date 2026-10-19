import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getRequestContext,
  requirePlatformOwner,
} from "@/lib/api/auth-helpers";
import { rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  assignWorkspaceMembership,
  createWorkspaceRole,
  getWorkspaceAdministrationSnapshot,
  updateWorkspaceMembership,
  WorkspaceAdministrationError,
} from "@/lib/workspaceAccessAdministration";
import { provisionOrganizationWorkspace } from "@/lib/organizationWorkspace";
import { getGatewaySessionToken } from "@/lib/auth";
import { GatewayRequestError, workspaceGateway } from "@/lib/supabase-gateway";

export const dynamic = "force-dynamic";

const identifier = z.string().trim().min(1).max(128);
const reason = z.string().trim().min(12).max(500);
const confirmation = z.string().trim().min(1).max(254);

const permissionSchema = z
  .object({
    action: z.string().trim().min(1).max(32),
    scope: z.string().trim().min(1).max(32),
  })
  .strict();

const createRoleSchema = z
  .object({
    operation: z.literal("create_role"),
    workspaceId: identifier,
    confirmWorkspaceSlug: confirmation,
    name: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9 _-]*$/,
        "Use letters, numbers, spaces, hyphens, or underscores.",
      ),
    description: z.string().trim().max(300).optional().nullable(),
    permissions: z.array(permissionSchema).min(1).max(11),
    reason,
  })
  .strict();

const assignMembershipSchema = z
  .object({
    operation: z.literal("assign_membership"),
    workspaceId: identifier,
    confirmWorkspaceSlug: confirmation,
    userId: identifier,
    confirmEmail: z.string().trim().email().max(254),
    roleId: identifier,
    reason,
  })
  .strict();

const provisionOrganizationSchema = z.object({
  operation: z.literal("provision_organization"),
  organizationName: z.string().trim().min(2).max(120),
  workspaceName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().max(254),
  confirmOwnerEmail: z.string().trim().email().max(254),
  projectName: z.string().trim().min(2).max(120).optional().nullable(),
  projectSummary: z.string().trim().min(10).max(2000).optional().nullable(),
  reason,
}).strict().refine((value) => value.ownerEmail.toLowerCase() === value.confirmOwnerEmail.toLowerCase(), { path: ["confirmOwnerEmail"], message: "Owner email confirmation does not match." });

const postSchema = z.union([
  createRoleSchema,
  assignMembershipSchema,
  provisionOrganizationSchema,
]);

const patchSchema = z
  .object({
    membershipId: identifier,
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    confirmEmail: z.string().trim().email().max(254),
    roleId: identifier.optional(),
    status: z.enum(["active", "suspended"]).optional(),
    reason,
  })
  .strict()
  .refine((value) => value.roleId !== undefined || value.status !== undefined, {
    message: "Provide a role or status change.",
  });

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function sameOriginFailure(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    if (new URL(origin).origin !== request.nextUrl.origin) {
      return json(
        {
          error: "Cross-origin workspace administration requests are not allowed.",
          code: "SAME_ORIGIN_REQUIRED",
        },
        403,
      );
    }
  } catch {
    return json(
      { error: "The request origin is invalid.", code: "ORIGIN_INVALID" },
      403,
    );
  }

  return null;
}

async function parsedJson(request: NextRequest) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const, response: json({ error: "Invalid JSON" }, 400) };
  }
}

function administrationError(error: unknown) {
  if (error instanceof WorkspaceAdministrationError) {
    return json({ error: error.message, code: error.code }, error.statusCode);
  }
  console.error("[workspace-access-admin] operation failed", error);
  return json({ error: "Workspace access administration is unavailable." }, 500);
}

function writeLimit(request: NextRequest, actorUserId: string) {
  const { ipAddress } = getRequestContext(request);
  return rateLimit(`${actorUserId}:${ipAddress}`, {
    key: "admin:workspace-access:write",
    windowMs: 5 * 60_000,
    max: 20,
  });
}

export async function GET() {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;

  try {
    if(gate.session.authSource==="supabase_gateway"){const token=await getGatewaySessionToken();if(!token)return json({error:"Gateway session required"},401);return json(await workspaceGateway("admin_snapshot",token))}
    return json(await getWorkspaceAdministrationSnapshot());
  } catch (error) {
    return administrationError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;

  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;

  const limit = writeLimit(request, gate.session.userId);
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  const body = await parsedJson(request);
  if (!body.ok) return body.response;

  const parsed = postSchema.safeParse(body.value);
  if (!parsed.success) {
    return json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const requestContext = getRequestContext(request);
  try {
    const data = parsed.data;
    if (data.operation === "provision_organization") {
      if(gate.session.authSource==="supabase_gateway"){const token=await getGatewaySessionToken();if(!token)return json({error:"Gateway session required"},401);return json(await workspaceGateway("provision",token,data),201)}
      const result = await provisionOrganizationWorkspace(
        { organizationName: data.organizationName, workspaceName: data.workspaceName, ownerEmail: data.ownerEmail, projectName: data.projectName ?? null, projectSummary: data.projectSummary ?? null, reason: data.reason },
        gate.session.userId,
        requestContext,
      );
      return json({ ok: true, operation: data.operation, result }, 201);
    }
    if (data.operation === "create_role") {
      const role = await createWorkspaceRole(
        {
          workspaceId: data.workspaceId!,
          confirmWorkspaceSlug: data.confirmWorkspaceSlug!,
          name: data.name!,
          description: data.description ?? null,
          permissions: (data.permissions ?? []).map((permission) => ({
            action: permission.action!,
            scope: permission.scope!,
          })),
          reason: data.reason!,
        },
        {
          actorUserId: gate.session.userId,
          ...requestContext,
        },
      );
      return json({ ok: true, operation: data.operation, role }, 201);
    }

    const membership = await assignWorkspaceMembership(
      {
        workspaceId: data.workspaceId!,
        confirmWorkspaceSlug: data.confirmWorkspaceSlug!,
        userId: data.userId!,
        confirmEmail: data.confirmEmail!,
        roleId: data.roleId!,
        reason: data.reason!,
      },
      {
        actorUserId: gate.session.userId,
        ...requestContext,
      },
    );
    return json({ ok: true, operation: data.operation, membership }, 201);
  } catch (error) {
    if(error instanceof GatewayRequestError)return json({error:error.message,code:error.code},error.statusCode);
    return administrationError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;

  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;

  const limit = writeLimit(request, gate.session.userId);
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  const body = await parsedJson(request);
  if (!body.ok) return body.response;

  const parsed = patchSchema.safeParse(body.value);
  if (!parsed.success) {
    return json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  try {
    const data = parsed.data;
    const membership = await updateWorkspaceMembership(
      {
        membershipId: data.membershipId!,
        expectedUpdatedAt: data.expectedUpdatedAt!,
        confirmEmail: data.confirmEmail!,
        reason: data.reason!,
        ...(data.roleId ? { roleId: data.roleId } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
      {
        actorUserId: gate.session.userId,
        ...getRequestContext(request),
      },
    );
    return json({ ok: true, operation: "update_membership", membership });
  } catch (error) {
    return administrationError(error);
  }
}
