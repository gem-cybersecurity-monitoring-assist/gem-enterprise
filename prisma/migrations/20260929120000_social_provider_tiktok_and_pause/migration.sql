-- WS-A: unify TikTok into the social OAuth control plane + provider-scoped pause.
-- Additive only. No external publishing behavior is changed by this migration.

-- 1) Allow TIKTOK in the unified OAuth provider check constraints.
ALTER TABLE "social_connectors"
  DROP CONSTRAINT "social_connectors_provider_check";
ALTER TABLE "social_connectors"
  ADD CONSTRAINT "social_connectors_provider_check" CHECK (
    "provider" IN ('META', 'X', 'LINKEDIN', 'YOUTUBE', 'NEXTDOOR', 'TIKTOK')
  );

ALTER TABLE "social_oauth_authorization_attempts"
  DROP CONSTRAINT "social_oauth_authorization_attempts_provider_check";
ALTER TABLE "social_oauth_authorization_attempts"
  ADD CONSTRAINT "social_oauth_authorization_attempts_provider_check" CHECK (
    "provider" IN ('META', 'X', 'LINKEDIN', 'YOUTUBE', 'NEXTDOOR', 'TIKTOK')
  );

-- 2) Provider-scoped publishing pause (one row per paused workspace/provider).
CREATE TABLE IF NOT EXISTS "social_provider_pauses" (
    "workspace_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "paused_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_provider_pauses_pkey" PRIMARY KEY ("workspace_id", "provider"),
    CONSTRAINT "social_provider_pauses_provider_check" CHECK (
      "provider" IN ('META', 'X', 'LINKEDIN', 'YOUTUBE', 'NEXTDOOR', 'TIKTOK')
    )
);

CREATE INDEX IF NOT EXISTS "social_provider_pauses_workspace_idx"
  ON "social_provider_pauses" ("workspace_id");

-- Server-side access only (matches the other social OAuth tables): RLS is
-- enabled with no policies, so only the privileged service role can touch it.
ALTER TABLE "social_provider_pauses" ENABLE ROW LEVEL SECURITY;
