import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_REQUEST_TRANSITIONS, REQUEST_LIFECYCLE_STATUSES } from "@/lib/serviceRequests";

const read = (path: string) => readFileSync(path, "utf8");

describe("SaaS administrative service operations", () => {
  it("uses authoritative case lifecycle and keeps cancelled requests terminal", () => {
    expect(REQUEST_LIFECYCLE_STATUSES).toEqual([
      "open", "in_progress", "pending_info", "completed", "cancelled",
    ]);
    expect(ALLOWED_REQUEST_TRANSITIONS.cancelled).toHaveLength(0);
    expect(ALLOWED_REQUEST_TRANSITIONS.completed).toEqual(["in_progress"]);
    const queue = read("src/components/command-center/SaaSServiceQueue.tsx");
    for (const status of REQUEST_LIFECYCLE_STATUSES) {
      expect(queue).toContain(status);
    }
    expect(queue).toContain("transitions[selected.status].includes(nextStatus)");
  });

  it("uses existing authenticated and audited staff routes rather than a new writing bypass", () => {
    const queue = read("src/components/command-center/SaaSServiceQueue.tsx");
    const adminRead = read("src/app/api/admin/requests/route.ts");
    const adminWrite = read("src/app/api/admin/requests/[id]/route.ts");
    expect(queue).toContain('fetch(`/api/admin/requests?');
    expect(queue).toContain('fetch(`/api/admin/requests/${encodeURIComponent(selected.id)}`');
    expect(queue).toContain('method: "PATCH"');
    expect(queue).toContain('credentials: "same-origin"');
    expect(queue).toContain('cache: "no-store"');
    expect(queue).toContain('action: "transition"');
    expect(queue).toContain("if (!selected || !nextStatus || saving");
    expect(adminRead).toContain("isStaffRole(gate.session.role)");
    expect(adminWrite).toContain("isSameOriginWorkspaceRequest");
    expect(adminWrite).toContain("rateLimit(");
    expect(adminWrite).toContain("transitionServiceRequest");
    expect(read("src/lib/serviceRequests.ts")).toContain("tx.auditLog.create");
  });

  it("protects the SaaS page with admin authorization and no indexing", () => {
    const page = read("src/app/app/command-center/saas/service-operations/page.tsx");
    expect(page).toContain("await requireAdmin()");
    expect(page).toContain("if (!gate.ok)");
    expect(page).toContain('robots: { index: false');
    expect(page).toContain("<SaaSServiceQueue />");
  });

  it("keeps requests user-initiated with a named save step and audit note", () => {
    const queue = read("src/components/command-center/SaaSServiceQueue.tsx");
    expect(queue).toContain("Confirm a case transition");
    expect(queue).toContain("Save audited transition");
    expect(queue).toContain("maxLength={1000}");
    expect(queue).toContain("No change occurs until you select Save.");
    expect(queue).toContain("setWriteError");
    expect(queue).not.toContain("localStorage");
  });
});
