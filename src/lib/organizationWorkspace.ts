import { db } from "@/lib/db";

export function isSameOriginWorkspaceRequest(origin: string | null, requestOrigin: string) {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(requestOrigin).origin;
  } catch {
    return false;
  }
}

export class OrganizationWorkspaceError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = "OrganizationWorkspaceError";
  }
}

export function slugifyOrganization(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new OrganizationWorkspaceError("A valid name is required.", 400, "INVALID_SLUG");
  return slug;
}

export async function requireWorkspaceMembership(userId: string, workspaceId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: {
      role: { include: { permissions: true } },
      workspace: { include: { organization: true } },
    },
  });
  if (!membership || membership.status !== "active" || membership.workspace.organization.status !== "active") {
    throw new OrganizationWorkspaceError("Workspace access denied.", 403, "WORKSPACE_ACCESS_DENIED");
  }
  return membership;
}

export function hasWorkspacePermission(
  membership: Awaited<ReturnType<typeof requireWorkspaceMembership>>,
  action: string,
  scope: string,
) {
  return membership.role?.permissions.some((permission) => permission.action === action && permission.scope === scope) ?? false;
}

export async function requireWorkspacePermission(userId: string, workspaceId: string, action: string, scope: string) {
  const membership = await requireWorkspaceMembership(userId, workspaceId);
  if (!hasWorkspacePermission(membership, action, scope)) {
    throw new OrganizationWorkspaceError("Workspace permission denied.", 403, "WORKSPACE_PERMISSION_DENIED");
  }
  return membership;
}

export async function getOrganizationWorkspaceOverview(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceMembership(userId, workspaceId);
  const [projects, updates, members, roles] = await Promise.all([
    db.organizationProject.findMany({
      where: { workspaceId, status: { not: "ARCHIVED" } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: { owner: { select: { id: true, email: true, profile: { select: { displayName: true } } } } },
    }),
    db.workspaceWeeklyUpdate.findMany({
      where: { workspaceId }, orderBy: { weekEnding: "desc" }, take: 12,
      include: {
        project: { select: { id: true, name: true } },
        author: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
    }),
    db.workspaceMember.findMany({ where:{workspaceId,status:"active"}, orderBy:{createdAt:"asc"}, include:{user:{select:{id:true,email:true,profile:{select:{displayName:true}}}},role:{select:{id:true,name:true}}} }),
    db.role.findMany({ where:{workspaceId}, orderBy:{name:"asc"}, select:{id:true,name:true,description:true} }),
  ]);
  return {
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      organization: { id: membership.workspace.organization.id, name: membership.workspace.organization.name, slug: membership.workspace.organization.slug },
      role: membership.role?.name ?? "Member",
      permissions: membership.role?.permissions ?? [],
      status: "ACTIVE",
      projectSetup: projects.length ? "IN_PROGRESS" : "NOT_STARTED",
    },
    projects,
    updates,
    members,
    roles,
    viewerUserId: userId,
    modules: [
      { id: "projects", label: "Projects", state: "AVAILABLE" },
      { id: "team", label: "Team", state: "AVAILABLE" },
      { id: "weekly_updates", label: "Weekly updates", state: "AVAILABLE" },
      { id: "requests", label: "Service requests", state: "AVAILABLE" },
      { id: "documents", label: "Documents", state: "SETUP_IN_PROGRESS" },
      { id: "reports", label: "Reports", state: "SETUP_IN_PROGRESS" },
      { id: "automations", label: "Automations", state: "NOT_ACTIVATED" },
      { id: "integrations", label: "Integrations", state: "NOT_ACTIVATED" },
    ],
  };
}

export async function getOrganizationProjectWorkspace(userId: string, projectId: string) {
  const project = await db.organizationProject.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { updates: true } },
      updates: {
        orderBy: { weekEnding: "desc" },
        take: 6,
        select: {
          id: true,
          weekEnding: true,
          status: true,
          accomplishments: true,
          inProgress: true,
        },
      },
      workspace: {
        include: {
          organization: true,
          _count: { select: { members: true, connectors: true, approvalRequests: true } },
          connectors: {
            orderBy: { updatedAt: "desc" },
            take: 12,
            select: {
              id: true,
              provider: true,
              state: true,
              displayName: true,
              externalAccountId: true,
              disabledAt: true,
              lastHealthAt: true,
            },
          },
        },
      },
    },
  });
  if (!project || project.status === "ARCHIVED") {
    throw new OrganizationWorkspaceError("Project workspace not found.", 404, "PROJECT_NOT_FOUND");
  }
  const membership = await requireWorkspaceMembership(userId, project.workspaceId);
  return {
    project,
    workspace: project.workspace,
    membership,
    permissions: membership.role?.permissions ?? [],
  };
}

export async function provisionOrganizationWorkspace(input: {
  organizationName: string; workspaceName: string; ownerEmail: string; projectName?: string | null; projectSummary?: string | null; reason: string;
}, actorUserId: string, context: { ipAddress: string; userAgent: string }) {
  const organizationSlug = slugifyOrganization(input.organizationName);
  const workspaceSlug = slugifyOrganization(input.workspaceName);
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  return db.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true, email: true, role: true, status: true, isActive: true } });
    if (!owner || !owner.isActive || owner.status !== "active") throw new OrganizationWorkspaceError("The existing active member was not found.", 404, "OWNER_ACCOUNT_NOT_FOUND");
    if (owner.role !== "client") throw new OrganizationWorkspaceError("Organization ownership requires an existing client account.", 400, "PLATFORM_ROLE_NOT_CLIENT");
    if (await tx.organization.findUnique({ where: { slug: organizationSlug } })) throw new OrganizationWorkspaceError("Organization slug already exists.", 409, "ORGANIZATION_EXISTS");

    const organization = await tx.organization.create({ data: { name: input.organizationName.trim(), slug: organizationSlug, status: "active" } });
    const workspace = await tx.workspace.create({ data: { organizationId: organization.id, name: input.workspaceName.trim(), slug: workspaceSlug } });
    const role = await tx.role.create({
      data: {
        workspaceId: workspace.id, name: "Organization Owner",
        description: "Owns this organization workspace without GEM platform-administrator authority.",
        permissions: { create: [
          ["view", "workspace"], ["view", "members"], ["manage", "members"], ["view", "requests"], ["manage", "requests"],
          ["view", "documents"], ["view", "support"], ["manage", "support"], ["view", "approvals"], ["manage", "projects"], ["manage", "weekly_updates"],
        ].map(([action, scope]) => ({ action, scope })) },
      },
    });
    const membership = await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, roleId: role.id, status: "active" } });
    const project = input.projectName?.trim() ? await tx.organizationProject.create({ data: {
      workspaceId: workspace.id, ownerUserId: owner.id, name: input.projectName.trim(), slug: slugifyOrganization(input.projectName),
      summary: input.projectSummary?.trim() || "Project workspace setup is in progress.", status: "PLANNED", progress: 0,
    } }) : null;
    await tx.auditLog.create({ data: {
      userId: actorUserId, action: "admin_action", resource: "organization_workspace", resourceId: workspace.id,
      metadata: { operation: "organization_workspace_provisioned", organizationId: organization.id, workspaceId: workspace.id, ownerUserId: owner.id, ownerEmail: owner.email, ownerPlatformRole: owner.role, projectId: project?.id ?? null, reason: input.reason.trim() },
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    } });
    return { organization, workspace, role, membership, project };
  });
}
