-- Allow TELEGRAM as a social_publishing_jobs provider.
--
-- The code's SharedSocialPublishingProvider list
-- (src/lib/social-media/publishing/types.ts) already includes TELEGRAM,
-- but the social_publishing_jobs.provider CHECK created by
-- 20260723090000_unified_social_publishing allows only the first six
-- providers, so a TELEGRAM job insert fails in both the Prisma and the
-- gateway paths. This migration widens the CHECK to exactly the seven
-- values the code allows. No other change.
--
-- The 20260929130000_social_provider_telegram migration added TELEGRAM to
-- social_connectors.provider and social_provider_pauses.provider but did
-- not touch this table, which is why the gap survived until the first
-- Telegram job was attempted.
--
-- Follows the DROP CONSTRAINT / ADD CONSTRAINT pattern of the Telegram
-- migration. Postgres has no in-place widening of a CHECK, so the drop +
-- re-add is the only form; the re-added CHECK is a widening only (the six
-- existing values are unchanged), so no existing row can fail it.

ALTER TABLE "social_publishing_jobs"
  DROP CONSTRAINT "social_publishing_jobs_provider_check";
ALTER TABLE "social_publishing_jobs"
  ADD CONSTRAINT "social_publishing_jobs_provider_check" CHECK (
    "provider" IN (
      'FACEBOOK_PAGE',
      'INSTAGRAM_PROFESSIONAL',
      'X',
      'LINKEDIN_COMPANY',
      'YOUTUBE',
      'NEXTDOOR',
      'TELEGRAM'
    )
  );
