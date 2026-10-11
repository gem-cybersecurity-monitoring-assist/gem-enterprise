/**
 * Slot semantics for the governed social publishing worker.
 *
 * Each hourly cron tick calls /process/{HH}; the slot parameter is the hour
 * window (UTC) that tick is responsible for:
 * - A tick claims jobs that are due AND (unscheduled OR scheduled before the
 *   end of its slot). Overdue scheduled jobs are recovered by later ticks.
 * - Per-provider per-slot batch caps bound how many jobs one tick may claim
 *   for a provider in a workspace (backpressure against provider rate limits).
 * - Per-provider minimum spacing blocks a claim when the same connector
 *   published within the spacing window (also backpressure).
 *
 * Caps and spacing can be tuned per deployment via JSON env overrides; the
 * SQL CASE builders below always derive from the same constants the tests
 * assert on, so policy and query can never drift apart.
 */
import { Prisma } from "@prisma/client";
import {
  sharedSocialPublishingProviders,
  type SharedSocialPublishingProvider,
} from "./types";

export const PROVIDER_SLOT_BATCH_CAP: Record<
  SharedSocialPublishingProvider,
  number
> = {
  FACEBOOK_PAGE: 4,
  INSTAGRAM_PROFESSIONAL: 4,
  X: 6,
  LINKEDIN_COMPANY: 3,
  YOUTUBE: 2,
  NEXTDOOR: 2,
  TELEGRAM: 6,
};

export const PROVIDER_MIN_SPACING_MINUTES: Record<
  SharedSocialPublishingProvider,
  number
> = {
  FACEBOOK_PAGE: 20,
  INSTAGRAM_PROFESSIONAL: 30,
  X: 10,
  LINKEDIN_COMPANY: 30,
  YOUTUBE: 60,
  NEXTDOOR: 45,
  TELEGRAM: 15,
};

function jsonOverride(
  name: string,
): Partial<Record<SharedSocialPublishingProvider, number>> {
  const raw = process.env[name]?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const valid: Partial<Record<SharedSocialPublishingProvider, number>> = {};
    for (const provider of sharedSocialPublishingProviders) {
      const value = parsed[provider];
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 1 &&
        value <= 100
      ) {
        valid[provider] = Math.floor(value);
      }
    }
    return valid;
  } catch {
    return {};
  }
}

const capOverrides = () => jsonOverride("SOCIAL_PUBLISHING_SLOT_CAPS_JSON");
const spacingOverrides = () =>
  jsonOverride("SOCIAL_PUBLISHING_SPACING_MINUTES_JSON");

export function providerSlotBatchCap(provider: SharedSocialPublishingProvider) {
  return capOverrides()[provider] ?? PROVIDER_SLOT_BATCH_CAP[provider];
}

export function providerMinSpacingMinutes(
  provider: SharedSocialPublishingProvider,
) {
  return (
    spacingOverrides()[provider] ?? PROVIDER_MIN_SPACING_MINUTES[provider]
  );
}

/**
 * Parses the [slot] route parameter. Accepts "07" or "7"; anything else
 * (including out-of-range hours) is null so the route can 400.
 */
export function parseSlotHour(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const hour = Number(trimmed);
  return hour >= 0 && hour <= 23 ? hour : null;
}

/**
 * The UTC hour window a slot tick owns, anchored on the current day.
 */
export function slotWindowUtc(slotHour: number, now: Date = new Date()) {
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      slotHour,
      0,
      0,
      0,
    ),
  );
  return { slotStart: start, slotEnd: new Date(start.getTime() + 3_600_000) };
}

/**
 * SQL CASE expression: per-provider batch cap for the claim query.
 * providerColumn must be a trusted column reference supplied by the caller.
 */
export function providerSlotCapCaseSql(
  providerColumn: Prisma.Sql,
): Prisma.Sql {
  const whens = sharedSocialPublishingProviders.map(
    (provider) =>
      Prisma.sql`WHEN ${providerColumn} = ${provider} THEN ${providerSlotBatchCap(provider)}`,
  );
  return Prisma.sql`CASE ${Prisma.join(whens, " ")} ELSE 3 END`;
}

/**
 * SQL interval expression: per-provider minimum spacing between published
 * posts on the same connector.
 */
export function providerSpacingIntervalSql(
  providerColumn: Prisma.Sql,
): Prisma.Sql {
  const whens = sharedSocialPublishingProviders.map(
    (provider) =>
      Prisma.sql`WHEN ${providerColumn} = ${provider} THEN make_interval(mins => ${providerMinSpacingMinutes(provider)})`,
  );
  return Prisma.sql`CASE ${Prisma.join(whens, " ")} ELSE make_interval(mins => 30) END`;
}
