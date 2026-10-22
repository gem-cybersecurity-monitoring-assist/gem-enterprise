import { AuditAction, Prisma, RequestStatus } from "@prisma/client";
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

/**
 * Admin service-request domain (staff-only).
 *
 * The lifecycle below is the managed state machine for service requests,
 * aligned to the existing Prisma RequestStatus enum
 * (open, in_progress, pending_info, completed, cancelled).
 *
 * Two schema-alignment guards keep this fail-closed:
 *  - toPersistedRequestStatus(): lifecycle states are only written to the
 *    database when the Prisma RequestStatus enum supports them; otherwise a
 *    500 REQUEST_STATUS_NOT_SUPPORTED is thrown so the mismatch is loud
 *    instead of silently corrupt.
 *  - resolveCaseAuditAction(): prefers the dedicated case_* audit actions
 *    when the Prisma AuditAction enum provides them and falls back to
 *    admin_action with the intended operation recorded in metadata.
 */

export const STAFF_ACTOR_ROLES = [
  "analyst",
  "admin",
  "super_admin",
  "internal",
] as const;
export type StaffActorRole = (typeof STAFF_ACTOR_ROLES)[number];

export interface ServiceRequestActor {
  userId: string;
  role: string;
}

export interface ServiceRequestAuditContext {
  ipAddress: string;
  userAgent: string;
}

export interface ServiceRequestTransitionContext
  extends ServiceRequestAuditContext {
  note?: string;
}

function assertStaffActor(actor: ServiceRequestActor) {
  const userId = actor?.userId?.trim();
  if (!userId || !STAFF_ACTOR_ROLES.includes(actor.role as StaffActorRole)) {
    throw new ServiceRequestDomainError(
      "Staff access is required for this operation.",
      403,
      "STAFF_ACCESS_REQUIRED",
    );
  }
}

export const REQUEST_LIFECYCLE_STATUSES = [
  "open",
  "in_progress",
  "pending_info",
  "completed",
  "cancelled",
] as const;
export type RequestLifecycleStatus =
  (typeof REQUEST_LIFECYCLE_STATUSES)[number];

export interface RequestStatusTransition {
  from: RequestLifecycleStatus;
  to: RequestLifecycleStatus;
}

export const ALLOWED_REQUEST_TRANSITIONS: Record<
  RequestLifecycleStatus,
  ReadonlyArray<RequestLifecycleStatus>
> = {
  open: ["in_progress", "pending_info", "cancelled"],
  in_progress: ["pending_info", "completed", "cancelled"],
  pending_info: ["in_progress", "completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: [],
};

export function canTransitionRequestStatus(
  from: RequestLifecycleStatus,
  to: RequestLifecycleStatus,
): boolean {
  return ALLOWED_REQUEST_TRANSITIONS[from].includes(to);
}

function assertLifecycleStatus(
  value: string,
): asserts value is RequestLifecycleStatus {
  if (
    !(REQUEST_LIFECYCLE_STATUSES as ReadonlyArray<string>).includes(value)
  ) {
    throw new ServiceRequestDomainError(
      `Unknown request status "${value}".`,
      400,
      "INVALID_REQUEST_STATUS",
    );
  }
}

const PERSISTED_REQUEST_STATUSES = new Set<string>(
  Object.values(RequestStatus) as Array<string>,
);

function toPersistedRequestStatus(status: RequestLifecycleStatus): RequestStatus {
  if (PERSISTED_REQUEST_STATUSES.has(status)) {
    return status as unknown as RequestStatus;
  }
  throw new ServiceRequestDomainError(
    `Request status "${status}" cannot be stored yet: the database RequestStatus enum does not include it. A schema migration is required before this lifecycle state can be persisted.`,
    500,
    "REQUEST_STATUS_NOT_SUPPORTED",
  );
}

export const CASE_ASSIGNED_AUDIT_ACTION = "case_assigned" as const;
export const CASE_STATUS_CHANGED_AUDIT_ACTION = "case_status_changed" as const;

const KNOWN_AUDIT_ACTIONS = new Set<string>(
  Object.values(AuditAction) as Array<string>,
);

function resolveCaseAuditAction(intended: string): AuditAction {
  if (KNOWN_AUDIT_ACTIONS.has(intended)) return intended as AuditAction;
  return AuditAction.admin_action;
}

function serializeRequestTimestamps<
  T extends { createdAt: Date; updatedAt: Date; resolvedAt?: Date | null },
>(request: T) {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
  };
}

function assertRequestId(requestId: string): string {
  const id = requestId?.trim();
  if (!id) {
    throw new ServiceRequestDomainError(
      "A request id is required.",
      400,
      "REQUEST_ID_REQUIRED",
    );
  }
  return id;
}

