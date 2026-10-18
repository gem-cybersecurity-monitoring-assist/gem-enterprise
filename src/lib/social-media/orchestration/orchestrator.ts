import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  contentHash,
  emitDomainEvent,
  emitTokMetricAudit,
  TokMetricError,
} from "@/lib/tokmetric/security";
import {
  createContentDraft,
  requestContentApproval,
  runComplianceReview,
} from "@/lib/tokmetric/workflow";
import {
  buildAdaptiveDailyContentPlan,
  type ApprovedSourceMaterial,
  type DailyContentPlan,
  type MarketSignal,
} from "../planning/daily-flow";
import type { SocialMediaProviderId } from "../providers";
import { generateCrossPlatformContentPackage } from "./content-package";
import { getGemApprovedSourceMaterial } from "./gem-sources";
import {
  applyEngagementLearning,
  loadCurrentMarketSignals,
  loadGeneratedContentHistory,
  mergeMarketSignals,
} from "./intelligence";

export interface DailyContentOrchestrationInput {
  workspaceId: string;
  actorId: string;
  correlationId: string;
  planDate: Date;
  enabledProviders: readonly SocialMediaProviderId[];
  marketSignals?: readonly MarketSignal[];
  approvedSources?: readonly ApprovedSourceMaterial[];
  useGemCatalog?: boolean;
  gemProductSlugs?: readonly string[];
  localContext?: string;
  minimumTikTokItems?: number;
  maxItemsPerOtherProvider?: number;
  // Accepted for API compatibility while AUTO_POLICY orchestration remains fail-closed.
  providerTargets?: Partial<Record<SocialMediaProviderId, number>>;
  approvalMode?: "HUMAN" | "AUTO_POLICY";
  freshnessWindowDays?: number | null;
  requestApprovals?: boolean;
  forceRegenerate?: boolean;
}

export interface MaterializedContentResult {
  contentId: string;
  contentVersionId: string;
  provider: SocialMediaProviderId;
  fingerprint: string;
  complianceReviewId: string;
  complianceResult: string;
  approvalRequestId?: string;
  state:
    | "AWAITING_HUMAN_APPROVAL"
    | "AUTO_POLICY_READY"
    | "COMPLIANCE_REVIEW_REQUIRED"
    | "COMPLIANCE_BLOCKED";
}

