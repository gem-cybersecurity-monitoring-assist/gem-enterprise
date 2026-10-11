import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { orchestrateDailyContent } from "@/lib/social-media/orchestration/orchestrator";
import {
  isAuthorizedSocialCronRequest,
  cronSecretMisconfigured,
} from "@/lib/social-media/autopilot/cron-auth";import {
  assertSocialAutopilotKillSwitchClear,
  getWorkspacePausedProviders,
  isKillSwitchError,
} from "@/lib/social-media/autopilot/health";
import { applyAutopilotLearning } from "@/lib/social-media/autopilot/learning";
import {
  getSocialAutopilotProviderTargets,
  getSocialAutopilotProviders,
  getSocialAutopilotReserveDays,
  isSocialAutopilotProviderPausedByConfig,
  socialAutopilotEnabled,
} from "@/lib/social-media/autopilot/policy";
import { reservePlanDates } from "@/lib/social-media/autopilot/scheduler";
import { loadAutopilotSignalSelection } from "@/lib/social-media/autopilot/signals";
import { materializeSocialAutopilotJobs } from "@/lib/social-media/autopilot/service";
import {
  socialMediaProviderIds,
  type SocialMediaProviderId,
} from "@/lib/social-media/providers";
import { TokMetricError } from "@/lib/tokmetric/security";

/**
 * Scheduled-run authentication. The bearer secret (CONTENT_ORCHESTRATOR_CRON_SECRET,
 * falling back to CRON_SECRET) is compared with crypto.timingSafeEqual inside
 * isAuthorizedSocialCronRequest; a missing secret never authorizes (fail closed).
 */
function authorized(request: NextRequest) {
  return isAuthorizedSocialCronRequest(request);
}

const defaultProviders: SocialMediaProviderId[] = [  "TIKTOK",
  "FACEBOOK_PAGE",
  "INSTAGRAM_PROFESSIONAL",
  "X",
  "NEXTDOOR",
];

