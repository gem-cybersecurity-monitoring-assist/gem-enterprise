import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), update: vi.fn(), version: vi.fn(), audit: vi.fn(), transaction: vi.fn(), verify: vi.fn(), compare: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.lookup }, $transaction: mocks.transaction } }));
vi.mock("@/lib/passwordReset", () => ({ verifyPasswordResetToken: mocks.verify, fingerprintPasswordHash: () => "fingerprint", passwordFingerprintsMatch: () => true }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
import { completePasswordReset } from "@/lib/passwordResetService";

describe("password reset atomic revocation", () => {
  let committed: boolean;
  beforeEach(() => {
    vi.clearAllMocks();
    committed = false;
    mocks.verify.mockResolvedValue({ userId: "u1", email: "member@example.test", passwordFingerprint: "fingerprint" });
    mocks.lookup.mockResolvedValue({ id: "u1", email: "member@example.test", passwordHash: "old-hash", sessionVersion: 4, isActive: true, status: "active" });
    mocks.compare.mockResolvedValue(false); mocks.hash.mockResolvedValue("new-hash");
    mocks.update.mockResolvedValue({ count: 1 }); mocks.version.mockResolvedValue({ sessionVersion: 5 }); mocks.audit.mockResolvedValue({ id: "a1" });
    mocks.transaction.mockImplementation(async callback => {
      const result = await callback({ user: { updateMany: mocks.update, findUnique: mocks.version }, auditLog: { findFirst: mocks.audit } });
      committed = true;
      return result;
    });
  });
  it("commits only after both trigger revocation and its audit record are observed", async () => {
    expect(await completePasswordReset("test-only", "Test-only-new-password1!")).toMatchObject({ ok: true, sessionsRevoked: true, auditRecorded: true, sessionVersion: 5 });
    expect(committed).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sessionVersion: 4, passwordHash: "old-hash", isActive: true, status: "active", email: "member@example.test" }) }));
  });
  it.each([null, { sessionVersion: 4 }])("rolls back when the revocation trigger did not run (%j)", async version => {
    mocks.version.mockResolvedValue(version);
    expect(await completePasswordReset("test-only", "Test-only-new-password1!")).toEqual({ ok: false, code: "service_unavailable" });
    expect(committed).toBe(false);
  });
  it("rolls back when revocation lacks its audit record", async () => {
    mocks.audit.mockResolvedValue(null);
    expect(await completePasswordReset("test-only", "Test-only-new-password1!")).toEqual({ ok: false, code: "service_unavailable" });
    expect(committed).toBe(false);
  });
  it("rejects replay or a concurrent account change without claiming success", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect(await completePasswordReset("test-only", "Test-only-new-password1!")).toEqual({ ok: false, code: "invalid_token" });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("reports lookup outages without exposing database details", async () => {
    mocks.lookup.mockRejectedValue(new Error("test-only database unavailable"));
    expect(await completePasswordReset("test-only", "Test-only-new-password1!")).toEqual({ ok: false, code: "service_unavailable" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

});
