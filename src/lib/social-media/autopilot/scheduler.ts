import { createHash } from "node:crypto";
import type { SharedSocialPublishingProvider } from "@/lib/social-media/publishing/types";
import { getSocialAutopilotProviderPolicy, type SocialEnvSource } from "./policy";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function deterministicJitterMinutes(seed: string, rangeMinutes = 10) {
  const digest = createHash("sha256").update(seed).digest();
  const width = rangeMinutes * 2 + 1;
  return (digest.readUInt16BE(0) % width) - rangeMinutes;
}

export function socialAutopilotDayWindow(planDate: Date) {
  const start = utcDayStart(planDate);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function buildSocialAutopilotSlots(input: {
  provider: SharedSocialPublishingProvider;
  planDate: Date;
  count?: number;
  now?: Date;
  env?: SocialEnvSource;
}) {
  const policy = getSocialAutopilotProviderPolicy(
    input.provider,
    input.env ?? process.env,
  );
  const requested = Math.min(
    Math.max(input.count ?? policy.dailyTarget, 0),
    policy.hardDailyCap,
  );
  if (requested === 0) return [];

  const dayStart = utcDayStart(input.planDate);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const now = input.now ?? new Date();
  const firstWindow = new Date(dayStart);
  firstWindow.setUTCHours(8, 0, 0, 0);
  const lastWindow = new Date(dayStart);
  lastWindow.setUTCHours(22, 0, 0, 0);

  const earliest =
    dayStart.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
      ? new Date(Math.max(firstWindow.getTime(), now.getTime() + 15 * 60 * 1000))
      : firstWindow;

  if (earliest >= dayEnd || earliest > lastWindow) return [];

  const availableMinutes = Math.max(
    0,
    Math.floor((lastWindow.getTime() - earliest.getTime()) / 60_000),
  );
  const capacity = Math.floor(availableMinutes / policy.minSpacingMinutes) + 1;
  const count = Math.min(requested, Math.max(capacity, 0));
  if (count <= 0) return [];

  const naturalSpacing =
    count <= 1
      ? 0
      : Math.floor(availableMinutes / Math.max(count - 1, 1));
  const spacingMinutes = Math.max(
    policy.minSpacingMinutes,
    Math.min(naturalSpacing, Math.max(policy.minSpacingMinutes, availableMinutes)),
  );

  const slots: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    // The final slot skips jitter so its deterministic offset can never push
    // it past the day window and silently drop a planned post.
    const jitter =
      index === 0 || count === 1 || index === count - 1
        ? 0
        : deterministicJitterMinutes(
            `${input.provider}|${dayStart.toISOString().slice(0, 10)}|${index}`,
          );
    const candidate = new Date(
      earliest.getTime() + index * spacingMinutes * 60_000 + jitter * 60_000,
    );
    const minimum =
      slots.length > 0
        ? slots[slots.length - 1].getTime() + policy.minSpacingMinutes * 60_000
        : earliest.getTime();
    // Preserve room for every remaining slot even when deterministic jitter
    // would otherwise push the last slot beyond the permitted daily window.
    const latest = lastWindow.getTime() -
      (count - index - 1) * policy.minSpacingMinutes * 60_000;
    candidate.setTime(Math.min(Math.max(candidate.getTime(), minimum), latest));
    if (candidate > lastWindow || candidate >= dayEnd) break;
    slots.push(candidate);
  }
  return slots;
}

export function reservePlanDates(input: {
  now?: Date;
  reserveDays: number;
}) {
  const start = utcDayStart(input.now ?? new Date());
  const count = Math.min(Math.max(input.reserveDays, 1), 7);
  return Array.from(
    { length: count },
    (_, index) => new Date(start.getTime() + index * DAY_MS),
  );
}
