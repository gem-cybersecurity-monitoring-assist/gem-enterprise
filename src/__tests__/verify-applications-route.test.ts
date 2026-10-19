import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMocks = vi.hoisted(() => ({ requireSession: vi.fn() }));
const serviceMocks = vi.hoisted(() => ({
  getLatest: vi.fn(),
  save: vi.fn(),
  toView: vi.fn((value: unknown) => value),
}));

vi.mock("@/lib/api/auth-helpers", () => ({
  requireSession: authMocks.requireSession,
  getRequestContext: () => ({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/audit", () => ({ emitAuditLog: vi.fn() }));

vi.mock("@/lib/kyc/service", () => {
  class VerificationServiceError extends Error {
    code = "TEST";
    statusCode = 409;
    details = undefined;
  }
  return {
    getLatestVerificationApplication: serviceMocks.getLatest,
    saveVerificationApplication: serviceMocks.save,
    toVerificationApplicationView: serviceMocks.toView,
    VerificationServiceError,
  };
});

import { GET, POST } from "@/app/api/verify/applications/route";

describe("verification application API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authenticated session exists", async () => {
    authMocks.requireSession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET();
    expect(response.status).toBe(401);
    expect(serviceMocks.getLatest).not.toHaveBeenCalled();
  });

  it("scopes applicant status lookup to the session user id", async () => {
    authMocks.requireSession.mockResolvedValue({
      ok: true,
      session: { userId: "user-1", role: "client" },
    });
    serviceMocks.getLatest.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(serviceMocks.getLatest).toHaveBeenCalledWith("user-1");
  });

  it("rejects prohibited extra fields instead of collecting them", async () => {
    authMocks.requireSession.mockResolvedValue({
      ok: true,
      session: { userId: "user-1", role: "client" },
    });

    const request = new NextRequest("http://localhost/api/verify/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "individual",
        legalName: "Test Applicant",
        country: "Nigeria",
        serviceInterest: "Cybersecurity assessment",
        governmentIdNumber: "must-not-be-collected",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(serviceMocks.save).not.toHaveBeenCalled();
  });
});
