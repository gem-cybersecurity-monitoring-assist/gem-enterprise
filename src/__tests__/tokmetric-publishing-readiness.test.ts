import { describe, expect, it } from "vitest";
import { explainTokMetricPublishingContextError } from "@/lib/tokmetric/publishing/readiness";

describe("Video Studio publishing readiness guidance", () => {
  it("identifies the gateway persistence blocker without misdirecting users to sign in", () => {
    const guidance = explainTokMetricPublishingContextError(
      "TOKMETRIC_GATEWAY_BACKEND_REQUIRED",
      "TokMetric workspace operations are unavailable",
    );
    expect(guidance.title).toContain("connected");
    expect(guidance.detail).toContain("Supabase gateway");
    expect(guidance.detail).toContain("will not activate publishing");
    expect(guidance.retryable).toBe(false);
  });
  it("asks for sign-in only on actual unauthenticated errors", () => {
    const guidance = explainTokMetricPublishingContextError("UNAUTHENTICATED", "Authentication is required.");
    expect(guidance.title).toBe("Sign in to GEM Enterprise");
    expect(guidance.retryable).toBe(true);
  });
  it("keeps disabled accounts from being misrepresented as temporarily offline", () => {
    for (const code of ["ACCOUNT_NOT_ACTIVE", "WORKSPACE_FORBIDDEN"]) {
      const guidance = explainTokMetricPublishingContextError(code, "Denied");
      expect(guidance.retryable).toBe(false);
      expect(guidance.detail).toContain("publishing permissions");
    }
  });
  it("allows rechecking a transient outage without claiming a video was sent", () => {
    const guidance = explainTokMetricPublishingContextError("PUBLISHING_REQUEST_FAILED", "Connection timed out.");
    expect(guidance.title).toContain("readiness");
    expect(guidance.detail).toBe("Connection timed out.");
    expect(guidance.retryable).toBe(true);
  });
  it("uses a safe fallback if the service supplies no explanation", () => {
    expect(explainTokMetricPublishingContextError(null, " ").detail).toContain("temporarily unavailable");
  });
});
