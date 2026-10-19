import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  compileAdsBridgePlan,
  gemBusinessReviewAdsDraft,
} from "@/lib/ads-bridge/policy";
import {
  AdsBridgeAuthError,
  requireAdsBridgeAuth,
} from "@/lib/ads-bridge/auth";

describe("GEM zero-spend Ads Bridge", () => {
  it("compiles the approved GEM Business Review package deterministically", () => {
    const first = compileAdsBridgePlan(gemBusinessReviewAdsDraft);
    const second = compileAdsBridgePlan({ ...gemBusinessReviewAdsDraft });

    expect(first.versionHash).toBe(second.versionHash);
    expect(first.readiness.draft).toBe("READY");
    expect(first.readiness.paidDelivery).toBe("BLOCKED");
    expect(first.adsManagerHandoff).toMatchObject({
      title: "Know What to Fix First",
      body: "Qualified teams: $199 review and 30-day plan.",
      targetUrl: "https://www.gemcybersecurityassist.com/business-review",
      status: "PAUSED",
      budgetUsd: 0,
      syncMode: "PREVIEW_ONLY",
      externalActionTaken: false,
    });
  });

  it("rejects active delivery and every positive budget", () => {
    expect(() =>
      compileAdsBridgePlan({ ...gemBusinessReviewAdsDraft, status: "ACTIVE" }),
    ).toThrow();
    expect(() =>
      compileAdsBridgePlan({ ...gemBusinessReviewAdsDraft, budgetUsd: 1 }),
    ).toThrow();
  });

  it("rejects billing, provider writes, and billing-bypass requests", () => {
    expect(() =>
      compileAdsBridgePlan({
        ...gemBusinessReviewAdsDraft,
        billingConfigured: true,
      }),
    ).toThrow();
    expect(() =>
      compileAdsBridgePlan({
        ...gemBusinessReviewAdsDraft,
        requestProviderWrite: true,
      }),
    ).toThrow();
    expect(() =>
      compileAdsBridgePlan({
        ...gemBusinessReviewAdsDraft,
        bypassProviderBilling: true,
      }),
    ).toThrow();
  });

  it("keeps the organic export in draft, compliance, and approval state", () => {
    const plan = compileAdsBridgePlan(gemBusinessReviewAdsDraft);

    expect(plan.organicPackage).toMatchObject({
      state: "DRAFT",
      approvalRequired: true,
      complianceReviewRequired: true,
      externalActionTaken: false,
    });
    expect(plan.safeguards.automaticPublishing).toBe(false);
  });

  it("restricts destinations to the official GEM HTTPS domain", () => {
    expect(() =>
      compileAdsBridgePlan({
        ...gemBusinessReviewAdsDraft,
        destination: "https://example.com/business-review",
      }),
    ).toThrow();
    expect(() =>
      compileAdsBridgePlan({
        ...gemBusinessReviewAdsDraft,
        destination:
          "https://www.gemcybersecurityassist.com/business-review?oppref=unsafe",
      }),
    ).toThrow();
  });

  it("keeps the API admin-only and free of provider writes", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/admin/ads-bridge/route.ts"),
      "utf8",
    );

    expect(route).toContain("requireAdmin");
    expect(route).toContain("externalActionTaken: false");
    expect(route).not.toContain("fetch(");
    expect(route).not.toContain("OPENAI_API_KEY");
    expect(route).not.toContain("Authorization");
  });

  it("exposes a bearer-protected machine connection without provider writes", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/v1/ads-bridge/route.ts"),
      "utf8",
    );
    const auth = readFileSync(
      join(process.cwd(), "src/lib/ads-bridge/auth.ts"),
      "utf8",
    );
    const openApi = readFileSync(
      join(process.cwd(), "openapi/gem-ads-bridge.openapi.yaml"),
      "utf8",
    );

    expect(route).toContain("requireAdsBridgeAuth");
    expect(route).toContain("externalActionTaken: false");
    expect(route).not.toContain("fetch(");
    expect(auth).toContain("ADS_BRIDGE_AUTH_TOKEN");
    expect(auth).toContain("timingSafeEqual");
    expect(openApi).toContain("operationId: evaluateGemAdsBridgePlan");
    expect(openApi).toContain("x-openai-isConsequential: false");
  });

  it("fails closed for missing or invalid machine credentials", () => {
    const previous = process.env.ADS_BRIDGE_AUTH_TOKEN;
    const configured = "test-only-ads-bridge-token-1234567890";
    try {
      delete process.env.ADS_BRIDGE_AUTH_TOKEN;
      expect(() =>
        requireAdsBridgeAuth(
          new NextRequest("https://www.gemcybersecurityassist.com/api/v1/ads-bridge"),
        ),
      ).toThrowError(AdsBridgeAuthError);

      process.env.ADS_BRIDGE_AUTH_TOKEN = configured;
      expect(() =>
        requireAdsBridgeAuth(
          new NextRequest("https://www.gemcybersecurityassist.com/api/v1/ads-bridge", {
            headers: { authorization: "Bearer invalid" },
          }),
        ),
      ).toThrowError(AdsBridgeAuthError);

      expect(
        requireAdsBridgeAuth(
          new NextRequest("https://www.gemcybersecurityassist.com/api/v1/ads-bridge", {
            headers: { authorization: `Bearer ${configured}` },
          }),
        ),
      ).toEqual({ principal: "gem-ads-bridge-client", mode: "server_to_server" });
    } finally {
      if (previous === undefined) delete process.env.ADS_BRIDGE_AUTH_TOKEN;
      else process.env.ADS_BRIDGE_AUTH_TOKEN = previous;
    }
  });
});
