/**
 * serviceRequestLifecycle.test.ts (WS-G)
 *
 * Unit tests for the WS-E service-request lifecycle in src/lib/serviceRequests.ts.
 * Pure-function/unit tests only: no database, no network, no secrets.
 *
 * NOTE on module loading: src/lib/serviceRequests.ts imports @prisma/client
 * (the client is NOT generated in this sandbox), so @prisma/client and
 * @/lib/db are stubbed below with string-literal enum values taken verbatim
 * from prisma/schema.prisma (enum RequestStatus { open, in_progress,
 * pending_info, completed, cancelled }). The admin-function tests only
 * exercise the staff-assertion error path, which throws before any DB call,
 * so the db stub is never touched.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  RequestStatus: {
    open: "open",
    in_progress: "in_progress",
    pending_info: "pending_info",
    completed: "completed",
    cancelled: "cancelled",
  },
  AuditAction: {
    admin_action: "admin_action",
    case_created: "case_created",
  },
  Prisma: {},
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  ALLOWED_REQUEST_TRANSITIONS,
  REQUEST_LIFECYCLE_STATUSES,
  ServiceRequestDomainError,
  STAFF_ACTOR_ROLES,
  assignServiceRequest,
  canTransitionRequestStatus,
  getServiceRequestForAdmin,
  listServiceRequestsForAdmin,
  transitionServiceRequest,
  type RequestLifecycleStatus,
  type ServiceRequestActor,
} from "@/lib/serviceRequests";

const PRISMA_ENUM_ORDER = ["open", "in_progress", "pending_info", "completed", "cancelled"];

const clientActor: ServiceRequestActor = { userId: "user-client-1", role: "client" };
const auditContext = { ipAddress: "127.0.0.1", userAgent: "vitest" };

describe("REQUEST_LIFECYCLE_STATUSES matches the Prisma RequestStatus enum", () => {
  it("contains exactly the five Prisma enum members in schema order", () => {
    expect([...REQUEST_LIFECYCLE_STATUSES]).toEqual(PRISMA_ENUM_ORDER);
  });
});

describe("ALLOWED_REQUEST_TRANSITIONS", () => {
  it("matches the documented lifecycle matrix", () => {
    expect(ALLOWED_REQUEST_TRANSITIONS).toEqual({
      open: ["in_progress", "pending_info", "cancelled"],
      in_progress: ["pending_info", "completed", "cancelled"],
      pending_info: ["in_progress", "completed", "cancelled"],
      completed: ["in_progress"],
      cancelled: [],
    });
  });

  it("covers every lifecycle status as a key and only known statuses as targets", () => {
    expect(Object.keys(ALLOWED_REQUEST_TRANSITIONS).sort()).toEqual(
      [...REQUEST_LIFECYCLE_STATUSES].sort(),
    );
    for (const targets of Object.values(ALLOWED_REQUEST_TRANSITIONS)) {
      for (const target of targets) {
        expect(REQUEST_LIFECYCLE_STATUSES).toContain(target);
      }
    }
  });

  it("cancelled is terminal: nothing leaves it", () => {
    expect(ALLOWED_REQUEST_TRANSITIONS.cancelled).toEqual([]);
  });

  it("completed can only reopen to in_progress", () => {
    expect(ALLOWED_REQUEST_TRANSITIONS.completed).toEqual(["in_progress"]);
  });
});

describe("canTransitionRequestStatus", () => {
  it("allows every explicitly listed transition", () => {
    const allowed: Array<[RequestLifecycleStatus, RequestLifecycleStatus]> = [
      ["open", "in_progress"],
      ["open", "pending_info"],
      ["open", "cancelled"],
      ["in_progress", "pending_info"],
      ["in_progress", "completed"],
      ["in_progress", "cancelled"],
      ["pending_info", "in_progress"],
      ["pending_info", "completed"],
      ["pending_info", "cancelled"],
      ["completed", "in_progress"],
    ];
    for (const [from, to] of allowed) {
      expect(canTransitionRequestStatus(from, to)).toBe(true);
    }
  });

  it("rejects illegal jumps", () => {
    const illegal: Array<[RequestLifecycleStatus, RequestLifecycleStatus]> = [
      // Skipping triage: work cannot complete without being started.
      ["open", "completed"],
      // Reopening backwards or resurrecting terminal states.
      ["in_progress", "open"],
      ["completed", "pending_info"],
      ["completed", "completed"],
      ["completed", "cancelled"],
      ["completed", "open"],
      ["cancelled", "open"],
      ["cancelled", "in_progress"],
      ["cancelled", "completed"],
      ["cancelled", "pending_info"],
      ["pending_info", "open"],
    ];
    for (const [from, to] of illegal) {
      expect(canTransitionRequestStatus(from, to)).toBe(false);
    }
  });

  it("rejects self-transitions: a no-op move is not a transition", () => {
    for (const status of REQUEST_LIFECYCLE_STATUSES) {
      expect(canTransitionRequestStatus(status, status)).toBe(false);
    }
  });
});

describe("ServiceRequestDomainError", () => {
  it("carries message, statusCode, and code", () => {
    const error = new ServiceRequestDomainError("Staff access is required for this operation.", 403, "STAFF_ACCESS_REQUIRED");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ServiceRequestDomainError);
    expect(error.name).toBe("ServiceRequestDomainError");
    expect(error.message).toBe("Staff access is required for this operation.");
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("STAFF_ACCESS_REQUIRED");
  });

  it("preserves distinct codes for distinct failure modes", () => {
    const codes = [
      new ServiceRequestDomainError("a", 401, "AUTH_REQUIRED").code,
      new ServiceRequestDomainError("b", 400, "INVALID_REQUEST_STATUS").code,
      new ServiceRequestDomainError("c", 400, "INVALID_TRANSITION").code,
      new ServiceRequestDomainError("d", 403, "STAFF_ACCESS_REQUIRED").code,
      new ServiceRequestDomainError("e", 500, "REQUEST_STATUS_NOT_SUPPORTED").code,
    ];
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("STAFF_ACTOR_ROLES", () => {
  it("grants staff actor status to analyst/admin/super_admin/internal and not to client", () => {
    expect(STAFF_ACTOR_ROLES).toContain("analyst");
    expect(STAFF_ACTOR_ROLES).toContain("admin");
    expect(STAFF_ACTOR_ROLES).toContain("super_admin");
    expect(STAFF_ACTOR_ROLES).toContain("internal");
    expect(STAFF_ACTOR_ROLES).not.toContain("client");
  });
});

describe("non-staff actors are forbidden on admin functions (error path, no DB)", () => {
  it("listServiceRequestsForAdmin rejects a client actor with STAFF_ACCESS_REQUIRED", async () => {
    await expect(
      listServiceRequestsForAdmin({ actor: clientActor }),
    ).rejects.toMatchObject({
      name: "ServiceRequestDomainError",
      statusCode: 403,
      code: "STAFF_ACCESS_REQUIRED",
    });
  });

  it("getServiceRequestForAdmin rejects a client actor before any lookup", async () => {
    await expect(
      getServiceRequestForAdmin("req_does_not_matter", clientActor),
    ).rejects.toMatchObject({ statusCode: 403, code: "STAFF_ACCESS_REQUIRED" });
  });

  it("assignServiceRequest rejects a client actor before any assignment work", async () => {
    await expect(
      assignServiceRequest("req_1", "assignee_1", clientActor, auditContext),
    ).rejects.toMatchObject({ statusCode: 403, code: "STAFF_ACCESS_REQUIRED" });
  });

  it("transitionServiceRequest rejects a client actor before any transition work", async () => {
    await expect(
      transitionServiceRequest("req_1", "completed", clientActor, auditContext),
    ).rejects.toMatchObject({ statusCode: 403, code: "STAFF_ACCESS_REQUIRED" });
  });

  it("rejects staff-role actors with a blank userId", async () => {
    const blankActor: ServiceRequestActor = { userId: "   ", role: "admin" };
    await expect(
      listServiceRequestsForAdmin({ actor: blankActor }),
    ).rejects.toMatchObject({ statusCode: 403, code: "STAFF_ACCESS_REQUIRED" });
  });

  it("rejects unknown roles", async () => {
    const unknownActor: ServiceRequestActor = { userId: "user-1", role: "owner" };
    await expect(
      transitionServiceRequest("req_1", "cancelled", unknownActor, auditContext),
    ).rejects.toMatchObject({ statusCode: 403, code: "STAFF_ACCESS_REQUIRED" });
  });

  it("the forbidden error message tells the caller staff access is required", async () => {
    const error = await listServiceRequestsForAdmin({ actor: clientActor }).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ServiceRequestDomainError);
    expect((error as ServiceRequestDomainError).message.toLowerCase()).toContain("staff");
  });
});
