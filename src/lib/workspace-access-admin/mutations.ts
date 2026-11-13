import { db } from "@/lib/db";
import { normalizeWorkspacePermissions } from "@/lib/workspace-access-admin/catalog";
import {
  normalizeWorkspaceEmail,
  normalizeWorkspaceRoleName,
  type WorkspaceAdministrationContext,
  workspaceConflict,
  workspaceInvalid,
  workspaceMissing,
} from "@/lib/workspace-access-admin/errors";

function controlledPermissions(permissions: Array<{ action: string; scope: string }>) {
  try {
    return normalizeWorkspacePermissions(permissions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PERMISSION_INVALID";
    if (message === "PERMISSION_REQUIRED") {
      workspaceInvalid(
        "Select at least one controlled workspace permission.",
        "PERMISSION_REQUIRED",
      );
    }
    if (message.startsWith("PERMISSION_NOT_ALLOWED:")) {
      workspaceInvalid(
        `Permission ${message.slice("PERMISSION_NOT_ALLOWED:".length)} is not available in the controlled workspace catalog.`,
        "PERMISSION_NOT_ALLOWED",
      );
    }
    workspaceInvalid("The permission selection is invalid.", "PERMISSION_INVALID");
  }
}

export async function createWorkspaceRole(
  input: {
    workspaceId: string;
    confirmWorkspaceSlug: string;
    name: string;
    description?: string | null;
    permissions: Array<{ action: string; scope: string }>;
    reason: string;
  },
  context: WorkspaceAdministrationContext,
  database = db,
) {
  const name = normalizeWorkspaceRoleName(input.name);
  const permissions = controlledPermissions(input.permissions);

  return database.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        organization: { select: { id: true, name: true, status: true } },
      },
    });
    if (!workspace || workspace.organization.status !== "active") {
      workspaceMissing("The selected active workspace was not found.", "WORKSPACE_NOT_FOUND");
    }
    if (input.confirmWorkspaceSlug.trim() !== workspace.slug) {
      workspaceInvalid(
        "Workspace slug confirmation does not match.",
        "WORKSPACE_CONFIRMATION_MISMATCH",
      );
    }

    const existing = await tx.role.findUnique({
      where: { workspaceId_name: { workspaceId: workspace.id, name } },
      select: { id: true },
    });
    if (existing) {
      workspaceConflict(
        "A role with that name already exists in this workspace.",
        "ROLE_EXISTS",
      );
    }

    const role = await tx.role.create({
      data: {
        workspaceId: workspace.id,
        name,
        description: input.description?.trim() || null,
        permissions: { create: permissions },
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          orderBy: [{ scope: "asc" }, { action: "asc" }],
          select: { id: true, action: true, scope: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: context.actorUserId,
        action: "admin_action",
        resource: "workspace_role",
        resourceId: role.id,
        metadata: {
          operation: "workspace_role_created",
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          organizationId: workspace.organization.id,
          organizationName: workspace.organization.name,
          roleName: role.name,
          permissions: role.permissions.map(({ action, scope }) => ({ action, scope })),
          reason: input.reason.trim(),
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return {
      ...role,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  });
}

export async function assignWorkspaceMembership(
  input: {
    workspaceId: string;
    confirmWorkspaceSlug: string;
    userId: string;
    confirmEmail: string;
    roleId: string;
    reason: string;
  },
  context: WorkspaceAdministrationContext,
  database = db,
) {
  return database.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        organization: { select: { id: true, name: true, status: true } },
      },
    });
    if (!workspace || workspace.organization.status !== "active") {
      workspaceMissing("The selected active workspace was not found.", "WORKSPACE_NOT_FOUND");
    }
    if (input.confirmWorkspaceSlug.trim() !== workspace.slug) {
      workspaceInvalid(
        "Workspace slug confirmation does not match.",
        "WORKSPACE_CONFIRMATION_MISMATCH",
      );
    }

    const [user, role, existing] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, role: true, status: true, isActive: true },
      }),
      tx.role.findUnique({
        where: { id: input.roleId },
        select: { id: true, workspaceId: true, name: true },
      }),
      tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: input.userId },
        },
        select: { id: true },
      }),
    ]);

    if (!user || !user.isActive || user.status !== "active") {
      workspaceMissing("The selected active user was not found.", "USER_NOT_ACTIVE");
    }
    if (normalizeWorkspaceEmail(input.confirmEmail) !== normalizeWorkspaceEmail(user.email)) {
      workspaceInvalid(
        "Target email confirmation does not match.",
        "EMAIL_CONFIRMATION_MISMATCH",
      );
    }
    if (!role || role.workspaceId !== workspace.id) {
      workspaceInvalid(
        "The selected role does not belong to this workspace.",
        "ROLE_WORKSPACE_MISMATCH",
      );
    }
    if (existing) {
      workspaceConflict(
        "This user already has a workspace membership. Use the controlled update workflow instead.",
        "MEMBERSHIP_EXISTS",
      );
    }

    const membership = await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        roleId: role.id,
        status: "active",
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        roleId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: context.actorUserId,
        action: "admin_action",
        resource: "workspace_membership",
        resourceId: membership.id,
        metadata: {
          operation: "workspace_membership_assigned",
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          organizationId: workspace.organization.id,
          organizationName: workspace.organization.name,
          targetUserId: user.id,
          targetEmail: user.email,
          accountRole: user.role,
          workspaceRoleId: role.id,
          workspaceRoleName: role.name,
          newStatus: membership.status,
          reason: input.reason.trim(),
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return {
      ...membership,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };
  });
}

