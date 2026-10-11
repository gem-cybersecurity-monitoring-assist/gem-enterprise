import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  latestApplication: vi.fn(),
  toView: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/kyc/service", () => ({
  getLatestVerificationApplication: mocks.latestApplication,
  toVerificationApplicationView: mocks.toView,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import VerificationStatusPage from "@/app/kyc/status/page";

describe("KYC status page gateway safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not query the Prisma verification service for authenticated gateway users", async () => {
    mocks.getSession.mockResolvedValue({
      userId: "gateway-client",
      role: "client",
      authSource: "supabase_gateway",
    });
    const response = await VerificationStatusPage();
    expect(mocks.latestApplication).not.toHaveBeenCalled();
    expect(mocks.toView).not.toHaveBeenCalled();
    expect(response.props.children[0].props.children).toBe("Verification status temporarily unavailable");
    expect(response.props.children[1].props.children).toContain("Signing in again will not resolve");
  });

  it("retains direct-database status lookup for authorized local sessions", async () => {
    mocks.getSession.mockResolvedValue({
      userId: "local-client",
      role: "client",
      authSource: "local",
    });
    mocks.latestApplication.mockResolvedValue(null);
    const response = await VerificationStatusPage();
    expect(mocks.latestApplication).toHaveBeenCalledOnce();
    expect(mocks.latestApplication).toHaveBeenCalledWith("local-client");
    expect(response.props.children[0].props.children).toBe("No application found");
  });

  it("redirects unauthenticated requests before attempting a status lookup", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });
    await expect(VerificationStatusPage()).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/client-login?next=/kyc/status");
    expect(mocks.latestApplication).not.toHaveBeenCalled();
  });
});