export interface DailyContentOrchestrationResult {
  plan: DailyContentPlan;
  campaignId?: string;
  reusedExistingPlan: boolean;
  materialized: MaterializedContentResult[];
  externalActionTaken: false;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dailyCampaignTitle(planDate: Date) {
  return `GEM Adaptive Content Plan ${planDate.toISOString().slice(0, 10)}`;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function provider(value: unknown): SocialMediaProviderId | undefined {
  return typeof value === "string" &&
    [
      "TIKTOK",
      "FACEBOOK_PAGE",
      "INSTAGRAM_PROFESSIONAL",
      "X",
      "NEXTDOOR",
      "INDEED_EMPLOYER",
      "LINKEDIN_COMPANY",
      "YOUTUBE",
    ].includes(value)
    ? (value as SocialMediaProviderId)
    : undefined;
}

async function existingDailyPlan(input: DailyContentOrchestrationInput) {
  const campaign = await db.campaign.findFirst({
    where: {
      workspaceId: input.workspaceId,
      title: dailyCampaignTitle(input.planDate),
    },
    include: {
      contents: {
        include: {
          versions: { orderBy: { version: "desc" }, take: 1 },
          reviews: { orderBy: { createdAt: "desc" }, take: 1 },
          approvals: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!campaign || campaign.contents.length === 0) return null;

  const materialized: MaterializedContentResult[] = campaign.contents.flatMap(
    (content) => {
      const version = content.versions[0];
      if (!version) return [];
      const settings = object(version.settings);
      const orchestration = object(settings.orchestrator);
      const contentProvider = provider(orchestration.provider);
      const fingerprint =
        typeof orchestration.fingerprint === "string"
          ? orchestration.fingerprint
          : undefined;
      const review = content.reviews[0];
      if (!contentProvider || !fingerprint || !review) return [];
      const approval = content.approvals[0];
      const state: MaterializedContentResult["state"] =
        review.result === "BLOCKED" || review.result === "CHANGES_REQUIRED"
          ? "COMPLIANCE_BLOCKED"
          : approval
            ? "AWAITING_HUMAN_APPROVAL"
            : "COMPLIANCE_REVIEW_REQUIRED";
      return [
        {
          contentId: content.id,
          contentVersionId: version.id,
          provider: contentProvider,
          fingerprint,
          complianceReviewId: review.id,
          complianceResult: review.result,
          approvalRequestId: approval?.id,
          state,
        },
      ];
    },
  );

  const drafts = materialized.map((item, index) => ({
    sequence: index + 1,
    provider: item.provider,
    contentType: "TEXT" as const,
    topic: "Existing governed daily content",
    angle: "Existing materialized plan",
    sourceMaterialId: "persisted",
    sourceReference: "persisted",
    signalId: "persisted",
    fingerprint: item.fingerprint,
    approvalRequired: true as const,
    complianceReviewRequired: true as const,
    externalActionTaken: false as const,
    humanInteraction: {
      required: true as const,
      responseMode: "REAL_TIME" as const,
      livePerformanceReviewRequired: true as const,
    },
  }));

  return {
    campaignId: campaign.id,
    plan: {
      planDate: input.planDate.toISOString().slice(0, 10),
      drafts,
      rejectedReasons: [],
      externalActionTaken: false as const,
    },
    materialized,
  };
}

async function createDailyCampaign(input: {
  workspaceId: string;
  actorId: string;
  correlationId: string;
  plan: DailyContentPlan;
}) {
  const title = dailyCampaignTitle(new Date(`${input.plan.planDate}T00:00:00.000Z`));
  const payload = {
    type: "ADAPTIVE_DAILY_SOCIAL_CONTENT",
    planDate: input.plan.planDate,
    draftFingerprints: input.plan.drafts.map((draft) => draft.fingerprint),
    rejectedReasons: input.plan.rejectedReasons,
    externalActionTaken: false,
  };
  const objectHash = contentHash(payload);

  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.actorId,
        title,
        state: "DRAFT",
      },
    });
    const version = await tx.campaignVersion.create({
      data: {
        campaignId: created.id,
        version: 1,
        objectHash,
        payload: toJson(payload),
        createdById: input.actorId,
      },
    });
    return tx.campaign.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
  });

  await emitDomainEvent({
    workspaceId: input.workspaceId,
    aggregateType: "campaign",
    aggregateId: campaign.id,
    eventType: "ADAPTIVE_DAILY_CONTENT_PLAN_CREATED",
    correlationId: input.correlationId,
    metadata: {
      planDate: input.plan.planDate,
      draftCount: input.plan.drafts.length,
      objectHash,
    },
  });
  return campaign;
}

function approvalAction(providerId: SocialMediaProviderId) {
  return `publish_${providerId.toLowerCase()}_content`;
}

export async function orchestrateDailyContent(
  input: DailyContentOrchestrationInput,
): Promise<DailyContentOrchestrationResult> {
  if (!input.forceRegenerate) {
    const existing = await existingDailyPlan(input);
    if (existing) {
      return {
        plan: existing.plan,
        campaignId: existing.campaignId,
        reusedExistingPlan: true,
        materialized: existing.materialized,
        externalActionTaken: false,
      };
    }
  }

  const catalogSources = input.useGemCatalog === false
    ? []
    : getGemApprovedSourceMaterial({
        approvedAt: input.planDate,
        productSlugs: input.gemProductSlugs,
      });
  const sourceMap = new Map<string, ApprovedSourceMaterial>();
  for (const source of [...catalogSources, ...(input.approvedSources ?? [])]) {
    if (source.approved) sourceMap.set(source.id, source);
  }
  const approvedSources = [...sourceMap.values()];

  const storedSignals = await loadCurrentMarketSignals({ planDate: input.planDate });
  const combinedSignals = mergeMarketSignals(
    input.marketSignals ?? [],
    storedSignals,
  );
  const learnedSignals = await applyEngagementLearning({
    workspaceId: input.workspaceId,
    planDate: input.planDate,
    signals: combinedSignals,
  });
  const recentPublishedContent = await loadGeneratedContentHistory({
    workspaceId: input.workspaceId,
    planDate: input.planDate,
  });

  const plan = buildAdaptiveDailyContentPlan({
    planDate: input.planDate,
    marketSignals: learnedSignals,
    approvedSources,
    recentPublishedContent,
    enabledProviders: input.enabledProviders,
    minimumTikTokItems: input.minimumTikTokItems,
    maxItemsPerOtherProvider: input.maxItemsPerOtherProvider,
    freshnessWindowDays: input.freshnessWindowDays,
  });

  if (plan.drafts.length === 0) {
    return {
      plan,
      reusedExistingPlan: false,
      materialized: [],
      externalActionTaken: false,
    };
  }

  const campaign = await createDailyCampaign({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    plan,
  });
  const sourcesById = new Map(approvedSources.map((source) => [source.id, source]));
  const signalsById = new Map(learnedSignals.map((signal) => [signal.id, signal]));
  const materialized: MaterializedContentResult[] = [];

  for (const draft of plan.drafts) {
    const source = sourcesById.get(draft.sourceMaterialId);
    const signal = signalsById.get(draft.signalId);
    if (!source || !signal) {
      throw new TokMetricError(
        409,
        "ORCHESTRATION_SOURCE_MISSING",
        "A planned content source or market signal is no longer available.",
      );
    }
    const contentPackage = generateCrossPlatformContentPackage({
      draft,
      source,
      signal,
      localContext: draft.provider === "NEXTDOOR" ? input.localContext : undefined,
    });
    const settings = {
      title: contentPackage.title,
      description: contentPackage.shortVideo.script,
      linkUrl: /^https?:\/\//i.test(source.sourceReference)
        ? source.sourceReference
        : undefined,
      altText: contentPackage.visualBrief.accessibilityText,
      thread:
        draft.provider === "X"
          ? contentPackage.shortVideo.scenes.map((scene) => scene.narration)
          : undefined,
      localContext: contentPackage.publication.localContext,
      vacancyId: draft.vacancyId,
      orchestrator: {
        version: 1,
        planDate: plan.planDate,
        provider: draft.provider,
        contentType: draft.contentType,
        fingerprint: draft.fingerprint,
        angle: draft.angle,
        sourceMaterialId: draft.sourceMaterialId,
        signalId: draft.signalId,
        humanInteraction: draft.humanInteraction,
      },
      videoRecipe: contentPackage.shortVideo,
      visualBrief: contentPackage.visualBrief,
      sourceEvidence: contentPackage.sourceEvidence,
      publishingChecklist: contentPackage.publishingChecklist,
      riskFlags: contentPackage.riskFlags,
    };
    const created = await createContentDraft(
      {
        workspaceId: input.workspaceId,
        campaignId: campaign.id,
        title: contentPackage.title,
        script: contentPackage.shortVideo.script,
        caption: contentPackage.publication.caption,
        hashtags: contentPackage.publication.hashtags,
        settings,
      },
      input.actorId,
      input.correlationId,
    );
    const review = await runComplianceReview({
      workspaceId: input.workspaceId,
      contentId: created.content.id,
      actorId: input.actorId,
      correlationId: input.correlationId,
    });

    let approvalRequestId: string | undefined;
    if (
      input.requestApprovals !== false &&
      ["PASS", "PASS_WITH_DISCLOSURE"].includes(review.result)
    ) {
      const approval = await requestContentApproval({
        workspaceId: input.workspaceId,
        contentId: created.content.id,
        actorId: input.actorId,
        action: approvalAction(draft.provider),
        correlationId: input.correlationId,
      });
      approvalRequestId = approval.id;
    }

    materialized.push({
      contentId: created.content.id,
      contentVersionId: created.version.id,
      provider: draft.provider,
      fingerprint: draft.fingerprint,
      complianceReviewId: review.id,
      complianceResult: review.result,
      approvalRequestId,
      state:
        review.result === "BLOCKED" || review.result === "CHANGES_REQUIRED"
          ? "COMPLIANCE_BLOCKED"
          : approvalRequestId
            ? "AWAITING_HUMAN_APPROVAL"
            : "COMPLIANCE_REVIEW_REQUIRED",
    });
  }

  await emitTokMetricAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "social.content_orchestrator.completed",
    entityType: "campaign",
    entityId: campaign.id,
    correlationId: input.correlationId,
    outcome: "success",
    sourceChannel: "social-media-command-center",
    metadata: {
      planDate: plan.planDate,
      generatedCount: materialized.length,
      approvalRequestsCreated: materialized.filter(
        (item) => item.approvalRequestId,
      ).length,
      rejectedReasons: plan.rejectedReasons,
      externalActionTaken: false,
    },
  });

  return {
    plan,
    campaignId: campaign.id,
    reusedExistingPlan: false,
    materialized,
    externalActionTaken: false,
  };
}