function configuredProviders(): SocialMediaProviderId[] {
  const configured = process.env.CONTENT_ORCHESTRATOR_PROVIDERS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!configured?.length) return defaultProviders;
  const valid = [...new Set(configured)].filter(
    (candidate): candidate is SocialMediaProviderId =>
      socialMediaProviderIds.includes(candidate as SocialMediaProviderId),
  );
  return valid.length ? valid : defaultProviders;
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function killSwitchResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "TOKMETRIC_LOCKED",
        message:
          "Workspace emergency controls block content orchestration; the run was stopped.",
      },
    },
    { status: 423, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

async function run(request: NextRequest) {
  const secretMisconfigured = cronSecretMisconfigured();
  const workspaceId = process.env.CONTENT_ORCHESTRATOR_WORKSPACE_ID?.trim();
  const actorId = process.env.CONTENT_ORCHESTRATOR_ACTOR_ID?.trim();
  if (secretMisconfigured || !workspaceId || !actorId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CONTENT_ORCHESTRATOR_NOT_CONFIGURED",
          message:
            "Scheduled content orchestration requires a cron secret, workspace ID, and service actor ID.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  if (!authorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Content orchestrator authentication failed.",
        },
      },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  // Global emergency stop (globalEmergencyLock / publishingDisabled): fail
  // closed before any orchestration or scheduling decision.
  try {
    await assertSocialAutopilotKillSwitchClear(workspaceId);
  } catch (error) {
    if (isKillSwitchError(error)) return killSwitchResponse();
    throw error;
  }

  try {
    const runStartedAt = new Date();

    if (socialAutopilotEnabled()) {
      const reserveDates = reservePlanDates({
        now: runStartedAt,
        reserveDays: getSocialAutopilotReserveDays(),
      });
      // WS-A provider pause contract: paused providers are excluded from
      // daily content plans and slot assignments (surfaced as paused, not
      // failed). The materializer re-checks at scheduling time as well.
      const pausedProviders = await getWorkspacePausedProviders(workspaceId);
      const providers = getSocialAutopilotProviders().filter(
        (provider) =>
          !pausedProviders.includes(provider) &&
          !isSocialAutopilotProviderPausedByConfig(provider),
      );
      const providerTargets = getSocialAutopilotProviderTargets();
      const cycles = [];

      for (const planDate of reserveDates) {
        const correlationId =
          `social-autopilot:${planDate.toISOString()}:${crypto.randomUUID()}`;

        // Live signal ingestion: fresh approved news signals feed the
        // AUTO_POLICY path. Honest fallback to GEM-approved evergreen themes
        // when no fresh signals exist; provenance is recorded, never faked.
        const selection = await loadAutopilotSignalSelection({
          planDate,
          env: process.env,
        });
        const learning = await applyAutopilotLearning({
          workspaceId,
          planDate,
          signals: selection.signals,
          env: process.env,
        });

        const result = await orchestrateDailyContent({
          workspaceId,
          actorId,
          correlationId,
          planDate,
          enabledProviders: providers,
          marketSignals: learning.signals,
          signalProvenance: selection.provenance,
          signalMetadata: {
            freshSignalCount: selection.freshSignalCount,
            fallbackApplied: selection.fallbackApplied,
            learningApplied: learning.learningApplied,
          },
          useGemCatalog: true,
          localContext:
            process.env.CONTENT_ORCHESTRATOR_NEXTDOOR_LOCAL_CONTEXT?.trim(),
          providerTargets,
          approvalMode: "AUTO_POLICY",
          freshnessWindowDays: null,
          requestApprovals: false,
          forceRegenerate: false,
        });
        const materialized = await materializeSocialAutopilotJobs({
          workspaceId,
          actorId,
          planDate,
          result,
          correlationId,
          now: runStartedAt,
        });
        cycles.push({
          planDate: result.plan.planDate,
          campaignId: result.campaignId,
          reusedExistingPlan: result.reusedExistingPlan,
          generated: result.materialized.length,
          queued: materialized.queued,
          skipped: materialized.skipped,
          blockedReasons: materialized.blockedReasons,
          rejectedReasons: result.plan.rejectedReasons,
          signalProvenance: selection.provenance,
          freshSignalCount: selection.freshSignalCount,
          evergreenFallbackApplied: selection.fallbackApplied,
          learningApplied: learning.learningApplied,
        });
      }

      return NextResponse.json(
        {
          ok: true,
          mode: "AUTO_POLICY",
          reserveDays: reserveDates.length,
          pausedProviders: [...pausedProviders],
          cycles,
          externalActionTaken: false,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    const planDate = runStartedAt;
    const result = await orchestrateDailyContent({
      workspaceId,
      actorId,
      correlationId: `content-orchestrator:${planDate.toISOString()}:${crypto.randomUUID()}`,
      planDate,
      enabledProviders: configuredProviders(),
      useGemCatalog: true,
      localContext:
        process.env.CONTENT_ORCHESTRATOR_NEXTDOOR_LOCAL_CONTEXT?.trim(),
      minimumTikTokItems: boundedInteger(
        process.env.CONTENT_ORCHESTRATOR_MINIMUM_TIKTOK_ITEMS,
        20,
        20,
        100,
      ),
      maxItemsPerOtherProvider: boundedInteger(
        process.env.CONTENT_ORCHESTRATOR_OTHER_PROVIDER_ITEMS,
        3,
        1,
        20,
      ),
      approvalMode: "HUMAN",
      freshnessWindowDays: null,
      requestApprovals: true,
      forceRegenerate: false,
    });
    return NextResponse.json(
      {
        ok: true,
        mode: "HUMAN",
        campaignId: result.campaignId,
        reusedExistingPlan: result.reusedExistingPlan,
        generated: result.materialized.length,
        rejectedReasons: result.plan.rejectedReasons,
        externalActionTaken: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (isKillSwitchError(error)) return killSwitchResponse();
    if (error instanceof TokMetricError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: error.code, message: error.message },
        },
        { status: error.status, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CONTENT_ORCHESTRATOR_RUN_FAILED",
          message: "The governed daily content run could not be completed.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
