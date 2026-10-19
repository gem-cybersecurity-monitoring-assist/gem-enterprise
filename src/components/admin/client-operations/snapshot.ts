/**
 * Server-side data loader for /app/admin/client-operations.
 *
 * MUST ONLY be called from an admin-gated server component (the page checks
 * requireSession() + isAdminRole() before invoking). Every query here reads
 * persisted records; no values are invented — empty results surface as
 * "none recorded" in the UI.
 */

import { db } from "@/lib/db";
import {
  IntakeSubmissionStatus,
  KYCStatus,
  RequestStatus,
  TokMetricConnectorState,
  TokMetricObjectState,
} from "@prisma/client";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  billingPlan: string | null;
  workspaceCount: number;
  memberCount: number;
  openRequestCount: number;
  createdAt: Date;
}

export interface StatusBucket {
  key: string;
  count: number;
}

export interface ClientOperationsSnapshot {
  organizations: OrganizationRow[];
  truncated: boolean;
  serviceRequestsByStatus: StatusBucket[];
  approvalsByState: StatusBucket[];
  intakeByStatus: StatusBucket[];
  kycByStatus: StatusBucket[];
  connectorsByState: StatusBucket[];
  auditLog: Array<{
    id: string;
    action: string;
    resource: string | null;
    userId: string | null;
    createdAt: Date;
  }>;
}

const SERVICE_REQUEST_OPEN_STATES: RequestStatus[] = [
  RequestStatus.open,
  RequestStatus.in_progress,
  RequestStatus.pending_info,
];

/** Approval states that still require an operator decision. */
const APPROVAL_PENDING_STATES: TokMetricObjectState[] = [
  TokMetricObjectState.APPROVAL_REQUIRED,
];

/** Intake submissions that have not yet been resolved. */
const INTAKE_REVIEW_STATES: IntakeSubmissionStatus[] = [
  IntakeSubmissionStatus.RECEIVED,
  IntakeSubmissionStatus.TRIAGE,
  IntakeSubmissionStatus.NEEDS_INFORMATION,
];

/** KYC applications awaiting a review outcome. */
const KYC_PENDING_STATES: KYCStatus[] = [
  KYCStatus.started,
  KYCStatus.in_progress,
  KYCStatus.documents_uploaded,
  KYCStatus.under_review,
  KYCStatus.manual_review,
];

const ORG_LIMIT = 50;

export async function getClientOperationsSnapshot(): Promise<ClientOperationsSnapshot> {
  const orgs = await db.organization.findMany({
    take: ORG_LIMIT,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      billingPlan: true,
      createdAt: true,
      workspaces: { select: { id: true } },
    },
  });

  const workspaceIds = orgs.flatMap((org) => org.workspaces.map((w) => w.id));

  const [memberBuckets, openRequestBuckets] = await Promise.all([
    workspaceIds.length
      ? db.workspaceMember.groupBy({
          by: ["workspaceId"],
          where: { workspaceId: { in: workspaceIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    workspaceIds.length
      ? db.serviceRequest.groupBy({
          by: ["workspaceId"],
          where: {
            workspaceId: { in: workspaceIds },
            status: { in: SERVICE_REQUEST_OPEN_STATES },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const membersByWorkspace = new Map(
    memberBuckets.map((b) => [b.workspaceId, b._count._all]),
  );
  const openRequestsByWorkspace = new Map(
    openRequestBuckets.map((b) => [b.workspaceId, b._count._all]),
  );

  const organizations: OrganizationRow[] = orgs.map((org) => {
    const wsIds = org.workspaces.map((w) => w.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      billingPlan: org.billingPlan,
      workspaceCount: wsIds.length,
      memberCount: wsIds.reduce(
        (sum, id) => sum + (membersByWorkspace.get(id) ?? 0),
        0,
      ),
      openRequestCount: wsIds.reduce(
        (sum, id) => sum + (openRequestsByWorkspace.get(id) ?? 0),
        0,
      ),
      createdAt: org.createdAt,
    };
  });

  const [
    serviceRequestsByStatus,
    approvalsByState,
    intakeByStatus,
    kycByStatus,
    connectorsByState,
    auditLog,
  ] = await Promise.all([
    db.serviceRequest
      .groupBy({ by: ["status"], _count: { _all: true } })
      .then((rows) =>
        rows.map((r) => ({ key: String(r.status), count: r._count._all })),
      ),
    db.approvalRequest
      .groupBy({ by: ["state"], _count: { _all: true } })
      .then((rows) =>
        rows.map((r) => ({ key: String(r.state), count: r._count._all })),
      ),
    db.intakeSubmission
      .groupBy({ by: ["status"], _count: { _all: true } })
      .then((rows) =>
        rows.map((r) => ({ key: String(r.status), count: r._count._all })),
      ),
    db.kYCApplication
      .groupBy({ by: ["status"], _count: { _all: true } })
      .then((rows) =>
        rows.map((r) => ({ key: String(r.status), count: r._count._all })),
      ),
    db.connector
      .groupBy({ by: ["state"], _count: { _all: true } })
      .then((rows) =>
        rows.map((r) => ({ key: String(r.state), count: r._count._all })),
      ),
    db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        resource: true,
        userId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    organizations,
    truncated: orgs.length >= ORG_LIMIT,
    serviceRequestsByStatus,
    approvalsByState,
    intakeByStatus,
    kycByStatus,
    connectorsByState,
    auditLog,
  };
}

export {
  APPROVAL_PENDING_STATES,
  INTAKE_REVIEW_STATES,
  KYC_PENDING_STATES,
  SERVICE_REQUEST_OPEN_STATES,
  TokMetricConnectorState,
  TokMetricObjectState,
};
