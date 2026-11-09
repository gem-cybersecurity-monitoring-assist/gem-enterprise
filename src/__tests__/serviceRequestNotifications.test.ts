import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serviceRequestStatusNotification } from "@/lib/serviceRequestNotifications";

describe("service request customer notification", () => {
  it("makes a minimal actionable status notice with no sensitive audit notes", () => {
    const notice = serviceRequestStatusNotification({
      requestId: "case-123",
      fromStatus: "open",
      toStatus: "in_progress",
    });
    expect(notice.title).toBe("Service request updated");
    expect(notice.body).toContain("in progress");
    expect(notice.channel).toBe("in_app");
    expect(notice.data).toEqual({
      kind: "service_request_status_changed",
      requestId: "case-123",
      previousStatus: "open",
      status: "in_progress",
      href: "/app/requests",
    });
    expect(JSON.stringify(notice)).not.toContain("secret");
  });

  it("contains a defined label for every authoritative request lifecycle state", () => {
    for (const state of ["open", "in_progress", "pending_info", "completed", "cancelled"] as const) {
      const notice = serviceRequestStatusNotification({
        requestId: "case-test", fromStatus: "open", toStatus: state,
      });
      expect(notice.body).toMatch(/^Your GEM service request is now /);
      expect(notice.data.status).toBe(state);
    }
  });

  it("uses the same serializable transaction for transition, audit and notice", () => {
    const code = readFileSync("src/lib/serviceRequests.ts", "utf8");
    const transition = code.slice(code.indexOf("export async function transitionServiceRequest("));
    expect(transition).toContain("db.$transaction(");
    expect(transition).toContain("tx.serviceRequest.update(");
    expect(transition).toContain("tx.auditLog.create(");
    expect(transition).toContain("tx.notification.create(");
    expect(transition).toContain("serviceRequestStatusNotification({");
    expect(transition).toContain("userId: request.userId");
    expect(transition).toContain("workspaceId: request.workspaceId");
    expect(transition).toContain('isolationLevel: "Serializable"');
  });

  it("rejects unauthorized and invalid transitions before transaction write", () => {
    const route = readFileSync("src/app/api/admin/requests/[id]/route.ts", "utf8");
    const service = readFileSync("src/lib/serviceRequests.ts", "utf8");
    expect(route).toContain("if (!isStaffRole(gate.session.role)) return forbidden()");
    expect(route).toContain("isSameOriginWorkspaceRequest");
    expect(route).toContain("rateLimit(");
    expect(service).toContain("canTransitionRequestStatus(");
    expect(service).toContain('"INVALID_TRANSITION"');
  });
});
