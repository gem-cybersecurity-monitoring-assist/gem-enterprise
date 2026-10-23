import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createProposalToken,
  GEM_MARKET_PAYMENT_LINK_ID,
  GEM_MARKET_PAYMENT_LINK_URL,
  GEM_MARKET_STRIPE_ACCOUNT_ID,
  getMarketPaymentReadiness,
  verifyProposalToken,
  verifyStripeWebhookSignature,
} from "@/lib/market/proposal";

const secret = "market-proposal-test-secret-that-is-long-enough-123456";

describe("market proposal and payment handoff", () => {
  it("signs and verifies bounded proposal links", () => {
    const token = createProposalToken(
      { intakeId: "intake-123", publicId: "GEM-ENT-20260831-ABC", ttlSeconds: 600 },
      secret,
    );
    expect(verifyProposalToken(token, secret)).toMatchObject({
      v: 1,
      intakeId: "intake-123",
      publicId: "GEM-ENT-20260831-ABC",
    });
    expect(verifyProposalToken(`${token}tampered`, secret)).toBeNull();
  });

  it("allows governed production checkout before webhook automation is configured", () => {
    const preview = getMarketPaymentReadiness({
      VERCEL_ENV: "preview",
      JWT_SECRET: secret,
    });
    expect(preview.proposalSigningReady).toBe(true);
    expect(preview.checkoutReady).toBe(false);
    expect(preview.blockers).toContain("Live market checkout is available only in production.");

    const productionWithoutWebhook = getMarketPaymentReadiness({
      VERCEL_ENV: "production",
      JWT_SECRET: secret,
    });
    expect(productionWithoutWebhook.checkoutReady).toBe(true);
    expect(productionWithoutWebhook.stripeWebhookReady).toBe(false);
    expect(productionWithoutWebhook.blockers).not.toContain(
      "GEM_STRIPE_WEBHOOK_SECRET is not configured.",
    );

    const productionWithWebhook = getMarketPaymentReadiness({
      VERCEL_ENV: "production",
      JWT_SECRET: secret,
      GEM_STRIPE_WEBHOOK_SECRET: "whsec_example",
    });
    expect(productionWithWebhook.checkoutReady).toBe(true);
    expect(productionWithWebhook.stripeWebhookReady).toBe(true);
    expect(productionWithWebhook.stripeAccountPinned).toBe(true);
    expect(productionWithWebhook.stripeAccountVerified).toBe(true);
    expect(productionWithWebhook.paymentLinkPinned).toBe(true);
    expect(productionWithWebhook.stripeMode).toBe("live");
  });

  it("rejects contradictory merchant configuration", () => {
    const blocked = getMarketPaymentReadiness({
      VERCEL_ENV: "production",
      JWT_SECRET: secret,
      GEM_STRIPE_ACCOUNT_ID: "acct_wrong",
      GEM_STRIPE_MODE: "test",
      GEM_STRIPE_ACCOUNT_VERIFIED: "false",
    });
    expect(blocked.checkoutReady).toBe(false);
    expect(blocked.blockers).toContain(
      "GEM_STRIPE_ACCOUNT_ID conflicts with the authorized live merchant account.",
    );
  });

  it("verifies Stripe webhook signatures with timestamp tolerance", () => {
    const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const timestamp = 1_788_211_200;
    const webhookSecret = "whsec_test_secret";
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    expect(
      verifyStripeWebhookSignature({
        payload,
        header: `t=${timestamp},v1=${signature}`,
        secret: webhookSecret,
        nowSeconds: timestamp + 30,
      }),
    ).toBe(true);
    expect(
      verifyStripeWebhookSignature({
        payload,
        header: `t=${timestamp},v1=${signature}`,
        secret: webhookSecret,
        nowSeconds: timestamp + 1_000,
      }),
    ).toBe(false);
  });

  it("locks checkout to approved intake and routes only to the pinned live Payment Link", () => {
    const checkout = readFileSync("src/app/api/market/checkout/route.ts", "utf8");
    const webhook = readFileSync("src/app/api/market/stripe/webhook/route.ts", "utf8");
    const workflow = readFileSync("src/lib/intake/workflow.ts", "utf8");
    expect(checkout).toContain('result.submission.status !== "APPROVED"');
    expect(checkout).toContain("GEM_MARKET_PAYMENT_LINK_URL");
    expect(checkout).toContain('paymentUrl.searchParams.set("client_reference_id"');
    expect(checkout).not.toContain("GEM_STRIPE_SECRET_KEY");
    expect(GEM_MARKET_STRIPE_ACCOUNT_ID).toBe("acct_1TkrtxCKnPeVL2Jw");
    expect(GEM_MARKET_PAYMENT_LINK_ID).toBe("plink_1UAeuoCKnPeVL2JwrLMswd31");
    expect(GEM_MARKET_PAYMENT_LINK_URL).toBe("https://buy.stripe.com/eVqfZgeQ58DX9wC7I9b3q00");
    expect(webhook).toContain("GEM_MARKET_PAYMENT_LINK_ID");
    expect(webhook).toContain("paymentLinkMatches");
    expect(webhook).toContain("verifyStripeWebhookSignature");
    expect(webhook).toContain("amountMatches");
    expect(webhook).toContain("convertApprovedIntakeAfterVerifiedPayment");
    expect(workflow).toContain('APPROVED: ["CONVERTED", "CLOSED"]');
  });

  it("adds a fail-closed Klarna app handoff with direct and provider-backed transports", () => {
    const handoff = readFileSync("src/app/api/market/klarna/handoff/route.ts", "utf8");
    const button = readFileSync("src/components/market/ProposalCheckoutButton.tsx", "utf8");

    expect(handoff).toContain('result.submission.status !== "APPROVED"');
    expect(handoff).toContain('type: "HANDOVER"');
    expect(handoff).toContain("payment_request_url");
    expect(handoff).toContain('url.hostname === "pay.klarna.com"');
    expect(handoff).toContain('url.hostname === "pay.test.klarna.com"');
    expect(handoff).toContain('handoff: "klarna_app"');
    expect(handoff).toContain("KLARNA_APP_HANDOFF_NOT_CONFIGURED");
    expect(handoff).toContain("GEM_KLARNA_PROVIDER_HANDOFF_URL");
    expect(handoff).toContain("GEM_KLARNA_PROVIDER_TOKEN");
    expect(handoff).toContain('mode: "provider"');
    expect(handoff).toContain('mode: "direct"');
    expect(handoff).toContain("return provider || direct");
    expect(handoff).not.toContain("window.location");
    expect(button).toContain('/api/market/klarna/handoff');
    expect(button).toContain("Open Klarna app");
    expect(button).toContain("window.location.assign(result.url)");
  });

  it("never turns a Stripe webhook directly into workspace access", () => {
    const webhook = readFileSync("src/app/api/market/stripe/webhook/route.ts", "utf8");
    const onboarding = readFileSync("src/components/market/ConvertedClientOnboarding.tsx", "utf8");
    const invitationRoute = readFileSync("src/app/api/admin/workspace-invitations/route.ts", "utf8");

    expect(webhook).not.toContain("workspace-invitations");
    expect(webhook).not.toContain("workspaceOwnerInvitationGateway");
    expect(onboarding).toContain('viewerRole === "super_admin"');
    expect(onboarding).toContain('/api/admin/workspace-invitations');
    expect(onboarding).toContain("Confirm owner email exactly");
    expect(invitationRoute).toContain("requirePlatformOwner");
  });
});
