import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("governed cross-platform social publishing", () => {
  const worker = source("src/lib/social-media/publishing/worker.ts");
  const store = source("src/lib/social-media/publishing/store.ts");
  const adapters = source("src/lib/social-media/publishing/adapters.ts");
  const gates = source("src/lib/social-media/publishing/gates.ts");
  const queueRoute = source(
    "src/app/api/social-media/publishing/jobs/route.ts",
  );
  const processRoute = source(
    "src/app/api/social-media/publishing/jobs/process/route.ts",
  );
  const legacyWorker = source(
    "src/app/api/facebook/jobs/process-queue.ts",
  );
  const legacyPublishing = source(
    "src/app/api/facebook/publishing/route.ts",
  );
  const legacyVerify = source("src/app/api/facebook/verify/route.ts");
  const permissionsVerifier = source(
    "src/components/FacebookOperations/PermissionsVerifier.tsx",
  );
  const accountStore = source(
    "src/lib/social-media/oauth/account-store.ts",
  );
  const migration = source(
    "prisma/migrations/20260723090000_unified_social_publishing/migration.sql",
  );

  it("uses one atomic, bounded, dead-letter publishing queue", () => {
    expect(migration).toContain('CREATE TABLE "social_publishing_jobs"');
    expect(migration).toContain('CREATE TABLE "social_publishing_attempts"');
    expect(store).toContain("FOR UPDATE SKIP LOCKED");
    expect(store).toContain('? "DEAD_LETTER"');
    expect(store).toContain("attemptCount < input.job.maxAttempts");
    expect(store).toContain("SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT");
  });

  it("rechecks governance immediately before every provider write", () => {
    expect(worker).toContain("evaluateSocialPublishingAuthorization");
    expect(worker).toContain("globalSocialPublishingEnabled()");
    expect(worker).toContain("providerSocialPublishingEnabled(job.provider)");
    expect(worker).toContain("enforceEmergencyLocks(job.workspaceId, \"publish\")");
    expect(worker).toContain("decision.actorId !== approval?.requestedById");
    expect(worker).toContain("complianceReview?.contentVersionId === versionId");
    expect(worker).toContain("job.contentVersionHash === job.approvedVersionHash");
    expect(worker).toContain("missingPublishingScopes");
    expect(worker).toContain("accountTypeMatches");
  });

  it("derives queued payloads from the approved server-side content version", () => {
    expect(queueRoute).toContain("db.contentVersion.findUnique");
    expect(queueRoute).toContain('content.state !== "APPROVED"');
    expect(queueRoute).toContain('decision?.decision !== "approve"');
    expect(queueRoute).toContain("decision.actorId === approval.requestedById");
    expect(queueRoute).toContain("version.objectHash");
    expect(queueRoute).toContain("Idempotency-Key header");
    expect(queueRoute).not.toContain("payload: input.payload");
  });

  it("persists linked Instagram professional accounts as explicit destinations", () => {
    expect(accountStore).toContain("expandExplicitMetaDestinations");
    expect(accountStore).toContain('accountType: "INSTAGRAM_PROFESSIONAL"');
    expect(accountStore).toContain("instagramBusinessAccountId");
    expect(accountStore).toContain("externalAccountId: instagramId");
  });

  it("never auto-selects the first Meta account", () => {
    expect(legacyVerify).toContain("EXPLICIT_META_DESTINATION_REQUIRED");
    expect(legacyVerify).not.toContain("connectors[0]");
    expect(permissionsVerifier).toContain("Choose a destination");
    expect(permissionsVerifier).toContain(
      "The system never selects the first discovered account automatically.",
    );
    expect(permissionsVerifier).toContain("/api/social-media/connectors?workspaceId=");
    expect(permissionsVerifier).not.toContain("NEXT_PUBLIC_META_APP_ID");
    expect(permissionsVerifier).not.toContain("facebook.com/v18.0/dialog/oauth");
  });

  it("removes the legacy Facebook token and publishing bypasses", () => {
    expect(legacyWorker).toContain("social-media/publishing/jobs/process/route");
    expect(legacyWorker).not.toContain("meta_connectors");
    expect(legacyWorker).not.toContain("createDecipheriv");
    expect(legacyWorker).not.toContain("page_access_token_encrypted");
    expect(legacyPublishing).toContain(
      "LEGACY_FACEBOOK_PUBLISHING_MIGRATION_REQUIRED",
    );
    expect(legacyPublishing).toContain("externalActionTaken: false");
    expect(legacyPublishing).not.toContain("facebook_publishing_jobs");
  });

  it("keeps provider credentials out of URLs and durable response archives", () => {
    expect(adapters).toContain("Authorization: `Bearer ${input.accessToken}`");
    expect(adapters).not.toContain("access_token=");
    expect(store).toContain("safe_provider_metadata");
    expect(store).not.toContain("provider_response_body");
    expect(store).not.toContain("meta_response_body");
  });

  it("requires fail-closed worker authentication and independent live gates", () => {
    expect(processRoute).toContain("CRON_AUTH_NOT_CONFIGURED");
    expect(processRoute).toContain("timingSafeEqual");
    expect(gates).toContain("SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED");
    expect(gates).toContain("META_SOCIAL_PUBLISHING_ENABLED");
    expect(gates).toContain("X_SOCIAL_PUBLISHING_ENABLED");
    expect(gates).toContain("LINKEDIN_SOCIAL_PUBLISHING_ENABLED");
    expect(gates).toContain("YOUTUBE_PUBLISHING_ENABLED");
    expect(gates).toContain("NEXTDOOR_PUBLISHING_ENABLED");
    expect(gates).not.toContain("INDEED_EMPLOYER");
  });
});
