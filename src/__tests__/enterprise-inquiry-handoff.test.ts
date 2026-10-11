import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import type { IntakeSubmissionRecord } from "@/lib/intake/types";
import { handoffEnterpriseInquiry } from "@/lib/enterpriseInquiryHandoff";
const mocks = vi.hoisted(() => ({ gate: vi.fn(), lookup: vi.fn(), audit: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: mocks.gate }));
vi.mock("@/lib/intake/repository", () => ({ getIntakeSubmission: mocks.lookup }));
vi.mock("@/lib/db", () => ({ db: { auditLog: { create: mocks.audit } } }));
vi.mock("@/lib/supabase-gateway", () => ({ hasDirectDatabaseConfiguration: mocks.configured }));
import { POST } from "@/app/api/admin/intake/handoff/route";
import { NextRequest } from "next/server";
const key = "test-only-handoff-key-at-least-32-characters";
const submission = { id: "intake-test-0001", publicId: "PUBLIC-TEST", kind: "ENTERPRISE", status: "RECEIVED", name: "Test applicant", email: "applicant@example.invalid", phone: null, organization: "Test", subject: "Inquiry", message: "Review this inquiry", consentVersion: "test-consent", privacyVersion: "test-privacy", consentGivenAt: new Date(), privacyAcceptedAt: new Date() } as IntakeSubmissionRecord;
describe("signed inquiry handoff", () => {
 beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); mocks.gate.mockResolvedValue({ ok: true, session: { userId: "admin-test" } }); mocks.lookup.mockResolvedValue({ submission }); mocks.configured.mockReturnValue(true); mocks.audit.mockResolvedValue({ id: "audit-test" }); });
 it("uses a fixed destination, signs stable bytes and never forwards selected roles", async () => {
  const fetcher = vi.fn(async () => Response.json({ captured: true, leadId: "lead-test", status: "AWAITING_APPROVAL", requestKey: "enterprise-inquiry-intake-test-0001" }));
  await handoffEnterpriseInquiry(submission, { key, sitesToken: "test-only-sites-token", now: 1000000000000, fetcher });
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://gem-social-command-center.p6kwdvjbpp.chatgpt.site/api/internal/enterprise-inquiry");
  const headers = options.headers as Record<string, string>;
  expect(headers["x-gem-signature"]).toBe(createHmac("sha256", key).update(`1000000000000.${options.body}`).digest("hex"));
  expect(options.redirect).toBe("error");
  expect(JSON.parse(String(options.body)).data).toMatchObject({ source: "enterprise-inquiry", contactPermission: "unknown" });
  expect(JSON.parse(String(options.body)).role).toBeUndefined();
 });
 it("rejects withdrawn consent, unrelated submissions and misleading receipts", async () => {
  const fetcher = vi.fn(async () => Response.json({ captured: true }));
  for (const changed of [{ kind: "COMMUNITY" }, { status: "DECLINED" }, { consentGivenAt: null }]) await expect(handoffEnterpriseInquiry({ ...submission, ...changed } as IntakeSubmissionRecord, { key, sitesToken: "test-only", fetcher })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(handoffEnterpriseInquiry(submission, { key, sitesToken: "test-only", fetcher })).rejects.toThrow("HANDOFF_UNVERIFIED");
 });
 it.each([401, 403])("denies unauthorized administrative capture (%s)", async status => {
  mocks.gate.mockResolvedValue({ ok: false, response: Response.json({}, { status }) });
  const response = await POST(new NextRequest("https://enterprise.test/api/admin/intake/handoff", { method: "POST" }));
  expect(response.status).toBe(status); expect(mocks.lookup).not.toHaveBeenCalled();
 });
 it("fails closed without mandatory audit and service configuration", async () => {
  const request = () => new NextRequest("https://enterprise.test/api/admin/intake/handoff", { method: "POST", body: JSON.stringify({ id: submission.id, confirmation: "CAPTURE_INQUIRY_FOR_REVIEW" }) });
  expect((await POST(request())).status).toBe(503); expect(mocks.lookup).not.toHaveBeenCalled();
  vi.stubEnv("GEM_ENTERPRISE_INQUIRY_HMAC_KEY", key); vi.stubEnv("GEM_LEAD_SITES_SERVICE_TOKEN", "test-only");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); mocks.audit.mockRejectedValue(new Error("test-only audit failure"));
  expect((await POST(request())).status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
 });
});
