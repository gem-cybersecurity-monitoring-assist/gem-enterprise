-- WS-C (analytics ingestion): additive social metrics storage.
-- Adds post-level metric snapshots, provider account metrics, and sync run
-- records. Does not modify any existing table. RLS enabled; all access is
-- server-side through the governed analytics ingestion worker and API routes.

CREATE TABLE "social_metric_snapshots" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "publishing_job_id" TEXT,
    "provider" TEXT NOT NULL,
    "external_post_id" TEXT NOT NULL,
    "metric_date" DATE NOT NULL,
    "views" BIGINT,
    "impressions" BIGINT,
    "reach" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "shares" BIGINT,
    "saves" BIGINT,
    "clicks" BIGINT,
    "watch_time_seconds" BIGINT,
    "followers_delta" INTEGER,
    "engagement_rate" DOUBLE PRECISION,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_metric_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "social_metric_snapshots_provider_check" CHECK (
      "provider" IN (
        'FACEBOOK_PAGE',
        'INSTAGRAM_PROFESSIONAL',
        'X',
        'LINKEDIN_COMPANY',
        'YOUTUBE',
        'NEXTDOOR'
      )
    ),
    CONSTRAINT "social_metric_snapshots_non_negative_check" CHECK (
      ("views" IS NULL OR "views" >= 0) AND
      ("impressions" IS NULL OR "impressions" >= 0) AND
      ("reach" IS NULL OR "reach" >= 0) AND
      ("likes" IS NULL OR "likes" >= 0) AND
      ("comments" IS NULL OR "comments" >= 0) AND
      ("shares" IS NULL OR "shares" >= 0) AND
      ("saves" IS NULL OR "saves" >= 0) AND
      ("clicks" IS NULL OR "clicks" >= 0) AND
      ("watch_time_seconds" IS NULL OR "watch_time_seconds" >= 0) AND
      ("engagement_rate" IS NULL OR "engagement_rate" >= 0)
    )
);

CREATE TABLE "provider_account_metrics" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "metric_date" DATE NOT NULL,
    "followers" BIGINT,
    "following" BIGINT,
    "posts" BIGINT,
    "impressions" BIGINT,
    "reach" BIGINT,
    "profile_views" BIGINT,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_account_metrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_account_metrics_provider_check" CHECK (
      "provider" IN (
        'FACEBOOK_PAGE',
        'INSTAGRAM_PROFESSIONAL',
        'X',
        'LINKEDIN_COMPANY',
        'YOUTUBE',
        'NEXTDOOR'
      )
    ),
    CONSTRAINT "provider_account_metrics_non_negative_check" CHECK (
      ("followers" IS NULL OR "followers" >= 0) AND
      ("following" IS NULL OR "following" >= 0) AND
      ("posts" IS NULL OR "posts" >= 0) AND
      ("impressions" IS NULL OR "impressions" >= 0) AND
      ("reach" IS NULL OR "reach" >= 0) AND
      ("profile_views" IS NULL OR "profile_views" >= 0)
    )
);

-- Sync run records: distinguish "not yet collected" (no row) from 0 (snapshot
-- with zeros), FAILED collection, and NOT_SUPPORTED / API_TIER_REQUIRED
-- providers. Failures are recorded here, never zero-filled into snapshots.
CREATE TABLE "social_metric_sync_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "publishing_job_id" TEXT,
    "provider" TEXT NOT NULL,
    "external_post_id" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "provider_status_code" INTEGER,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_metric_sync_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "social_metric_sync_runs_kind_check" CHECK (
      "kind" IN ('POST_METRICS', 'ACCOUNT_METRICS')
    ),
    CONSTRAINT "social_metric_sync_runs_status_check" CHECK (
      "status" IN (
        'COLLECTED',
        'FAILED',
        'NOT_SUPPORTED',
        'API_TIER_REQUIRED',
        'SKIPPED'
      )
    )
);

CREATE UNIQUE INDEX "social_metric_snapshots_workspace_provider_post_date"
ON "social_metric_snapshots"("workspace_id", "provider", "external_post_id", "metric_date");

CREATE INDEX "social_metric_snapshots_workspace_provider_date_idx"
ON "social_metric_snapshots"("workspace_id", "provider", "metric_date");

CREATE INDEX "social_metric_snapshots_publishing_job_idx"
ON "social_metric_snapshots"("publishing_job_id");

CREATE UNIQUE INDEX "provider_account_metrics_workspace_connector_date"
ON "provider_account_metrics"("workspace_id", "connector_id", "metric_date");

CREATE INDEX "provider_account_metrics_workspace_provider_idx"
ON "provider_account_metrics"("workspace_id", "provider", "metric_date");

CREATE INDEX "social_metric_sync_runs_workspace_idx"
ON "social_metric_sync_runs"("workspace_id", "ran_at");

ALTER TABLE "social_metric_snapshots"
ADD CONSTRAINT "social_metric_snapshots_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "tokmetric_workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_metric_snapshots"
ADD CONSTRAINT "social_metric_snapshots_connector_id_fkey"
FOREIGN KEY ("connector_id") REFERENCES "social_connectors"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "social_metric_snapshots"
ADD CONSTRAINT "social_metric_snapshots_publishing_job_id_fkey"
FOREIGN KEY ("publishing_job_id") REFERENCES "social_publishing_jobs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "provider_account_metrics"
ADD CONSTRAINT "provider_account_metrics_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "tokmetric_workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_account_metrics"
ADD CONSTRAINT "provider_account_metrics_connector_id_fkey"
FOREIGN KEY ("connector_id") REFERENCES "social_connectors"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "social_metric_sync_runs"
ADD CONSTRAINT "social_metric_sync_runs_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "tokmetric_workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_metric_sync_runs"
ADD CONSTRAINT "social_metric_sync_runs_connector_id_fkey"
FOREIGN KEY ("connector_id") REFERENCES "social_connectors"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_metric_sync_runs"
ADD CONSTRAINT "social_metric_sync_runs_publishing_job_id_fkey"
FOREIGN KEY ("publishing_job_id") REFERENCES "social_publishing_jobs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "social_metric_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_account_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_metric_sync_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "social_metric_snapshots" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "provider_account_metrics" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "social_metric_sync_runs" FROM PUBLIC;
