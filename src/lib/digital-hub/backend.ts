import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { track } from "@vercel/analytics/server";
import { db } from "@/lib/db";
import {
  publicAuditGateway,
  shouldUseSupabaseGateway,
} from "@/lib/supabase-gateway";

export const digitalHubEventSchema = z.object({
  event: z.enum([
    "referral_copy",
    "referral_open",
    "wallet_connect_attempt",
    "wallet_connected",
    "wallet_disconnected",
    "service_open",
    "profile_open",
    "market_reference_open",
    "community_open",
  ]),
  target: z.enum([
    "btcc",
    "metamask",
    "phantom",
    "coinbase",
    "browser",
    "cybersecurity",
    "crypto-market",
    "workspace",
    "social",
    "digital-hub",
    "farcaster",
    "forex-com",
    "yahoo-finance",
    "investopedia",
    "forbes-web3",
    "community-hub",
  ]),
  path: z.literal("/digital-hub").optional(),
});

export type DigitalHubEvent = z.infer<typeof digitalHubEventSchema>;

const eventTargets: Record<DigitalHubEvent["event"], ReadonlySet<DigitalHubEvent["target"]>> = {
  referral_copy: new Set(["btcc"]),
  referral_open: new Set(["btcc"]),
  wallet_connect_attempt: new Set(["metamask", "phantom", "coinbase", "browser"]),
  wallet_connected: new Set(["metamask", "phantom", "coinbase", "browser"]),
  wallet_disconnected: new Set(["metamask", "phantom", "coinbase", "browser"]),
  service_open: new Set(["cybersecurity", "crypto-market", "workspace", "social", "digital-hub"]),
  profile_open: new Set(["farcaster", "forex-com"]),
  market_reference_open: new Set(["yahoo-finance", "investopedia", "forbes-web3"]),
  community_open: new Set(["community-hub"]),
};

export function isAllowedDigitalHubEvent(event: DigitalHubEvent) {
  return eventTargets[event.event].has(event.target);
}

export async function persistDigitalHubEvent(event: DigitalHubEvent) {
  if (!isAllowedDigitalHubEvent(event)) {
    throw new Error("DIGITAL_HUB_EVENT_TARGET_MISMATCH");
  }

  const eventId = crypto.randomUUID();
  const metadata = {
    operation: event.event,
    target: event.target,
    path: event.path ?? "/digital-hub",
    surface: "public_digital_hub",
    containsWalletAddress: false,
    containsCredential: false,
  };

  if (shouldUseSupabaseGateway()) {
    try {
      await publicAuditGateway({
        action: "admin_action",
        resource: "digital_hub",
        resourceId: eventId,
        metadata,
      });
      return { eventId, persisted: true as const, persistence: "supabase_audit" as const };
    } catch (error) {
      // Production gateway deployments intentionally keep the Supabase service
      // role out of Vercel. If anonymous audit insertion is not granted, retain
      // the interaction through the already-enabled first-party Vercel
      // Analytics backend instead of failing the public action.
      await track("DigitalHubInteraction", {
        event: event.event,
        target: event.target,
      });
      console.info("[digital-hub:event-recorded]", JSON.stringify({
        eventId,
        event: event.event,
        target: event.target,
        persistence: "vercel_analytics",
        supabaseAudit: "unavailable",
      }));
      return {
        eventId,
        persisted: true as const,
        persistence: "vercel_analytics" as const,
      };
    }
  }

  await db.auditLog.create({
    data: {
      id: eventId,
      userId: null,
      action: AuditAction.admin_action,
      resource: "digital_hub",
      resourceId: eventId,
      metadata,
    },
  });

  return { eventId, persisted: true as const, persistence: "prisma_audit" as const };
}

type RateBucket = { count: number; resetAt: number };
const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;
const MAX_EVENTS = 30;

export function consumeDigitalHubRateLimit(key: string, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_EVENTS - 1, resetAt: now + WINDOW_MS };
  }

  if (current.count >= MAX_EVENTS) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  if (buckets.size > 2_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return {
    allowed: true,
    remaining: MAX_EVENTS - current.count,
    resetAt: current.resetAt,
  };
}
