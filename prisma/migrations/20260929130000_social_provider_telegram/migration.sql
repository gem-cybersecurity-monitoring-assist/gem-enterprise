-- Allow TELEGRAM as a unified social publishing provider.
--
-- Telegram authenticates with a bot token (server-side encrypted connector
-- credential), not OAuth, so it is intentionally NOT added to the
-- social_oauth_authorization_attempts provider check. It is added to:
--   1) social_connectors.provider — Telegram connectors store the bot token
--      as an encrypted credential and the chat/channel id as safe metadata.
--   2) social_provider_pauses.provider — provider-scoped pause must cover
--      every publishing provider, including Telegram.

ALTER TABLE "social_connectors"
  DROP CONSTRAINT "social_connectors_provider_check";
ALTER TABLE "social_connectors"
  ADD CONSTRAINT "social_connectors_provider_check" CHECK (
    "provider" IN ('META', 'X', 'LINKEDIN', 'YOUTUBE', 'NEXTDOOR', 'TIKTOK', 'TELEGRAM')
  );

ALTER TABLE "social_provider_pauses"
  DROP CONSTRAINT "social_provider_pauses_provider_check";
ALTER TABLE "social_provider_pauses"
  ADD CONSTRAINT "social_provider_pauses_provider_check" CHECK (
    "provider" IN ('META', 'X', 'LINKEDIN', 'YOUTUBE', 'NEXTDOOR', 'TIKTOK', 'TELEGRAM')
  );
