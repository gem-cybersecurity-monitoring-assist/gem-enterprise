-- Baseline for six tables that production holds but no migration created
-- (they came from `prisma db push`): api_keys, email_campaigns, meeting_requests,
-- news_sources, news_articles, news_ingestion_runs, plus their enums.
-- Definitions come from a read-only catalog capture of production on 2026-10-23.
-- Fully guarded: a no-op where the objects already exist (production).

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT','SCHEDULED','SENDING','SENT','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MeetingStatus" AS ENUM ('REQUESTED','CONFIRMED','CANCELLED','COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "NewsCategory" AS ENUM ('crypto','cybersecurity','markets','geopolitics','policy','real_estate','alternatives','general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meeting_requests" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "hostId" TEXT,
  "topic" TEXT NOT NULL,
  "description" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 30,
  "status" "MeetingStatus" NOT NULL DEFAULT 'REQUESTED',
  "meetingUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meeting_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meeting_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "news_sources" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "feedUrl" TEXT NOT NULL,
  "siteUrl" TEXT,
  "category" "NewsCategory" NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
  "lastFetchedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastError" TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "news_articles" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT,
  "externalGuid" TEXT NOT NULL,
  "externalUrl" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "aiSummary" TEXT,
  "body" TEXT,
  "category" "NewsCategory" NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "author" TEXT,
  "mediaType" TEXT NOT NULL DEFAULT 'none',
  "imageUrl" TEXT,
  "imageAlt" TEXT,
  "videoUrl" TEXT,
  "videoThumbnail" TEXT,
  "videoProvider" TEXT,
  "status" TEXT NOT NULL DEFAULT 'published',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "isEditorsPick" BOOLEAN NOT NULL DEFAULT false,
  "relevanceScore" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "news_articles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "news_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "news_ingestion_runs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "triggeredBy" TEXT NOT NULL,
  "sourcesAttempted" INTEGER NOT NULL DEFAULT 0,
  "sourcesSucceeded" INTEGER NOT NULL DEFAULT 0,
  "sourcesFailed" INTEGER NOT NULL DEFAULT 0,
  "articlesFound" INTEGER NOT NULL DEFAULT 0,
  "articlesCreated" INTEGER NOT NULL DEFAULT 0,
  "articlesUpdated" INTEGER NOT NULL DEFAULT 0,
  "articlesSkipped" INTEGER NOT NULL DEFAULT 0,
  "aiEnrichments" INTEGER NOT NULL DEFAULT 0,
  "aiFailures" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "errorSummary" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "news_ingestion_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "news_sources_slug_key"    ON "news_sources"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "news_sources_feedUrl_key" ON "news_sources"("feedUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "news_articles_externalGuid_key" ON "news_articles"("externalGuid");
CREATE UNIQUE INDEX IF NOT EXISTS "news_articles_slug_key"   ON "news_articles"("slug");
CREATE INDEX IF NOT EXISTS "news_articles_external_url_idx"  ON "news_articles"("externalUrl");
CREATE INDEX IF NOT EXISTS "news_articles_relevance_idx"     ON "news_articles"("status", "relevanceScore" DESC, "publishedAt" DESC);

-- Production has RLS on for all six. Apply the same, and keep API roles away from them.
ALTER TABLE "api_keys"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_campaigns"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_requests"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "news_sources"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "news_articles"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "news_ingestion_runs" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text; t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH t IN ARRAY ARRAY['api_keys','email_campaigns','meeting_requests','news_sources','news_articles','news_ingestion_runs'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
      END LOOP;
    END IF;
  END LOOP;
END $$;
