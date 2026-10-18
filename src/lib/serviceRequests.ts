import { db } from "@/lib/db";
import {
  inspectServiceRequestContent,
  serviceRequestPriorityIds,
  serviceRequestTypeIds,
  type ServiceRequestPriorityId,
  type ServiceRequestTypeId,
} from "@/lib/serviceRequestCatalog";
import { resolveServiceRequestScope } from "@/lib/serviceRequestScope";
import { listAccessibleWorkspaces } from "@/lib/workspaceAccess";

export {
  inspectServiceRequestContent,
  serviceRequestPriorityIds,
  serviceRequestTypeCatalog,
  serviceRequestTypeIds,
  type SensitiveContentCategory,
  type SensitiveContentInspection,
  type ServiceRequestPriorityId,
  type ServiceRequestTypeId,
} from "@/lib/serviceRequestCatalog";

export class ServiceRequestDomainError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ServiceRequestDomainError";
  }
}

function assertControlledRequestType(value: string): asserts value is ServiceRequestTypeId {
  if (!serviceRequestTypeIds.includes(value as ServiceRequestTypeId)) {
    throw new ServiceRequestDomainError(
      "The selected request type is not available.",
      400,
      "REQUEST_TYPE_NOT_ALLOWED",
    );
  }
}

function assertControlledPriority(value: string): asserts value is ServiceRequestPriorityId {
  if (!serviceRequestPriorityIds.includes(value as ServiceRequestPriorityId)) {
    throw new ServiceRequestDomainError(
      "The selected priority is not available.",
      400,
      "REQUEST_PRIORITY_NOT_ALLOWED",
    );
  }
}

function assertContentSafe(subject: string, description: string) {
  const inspection = inspectServiceRequestContent(`${subject}\n${description}`);
  if (!inspection.safe) {
    throw new ServiceRequestDomainError(
      "Remove passwords, tokens, recovery material, private keys, payment-card numbers, banking identifiers, or identity-document numbers before submitting.",
      400,
      "SENSITIVE_CONTENT_REJECTED",
    );
  }
}

function deniedWorkspace(): never {
  throw new ServiceRequestDomainError(
    "The selected workspace is not assigned to this account.",
    403,
    "WORKSPACE_ACCESS_DENIED",
  );
}

function isSerializableConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2034",
  );
}

export async function getServiceRequestCenter(
  userId: string,
  requestedWorkspaceId?: string | null,
) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new ServiceRequestDomainError("Authentication is required.", 401, "AUTH_REQUIRED");
  }

  const accessibleWorkspaces = await listAccessibleWorkspaces(normalizedUserId);
  const scope = resolveServiceRequestScope(accessibleWorkspaces, requestedWorkspaceId);
  if (scope.kind === "denied") deniedWorkspace();
  const selectedWorkspace = scope.workspace;

  const requests = await db.serviceRequest.findMany({
    where: {
      userId: normalizedUserId,
      workspaceId: selectedWorkspace?.id ?? null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      workspaceId: true,
      type: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return {
    scope: selectedWorkspace
      ? {
          kind: "workspace" as const,
          workspaceId: selectedWorkspace.id,
          workspaceName: selectedWorkspace.name,
          organizationName: selectedWorkspace.organization.name,
        }
      : { kind: "personal" as const, workspaceId: null },
    workspaces: accessibleWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      organization: workspace.organization,
      role: workspace.role,
    })),
    requests: requests.map((request) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    })),
  };
}

export async function createServiceRequest(input: {
  userId: string;
  workspaceId?: string | null;
  type: string;
  subject: string;
  description: string;
  priority: string;
  ipAddress: string;
  userAgent: string;
}) {
  const userId = input.userId.trim();
  const workspaceId = input.workspaceId?.trim() || null;
  const type = input.type.trim();
  const subject = input.subject.trim();
  const description = input.description.trim();
  const priority = input.priority.trim();

  if (!userId) {
    throw new ServiceRequestDomainError("Authentication is required.", 401, "AUTH_REQUIRED");
  }

  assertControlledRequestType(type);
  assertControlledPriority(priority);
  assertContentSafe(subject, description);

  try {
    const request = await db.$transaction(
      async (tx) => {
        let selectedWorkspace: {
          id: string;
          name: string;
          slug: string;
          organization: { id: string; name: string; slug: string };
        } | null = null;

        if (workspaceId) {
          const membership = await tx.workspaceMember.findFirst({
            where: {
              userId,
              workspaceId,
              status: "active",
              workspace: {
                organization: {
                  status: "active",
                },
              },
            },
            select: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  organization: {
                    select: { id: true, name: true, slug: true },
                  },
                },
              },
            },
          });

          if (!membership) deniedWorkspace();
          selectedWorkspace = membership.workspace;
        }

        const created = await tx.serviceRequest.create({
          data: {
            userId,
            workspaceId: selectedWorkspace?.id ?? null,
            type,
            subject,
            description,
            priority,
            status: "open",
          },
          select: {
            id: true,
            userId: true,
            workspaceId: true,
            type: true,
            subject: true,
            description: true,
            status: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: "case_created",
            resource: "service_request",
            resourceId: created.id,
            metadata: {
              type,
              subject,
              priority,
              scope: selectedWorkspace ? "workspace" : "personal",
              workspaceId: selectedWorkspace?.id ?? null,
              workspaceName: selectedWorkspace?.name ?? null,
              organizationId: selectedWorkspace?.organization.id ?? null,
              organizationName: selectedWorkspace?.organization.name ?? null,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    return {
      ...request,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof ServiceRequestDomainError) throw error;
    if (isSerializableConflict(error)) {
      throw new ServiceRequestDomainError(
        "Workspace access changed while the request was being submitted. Refresh and try again.",
        409,
        "REQUEST_CONFLICT",
      );
    }
    throw error;
  }
}
