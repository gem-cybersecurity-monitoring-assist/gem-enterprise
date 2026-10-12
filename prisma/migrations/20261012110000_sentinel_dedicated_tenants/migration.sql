-- GEM Sentinel dedicated datastore extension (must be applied AFTER 20261011210000_sentinel_security_core)
-- Approved project only. No tables from the GEM Enterprise main database are imported.
CREATE TABLE "sentinel_tenants" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "consentReference" TEXT NOT NULL,
  "consentVerifiedAt" TIMESTAMP(3) NOT NULL,
  "registeredBy" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "sentinel_operation_audit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "collectorId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sentinel_operation_audit_tenantId_createdAt_idx" ON "sentinel_operation_audit"("tenantId", "createdAt");
ALTER TABLE "sentinel_tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sentinel_operation_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "sentinel_tenants", "sentinel_operation_audit" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE "sentinel_tenants", "sentinel_operation_audit" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE "sentinel_tenants", "sentinel_operation_audit" FROM authenticated;
  END IF;
END $$;