export async function updateWorkspaceMembership(
  input: {
    membershipId: string;
    expectedUpdatedAt: string;
    confirmEmail: string;
    roleId?: string;
    status?: "active" | "suspended";
    reason: string;
  },
  context: WorkspaceAdministrationContext,
  database = db,
) {
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    workspaceInvalid(
      "The expected membership version is invalid.",
      "MEMBERSHIP_VERSION_INVALID",
    );
  }

  return database.$transaction(async (tx) => {
    const current = await tx.workspaceMember.findUnique({
      where: { id: input.membershipId },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        roleId: true,
        status: true,
        updatedAt: true,
        user: { select: { email: true, role: true } },
        role: { select: { id: true, name: true } },
        workspace: {
          select: {
            name: true,
            organization: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });
    if (!current || current.workspace.organization.status !== "active") {
      workspaceMissing("The selected active membership was not found.", "MEMBERSHIP_NOT_FOUND");
    }
    if (
      normalizeWorkspaceEmail(input.confirmEmail) !==
      normalizeWorkspaceEmail(current.user.email)
    ) {
      workspaceInvalid(
        "Target email confirmation does not match.",
        "EMAIL_CONFIRMATION_MISMATCH",
      );
    }

    let nextRole: { id: string; name: string } | null = current.role;
    if (input.roleId) {
      const candidateRole = await tx.role.findUnique({
        where: { id: input.roleId },
        select: { id: true, name: true, workspaceId: true },
      });
      if (!candidateRole || candidateRole.workspaceId !== current.workspaceId) {
        workspaceInvalid(
          "The selected role does not belong to this workspace.",
          "ROLE_WORKSPACE_MISMATCH",
        );
      }
      nextRole = { id: candidateRole.id, name: candidateRole.name };
    }

    const nextStatus = input.status ?? current.status;
    const nextRoleId = input.roleId ?? current.roleId;
    if (nextStatus === current.status && nextRoleId === current.roleId) {
      workspaceInvalid("No membership change was requested.", "NO_MEMBERSHIP_CHANGE");
    }

    const changed = await tx.workspaceMember.updateMany({
      where: { id: current.id, updatedAt: expectedUpdatedAt },
      data: { status: nextStatus, roleId: nextRoleId },
    });
    if (changed.count !== 1) {
      workspaceConflict(
        "The membership changed after this page was loaded. Refresh before applying another update.",
        "MEMBERSHIP_VERSION_CONFLICT",
      );
    }

    const updated = await tx.workspaceMember.findUniqueOrThrow({
      where: { id: current.id },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        roleId: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: context.actorUserId,
        action: "admin_action",
        resource: "workspace_membership",
        resourceId: current.id,
        metadata: {
          operation: "workspace_membership_updated",
          workspaceId: current.workspaceId,
          workspaceName: current.workspace.name,
          organizationId: current.workspace.organization.id,
          organizationName: current.workspace.organization.name,
          targetUserId: current.userId,
          targetEmail: current.user.email,
          accountRole: current.user.role,
          previous: {
            status: current.status,
            roleId: current.roleId,
            roleName: current.role?.name ?? null,
            updatedAt: current.updatedAt.toISOString(),
          },
          next: {
            status: updated.status,
            roleId: updated.roleId,
            roleName: nextRole?.name ?? null,
            updatedAt: updated.updatedAt.toISOString(),
          },
          reason: input.reason.trim(),
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return { ...updated, updatedAt: updated.updatedAt.toISOString() };
  });
}
