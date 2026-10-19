import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMocks = vi.hoisted(() => ({ requireStaff: vi.fn() }));
const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  perform: vi.fn(),
  toView: vi.fn((value: unknown) => value),
}));

vi.mock("@/lib/api/auth-helpers", () => ({
  requireStaff: authMocks.requireStaff,
  getRequestContext: () => ({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));
vi.mock("@/lib/audit", () => ({ emitAuditLog: vi.fn() }));
vi.mock("@/lib/kyc/workflow", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/kyc/workflow")>();
  return original;
});
vi.mock("@/lib/kyc/service", () => {
  class VerificationServiceError extends Error {
    code = "TEST";
    statusCode = 409;
    details = undefined;
  }
  return {
    listVerificationReviewQueue: serviceMocks.list,
    performVerificationReviewAction: serviceMocks.perform,
    toVerificationApplicationView: serviceMocks.toView,
    VerificationServiceError,
  };
});

import { GET, POST } from "@/app/api/verify/review/route";

describe("verification review API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireStaff.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(serviceMocks.list).not.toHaveBeenCalled();
  });

  it("returns 403 when a client attempts to use the staff queue", async () => {
    authMocks.requireStaff.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("rejects an unknown review action before any database mutation", async () => {
    authMocks.requireStaff.mockResolvedValue({
      ok: true,
      session: { userId: "reviewer-1", role: "analyst" },
    });
    const request = new NextRequest("http://localhost/api/verify/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: "app-1", action: "auto_approve" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(serviceMocks.perform).not.toHaveBeenCalled();
  });
});