export interface AdminServiceRequestFilters {
  actor: ServiceRequestActor;
  statuses?: string[];
  types?: string[];
  workspaceId?: string | null;
  organizationId?: string | null;
  search?: string | null;
  assignedTo?: string | null;
  page?: number;
  pageSize?: number;
}

const requestListSelect = {
  id: true,
  userId: true,
  workspaceId: true,
  type: true,
  subject: true,
  status: true,
  priority: true,
  assignedTo: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true } },
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

export async function listServiceRequestsForAdmin(
  filters: AdminServiceRequestFilters,
) {
  assertStaffActor(filters.actor);

  const page = Math.max(1, Math.floor(filters.page ?? 1) || 1);
  const pageSize = Math.floor(filters.pageSize ?? 25) || 25;
  if (pageSize < 1 || pageSize > 100) {
    throw new ServiceRequestDomainError(
      "pageSize must be between 1 and 100.",
      400,
      "INVALID_PAGE_SIZE",
    );
  }

  const statuses = (filters.statuses ?? []).map((status) => status.trim()).filter(Boolean);
  const persistedStatuses = statuses.map((status) => {
    assertLifecycleStatus(status);
    try {
      return toPersistedRequestStatus(status);
    } catch (error) {
      if (error instanceof ServiceRequestDomainError) {
        throw new ServiceRequestDomainError(
          `Status filter "${status}" is not available in the current database schema.`,
          400,
          "STATUS_FILTER_NOT_SUPPORTED",
        );
      }
      throw error;
    }
  });

  const types = (filters.types ?? []).map((type) => type.trim()).filter(Boolean);
  for (const type of types) assertControlledRequestType(type);

  const workspaceId = filters.workspaceId?.trim() || null;
  const organizationId = filters.organizationId?.trim() || null;
  const search = filters.search?.trim() || null;
  const assignedTo = filters.assignedTo?.trim() || null;

  const where: Prisma.ServiceRequestWhereInput = {
    ...(persistedStatuses.length > 0 ? { status: { in: persistedStatuses } } : {}),
    ...(types.length > 0 ? { type: { in: types } } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(organizationId ? { workspace: { organizationId } } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, requests] = await Promise.all([
    db.serviceRequest.count({ where }),
    db.serviceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: requestListSelect,
    }),
  ]);

  const assigneeIds = [
    ...new Set(
      requests
        .map((request) => request.assignedTo)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const assignees = assigneeIds.length
    ? await db.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, email: true },
      })
    : [];
  const assigneeById = new Map(assignees.map((assignee) => [assignee.id, assignee]));

  return {
    items: requests.map((request) => ({
      ...serializeRequestTimestamps(request),
      status: request.status as string,
      assignee: request.assignedTo
        ? (assigneeById.get(request.assignedTo) ?? {
            id: request.assignedTo,
            email: null,
          })
        : null,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getServiceRequestForAdmin(
  requestId: string,
  actor: ServiceRequestActor,
) {
  assertStaffActor(actor);
  const id = assertRequestId(requestId);

  const request = await db.serviceRequest.findUnique({
    where: { id },
    select: {
      ...requestListSelect,
      description: true,
    },
  });
  if (!request) {
    throw new ServiceRequestDomainError(
      "Service request not found.",
      404,
      "REQUEST_NOT_FOUND",
    );
  }

  const [assignee, auditTrail] = await Promise.all([
    request.assignedTo
      ? db.user.findUnique({
          where: { id: request.assignedTo },
          select: { id: true, email: true, role: true },
        })
      : Promise.resolve(null),
    db.auditLog.findMany({
      where: { resource: "service_request", resourceId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        action: true,
        resource: true,
        resourceId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
      },
    }),
  ]);

  return {
    ...serializeRequestTimestamps(request),
    status: request.status as string,
    assignee:
      assignee ??
      (request.assignedTo
        ? { id: request.assignedTo, email: null, role: null }
        : null),
    auditTrail: auditTrail.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function assignServiceRequest(
  requestId: string,
  assigneeUserId: string,
  actor: ServiceRequestActor,
  context: ServiceRequestAuditContext,
) {
  assertStaffActor(actor);
  const id = assertRequestId(requestId);
  const assigneeId = assigneeUserId?.trim();
  if (!assigneeId) {
    throw new ServiceRequestDomainError(
      "An assignee is required.",
      400,
      "ASSIGNEE_REQUIRED",
    );
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const request = await tx.serviceRequest.findUnique({
          where: { id },
          select: { id: true, assignedTo: true, status: true },
        });
        if (!request) {
          throw new ServiceRequestDomainError(
            "Service request not found.",
            404,
            "REQUEST_NOT_FOUND",
          );
        }

        const assignee = await tx.user.findUnique({
          where: { id: assigneeId },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            isActive: true,
          },
        });
        if (!assignee || !assignee.isActive || assignee.status !== "active") {
          throw new ServiceRequestDomainError(
            "The selected assignee account is not available.",
            400,
            "ASSIGNEE_NOT_FOUND",
          );
        }
        if (!STAFF_ACTOR_ROLES.includes(assignee.role as StaffActorRole)) {
          throw new ServiceRequestDomainError(
            "Service requests can only be assigned to staff members.",
            400,
            "ASSIGNEE_NOT_STAFF",
          );
        }

        const updated = await tx.serviceRequest.update({
          where: { id },
          data: { assignedTo: assignee.id },
          select: {
            id: true,
            assignedTo: true,
            status: true,
            resolvedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: resolveCaseAuditAction(CASE_ASSIGNED_AUDIT_ACTION),
            resource: "service_request",
            resourceId: id,
            metadata: {
              operation: CASE_ASSIGNED_AUDIT_ACTION,
              assigneeUserId: assignee.id,
              assigneeEmail: assignee.email,
              assigneeRole: assignee.role,
              previousAssigneeUserId: request.assignedTo,
              requestStatus: request.status,
            },
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return {
          ...serializeRequestTimestamps(updated),
          status: updated.status as string,
          assignee: {
            id: assignee.id,
            email: assignee.email,
            role: assignee.role,
          },
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof ServiceRequestDomainError) throw error;
    if (isSerializableConflict(error)) {
      throw new ServiceRequestDomainError(
        "The request changed while it was being assigned. Refresh and try again.",
        409,
        "REQUEST_CONFLICT",
      );
    }
    throw error;
  }
}

export async function transitionServiceRequest(
  requestId: string,
  toStatus: string,
  actor: ServiceRequestActor,
  context: ServiceRequestTransitionContext,
) {
  assertStaffActor(actor);
  const id = assertRequestId(requestId);
  assertLifecycleStatus(toStatus);

  const note = context.note?.trim() || null;
  if (note && note.length > 1000) {
    throw new ServiceRequestDomainError(
      "The transition note must be 1000 characters or fewer.",
      400,
      "NOTE_TOO_LONG",
    );
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const request = await tx.serviceRequest.findUnique({
          where: { id },
          select: { id: true, status: true, assignedTo: true },
        });
        if (!request) {
          throw new ServiceRequestDomainError(
            "Service request not found.",
            404,
            "REQUEST_NOT_FOUND",
          );
        }

        const fromStatus = request.status as string;
        if (
          !(REQUEST_LIFECYCLE_STATUSES as ReadonlyArray<string>).includes(
            fromStatus,
          )
        ) {
          throw new ServiceRequestDomainError(
            `This request is in status "${fromStatus}", which is outside the managed lifecycle and cannot be transitioned.`,
            409,
            "STATUS_OUTSIDE_LIFECYCLE",
          );
        }
        if (
          !canTransitionRequestStatus(
            fromStatus as RequestLifecycleStatus,
            toStatus,
          )
        ) {
          throw new ServiceRequestDomainError(
            `Status cannot move from ${fromStatus} to ${toStatus}.`,
            400,
            "INVALID_TRANSITION",
          );
        }

        const persisted = toPersistedRequestStatus(toStatus);
        const shouldResolve = toStatus === "completed" || toStatus === "cancelled";
        const shouldReopen =
          toStatus === "in_progress" || toStatus === "pending_info";

        const updated = await tx.serviceRequest.update({
          where: { id },
          data: {
            status: persisted,
            ...(shouldResolve
              ? { resolvedAt: new Date() }
              : shouldReopen
                ? { resolvedAt: null }
                : {}),
          },
          select: {
            id: true,
            status: true,
            resolvedAt: true,
            updatedAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: resolveCaseAuditAction(CASE_STATUS_CHANGED_AUDIT_ACTION),
            resource: "service_request",
            resourceId: id,
            metadata: {
              operation: CASE_STATUS_CHANGED_AUDIT_ACTION,
              fromStatus,
              toStatus,
              ...(note ? { note } : {}),
            },
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return {
          id: updated.id,
          status: toStatus,
          resolvedAt: updated.resolvedAt
            ? updated.resolvedAt.toISOString()
            : null,
          updatedAt: updated.updatedAt.toISOString(),
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof ServiceRequestDomainError) throw error;
    if (isSerializableConflict(error)) {
      throw new ServiceRequestDomainError(
        "The request changed while it was being updated. Refresh and try again.",
        409,
        "REQUEST_CONFLICT",
      );
    }
    throw error;
  }
}
