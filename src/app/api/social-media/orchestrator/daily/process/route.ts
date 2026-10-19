import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { orchestrateDailyContent } from "@/lib/social-media/orchestration/orchestrator";
import {
  getSocialAutopilotProviderTargets,
  getSocialAutopilotProviders,
  getSocialAutopilotReserveDays,
  socialAutopilotEnabled,
} from "@/lib/social-media/autopilot/policy";
import { reservePlanDates } from "@/lib/social-media/autopilot/scheduler";
import { materializeSocialAutopilotJobs } from "@/lib/social-media/autopilot/service";
import {
  socialMediaProviderIds,
  type SocialMediaProviderId,
} from "@/lib/social-media/providers";

function configuredSecret() {
  return (
    process.env.CONTENT_ORCHESTRATOR_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim()
  );
}

function authorized(request: NextRequest) {
  const configured = configuredSecret();
  const header = request.headers.get("authorization")?.trim();
  if (!configured || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

const evergreenThemes = [
  ["Access ownership and MFA hygiene", "Review who owns critical accounts, whether MFA is enforced, and whether recovery paths still work."],
  ["Backup and recovery readiness", "Test whether important business data can actually be restored and whether recovery responsibilities are clear."],
  ["Vendor and third-party dependency risk", "Review critical external services, administrator access, fallback options, and dependency ownership."],
  ["Payment-change verification", "Use an independent verification path before acting on payment, banking, or supplier-detail changes."],
  ["Phishing reporting and escalation", "Make suspicious-message reporting simple and ensure staff know where urgent security concerns should go."],
  ["Endpoint and patch readiness", "Keep supported devices current and track systems that cannot receive normal security updates."],
  ["Joiner, mover, and leaver access", "Remove stale access quickly and review privileges when people change responsibilities."],
  ["Recovery-code and privileged access hygiene", "Protect recovery methods and privileged credentials with the same care as primary sign-in credentials."],
  ["Incident escalation readiness", "Define who can make containment decisions and how the business communicates during an incident."],
  ["Cloud and SaaS access review", "Review administrators, integrations, stale accounts, and recovery contacts across business cloud services."],
  ["Business continuity dependencies", "Identify the systems and people the business cannot operate without and maintain practical fallback plans."],
  ["Security awareness through routine operations", "Turn common business actions into repeatable habits that reduce avoidable security mistakes."],
] as const;

function evergreenSignals(planDate: Date) {
  const dayIndex = Math.floor(planDate.getTime() / (24 * 60 * 60 * 1000));
  return Array.from({ length: 4 }, (_, offset) => {
    const [topic, summary] =
      evergreenThemes[(dayIndex + offset) % evergreenThemes.length];
    return {
      id: `gem-evergreen:${(dayIndex + offset) % evergreenThemes.length}`,
      topic,
      summary,
      relevance: 0.58,
      momentum: 0.32,
      observedAt: planDate,
      sourceReference: `gem-approved-evergreen:${(dayIndex + offset) % evergreenThemes.length}`,
    };
  });
}

const defaultProviders: SocialMediaProviderId[] = [
  "TIKTOK",
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

async function run(request: NextRequest) {
  const secret = configuredSecret();
  const workspaceId = process.env.CONTENT_ORCHESTRATOR_WORKSPACE_ID?.trim();
  const actorId = process.env.CONTENT_ORCHESTRATOR_ACTOR_ID?.trim();
  if (!secret || !workspaceId || !actorId) {
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

  try {
    const runStartedAt = new Date();

    if (socialAutopilotEnabled()) {
      const reserveDates = reservePlanDates({
        now: runStartedAt,
        reserveDays: getSocialAutopilotReserveDays(),
      });
      const providers = getSocialAutopilotProviders();
      const providerTargets = getSocialAutopilotProviderTargets();
      const cycles = [];

      for (const planDate of reserveDates) {
        const correlationId =
          `social-autopilot:${planDate.toISOString()}:${crypto.randomUUID()}`;
        const result = await orchestrateDailyContent({
          workspaceId,
          actorId,
          correlationId,
          planDate,
          enabledProviders: providers,
          marketSignals: evergreenSignals(planDate),
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
        });
      }

      return NextResponse.json(
        {
          ok: true,
          mode: "AUTO_POLICY",
          reserveDays: reserveDates.length,
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
  } catch {
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
