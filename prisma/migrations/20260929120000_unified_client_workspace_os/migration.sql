-- WS-F: Unified Client Workspace OS — data model foundation.
-- Additive-only migration: creates two new tables, touches nothing existing.
--   1. capability_readiness_overrides — admin-set per-workspace+module readiness
--      overrides (mandate section 4). State values mirror the CapabilityState
--      union in src/lib/capabilityReadiness.ts; enforced here via CHECK.
--   2. lifecycle_funnel_states — one row per organization holding the current
--      customer lifecycle funnel stage (visitor -> lead -> ... -> expansion).
-- Idempotent-style: safe to re-apply (IF NOT EXISTS + guarded constraints).

CREATE TABLE IF NOT EXISTS "capability_readiness_overrides" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "reason" TEXT,
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capability_readiness_overrides_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "capability_readiness_overrides_state_check" CHECK ("state" IN (
        'LIVE',
        'SURFACE_AVAILABLE',
        'SETUP_REQUIRED',
        'PROVIDER_NOT_CONFIGURED',
        'AUTHORIZATION_REQUIRED',
        'NOT_ENTITLED',
        'RESTRICTED',
        'DEGRADED',
        'UNAVAILABLE'
    ))
);

CREATE TABLE IF NOT EXISTS "lifecycle_funnel_states" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lifecycle_funnel_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lifecycle_funnel_states_stage_check" CHECK ("stage" IN (
        'VISITOR',
        'LEAD',
        'QUALIFIED',
        'ONBOARDING',
        'ACTIVE',
        'EXPANSION',
        'AT_RISK',
        'CHURNED',
        'DORMANT'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS "capability_readiness_overrides_workspaceId_moduleId_key"
    ON "capability_readiness_overrides"("workspaceId", "moduleId");
CREATE INDEX IF NOT EXISTS "capability_readiness_overrides_workspaceId_idx"
    ON "capability_readiness_overrides"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_funnel_states_organizationId_key"
    ON "lifecycle_funnel_states"("organizationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'capability_readiness_overrides_workspaceId_fkey'
    ) THEN
        ALTER TABLE "capability_readiness_overrides"
            ADD CONSTRAINT "capability_readiness_overrides_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "tokmetric_workspaces"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'capability_readiness_overrides_setById_fkey'
    ) THEN
        ALTER TABLE "capability_readiness_overrides"
            ADD CONSTRAINT "capability_readiness_overrides_setById_fkey"
            FOREIGN KEY ("setById") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lifecycle_funnel_states_organizationId_fkey'
    ) THEN
        ALTER TABLE "lifecycle_funnel_states"
            ADD CONSTRAINT "lifecycle_funnel_states_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "tokmetric_organizations"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lifecycle_funnel_states_changedById_fkey'
    ) THEN
        ALTER TABLE "lifecycle_funnel_states"
            ADD CONSTRAINT "lifecycle_funnel_states_changedById_fkey"
            FOREIGN KEY ("changedById") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "capability_readiness_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lifecycle_funnel_states" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "capability_readiness_overrides" FROM anon, authenticated;
REVOKE ALL ON TABLE "lifecycle_funnel_states" FROM anon, authenticated;
