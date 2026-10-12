-- Additive GEM Sentinel schema. Rehearse on disposable PostgreSQL before promotion.
CREATE TABLE "sentinel_collectors" (
"id" TEXT NOT NULL PRIMARY KEY,
"tenantId" TEXT NOT NULL,
"source" TEXT NOT NULL,
"label" TEXT NOT NULL,
"keyHash" TEXT NOT NULL,
"consentReference" TEXT NOT NULL,
"consentVerifiedAt" TIMESTAMP(3),
"enabled" BOOLEAN NOT NULL DEFAULT false,
"revokedAt" TIMESTAMP(3),
"expiresAt" TIMESTAMP(3) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "sentinel_collectors_keyHash_key" ON "sentinel_collectors"("keyHash");
CREATE INDEX "sentinel_collectors_tenantId_enabled_idx" ON "sentinel_collectors"("tenantId","enabled");
CREATE TABLE "sentinel_nonces" (
"id" TEXT NOT NULL PRIMARY KEY,
"collectorId" TEXT NOT NULL,
"nonce" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "sentinel_nonces_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "sentinel_collectors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sentinel_nonces_collectorId_nonce_key" ON "sentinel_nonces"("collectorId","nonce");
CREATE INDEX "sentinel_nonces_createdAt_idx" ON "sentinel_nonces"("createdAt");
CREATE TABLE "sentinel_security_events" (
"id" TEXT NOT NULL PRIMARY KEY,
"collectorId" TEXT NOT NULL,
"tenantId" TEXT NOT NULL,
"source" TEXT NOT NULL,
"sourceEventId" TEXT NOT NULL,
"severity" TEXT NOT NULL,
"title" TEXT NOT NULL,
"description" TEXT NOT NULL,
"occurredAt" TIMESTAMP(3) NOT NULL,
"receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"requiresReview" BOOLEAN NOT NULL DEFAULT false,
"state" TEXT NOT NULL DEFAULT 'triage_pending',
CONSTRAINT "sentinel_security_events_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "sentinel_collectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sentinel_security_events_tenantId_source_sourceEventId_key" ON "sentinel_security_events"("tenantId","source","sourceEventId");
CREATE INDEX "sentinel_security_events_tenantId_receivedAt_idx" ON "sentinel_security_events"("tenantId","receivedAt");
CREATE INDEX "sentinel_security_events_state_severity_receivedAt_idx" ON "sentinel_security_events"("state","severity","receivedAt");

-- Fail closed for managed PostgreSQL Data APIs (including Supabase).
-- No browser/PostgREST access is granted; all Sentinel operations use owner-gated server APIs.
ALTER TABLE "sentinel_collectors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sentinel_nonces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sentinel_security_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "sentinel_collectors", "sentinel_nonces", "sentinel_security_events" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "sentinel_collectors", "sentinel_nonces", "sentinel_security_events" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "sentinel_collectors", "sentinel_nonces", "sentinel_security_events" FROM authenticated;
  END IF;
END $$;
