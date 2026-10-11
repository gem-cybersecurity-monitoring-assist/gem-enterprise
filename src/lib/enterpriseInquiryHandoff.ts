import { createHmac } from "node:crypto";
import type { IntakeSubmissionRecord } from "@/lib/intake/types";
const TARGET = "https://gem-social-command-center.p6kwdvjbpp.chatgpt.site/api/internal/enterprise-inquiry";
export async function handoffEnterpriseInquiry(submission: IntakeSubmissionRecord, options: {
  key: string; sitesToken: string; now?: number; fetcher?: typeof fetch;
}) {
  if (options.key.length < 32 || !options.sitesToken) throw new Error("HANDOFF_NOT_CONFIGURED");
  if (submission.kind !== "ENTERPRISE" || ["DECLINED", "CLOSED"].includes(submission.status) ||
      !submission.consentVersion || !submission.privacyVersion || !submission.consentGivenAt || !submission.privacyAcceptedAt ||
      !Number.isFinite(new Date(submission.consentGivenAt).getTime()) ||
      !Number.isFinite(new Date(submission.privacyAcceptedAt).getTime())) throw new Error("INQUIRY_NOT_ELIGIBLE");
  const requestKey = `enterprise-inquiry-${submission.id}`;
  const body = JSON.stringify({ requestKey, data: {
    name: submission.name, email: submission.email, phone: submission.phone || "",
    organization: submission.organization || "", service: "general", source: "enterprise-inquiry",
    sourceUrl: "https://www.gemcybersecurityassist.com/enterprise-solutions",
    notes: `${submission.subject}\n${submission.message}`, contactPermission: "unknown",
    permissionEvidence: `Intake ${submission.publicId}; processing consent ${submission.consentVersion}; privacy ${submission.privacyVersion}. Contact authorization requires separate review.`,
  } });
  const timestamp = String(options.now ?? Date.now());
  const signature = createHmac("sha256", options.key).update(`${timestamp}.${body}`).digest("hex");
  const response = await (options.fetcher ?? fetch)(TARGET, {
    method: "POST", headers: { "content-type": "application/json", "x-gem-timestamp": timestamp,
      "x-gem-signature": signature, "OAI-Sites-Authorization": `Bearer ${options.sitesToken}` },
    body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(response.status === 409 ? "HANDOFF_REQUIRES_REVIEW" : "HANDOFF_UNAVAILABLE");
  const receipt = await response.json() as { captured?: boolean; leadId?: string; status?: string; requestKey?: string; replayed?: boolean };
  if (receipt.captured !== true || typeof receipt.leadId !== "string" || !receipt.leadId ||
      receipt.requestKey !== requestKey || typeof receipt.status !== "string") throw new Error("HANDOFF_UNVERIFIED");
  return { leadId: receipt.leadId, status: receipt.status, requestKey, replayed: receipt.replayed === true };
}
