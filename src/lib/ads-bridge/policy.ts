import { createHash } from "node:crypto";
import { z } from "zod";
import {
  createSocialContentPackage,
  type SocialContentType,
} from "@/lib/social-media/policy";
import type { SocialMediaProviderId } from "@/lib/social-media/providers";

export const adsBridgeOrganicTargets = [
  "LINKEDIN_COMPANY",
  "FACEBOOK_PAGE",
  "X",
] as const satisfies readonly SocialMediaProviderId[];

const paidProviderTrackingParams = new Set(["oppref", "olref"]);

const destinationSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "gemcybersecurityassist.com" ||
        url.hostname === "www.gemcybersecurityassist.com")
    );
  }, "Destination must use the official GEM HTTPS domain")
  .refine((value) => {
    const url = new URL(value);
    return ![...paidProviderTrackingParams].some((key) =>
      url.searchParams.has(key),
    );
  }, "Provider-owned tracking parameters are not accepted in bridge drafts");

export const adsBridgeDraftSchema = z
  .object({
    mode: z.literal("ZERO_SPEND"),
    advertiserName: z.string().trim().min(1).max(80),
    offerName: z.string().trim().min(1).max(120),
    headline: z.string().trim().min(3).max(50),
    body: z.string().trim().min(1).max(100),
    destination: destinationSchema,
    creativePath: z.string().regex(/^\/images\/[a-zA-Z0-9._/-]+$/),
    market: z.literal("US"),
    objective: z.literal("CLICKS"),
    status: z.literal("PAUSED"),
    budgetUsd: z.literal(0),
    billingConfigured: z.literal(false),
    requestProviderWrite: z.literal(false),
    bypassProviderBilling: z.literal(false),
    organicTargets: z
      .array(z.enum(adsBridgeOrganicTargets))
      .min(1)
      .default([...adsBridgeOrganicTargets]),
  })
  .strict();

export type AdsBridgeDraft = z.infer<typeof adsBridgeDraftSchema>;

export const gemBusinessReviewAdsDraft: AdsBridgeDraft = {
  mode: "ZERO_SPEND",
  advertiserName: "GEM Enterprise",
  offerName: "GEM Business Security & Operations Review",
  headline: "Know What to Fix First",
  body: "Qualified teams: $199 review and 30-day plan.",
  destination: "https://www.gemcybersecurityassist.com/business-review",
  creativePath: "/images/gem-enterprise-logo.svg",
  market: "US",
  objective: "CLICKS",
  status: "PAUSED",
  budgetUsd: 0,
  billingConfigured: false,
  requestProviderWrite: false,
  bypassProviderBilling: false,
  organicTargets: [...adsBridgeOrganicTargets],
};

export type AdsBridgePlan = ReturnType<typeof compileAdsBridgePlan>;

function stableHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function compileAdsBridgePlan(input: unknown) {
  const draft = adsBridgeDraftSchema.parse(input);
  const contentType: SocialContentType = "LINK";
  const organicPackage = createSocialContentPackage({
    title: draft.headline,
    summary: draft.body,
    callToAction: "Request the founding review",
    sourceReference: draft.destination,
    targets: draft.organicTargets,
    contentType,
  });

  const normalizedDraft = {
    ...draft,
    advertiserName: draft.advertiserName.trim(),
    offerName: draft.offerName.trim(),
    headline: draft.headline.trim(),
    body: draft.body.trim(),
  };

  return {
    versionHash: stableHash(normalizedDraft),
    mode: "ZERO_SPEND" as const,
    readiness: {
      draft: "READY" as const,
      organicHandoff: "READY_FOR_REVIEW" as const,
      paidDelivery: "BLOCKED" as const,
      blockers: [
        "PROVIDER_BILLING_REQUIRED",
        "POSITIVE_PROVIDER_BUDGET_REQUIRED",
        "EXTERNAL_PROVIDER_ACTIVATION_REQUIRED",
      ] as const,
    },
    safeguards: {
      billingConfigured: false as const,
      providerWriteEnabled: false as const,
      externalActionTaken: false as const,
      automaticPublishing: false as const,
      approvalRequired: true as const,
    },
    adsManagerHandoff: {
      advertiserName: normalizedDraft.advertiserName,
      offerName: normalizedDraft.offerName,
      title: normalizedDraft.headline,
      body: normalizedDraft.body,
      targetUrl: normalizedDraft.destination,
      creativePath: normalizedDraft.creativePath,
      market: normalizedDraft.market,
      objective: normalizedDraft.objective,
      status: normalizedDraft.status,
      budgetUsd: normalizedDraft.budgetUsd,
      syncMode: "PREVIEW_ONLY" as const,
      externalActionTaken: false as const,
    },
    organicPackage,
  };
}

