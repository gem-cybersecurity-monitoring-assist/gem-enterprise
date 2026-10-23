-- Additive, fail-closed Experian connector authorization store.
-- No credit report, score, identity response, or other consumer payload is stored here.

CREATE TABLE "experian_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "auth_mode" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'AUTHORIZATION_REQUIRED',
    "external_account_reference" TEXT,
    "display_label" TEXT NOT NULL DEFAULT 'Experian API account',
    "granted_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "approved_capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "safe_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "last_read_verified_at" TIMESTAMP(3),
    "last_health_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experian_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "experian_connections_auth_mode_check" CHECK (
      "auth_mode" IN ('DEVELOPER_PASSWORD', 'AUTHORIZATION_CODE')
    ),
    CONSTRAINT "experian_connections_environment_check" CHECK (
      "environment" IN ('sandbox', 'uat', 'production')
    ),
    CONSTRAINT "experian_connections_state_check" CHECK (
      "state" IN ('AUTHORIZATION_REQUIRED', 'CONNECTED', 'DEGRADED', 'REAUTHORIZATION_REQUIRED', 'DISCONNECTED')
    )
);

CREATE TABLE "experian_connection_credentials" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "secret_ref" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "refresh_expires_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experian_connection_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experian_authorization_attempts" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "encrypted_code_verifier" TEXT NOT NULL,
    "requested_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "redirect_uri" TEXT NOT NULL,
    "redirect_after" TEXT NOT NULL DEFAULT '/app/products/financial/credit-readiness',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experian_authorization_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "experian_authorization_redirect_after_check" CHECK (
      "redirect_after" LIKE '/%'
      AND "redirect_after" NOT LIKE '//%'
      AND "redirect_after" NOT LIKE '%\\%'
    )
);

CREATE UNIQUE INDEX "experian_connections_workspace_key"
ON "experian_connections"("workspace_id");

CREATE UNIQUE INDEX "experian_connection_credentials_connection_key"
ON "experian_connection_credentials"("connection_id");

CREATE UNIQUE INDEX "experian_authorization_attempts_nonce_key"
ON "experian_authorization_attempts"("nonce");

CREATE INDEX "experian_authorization_attempts_workspace_idx"
ON "experian_authorization_attempts"("workspace_id", "created_at");

ALTER TABLE "experian_connections"
ADD CONSTRAINT "experian_connections_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "tokmetric_workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experian_connection_credentials"
ADD CONSTRAINT "experian_connection_credentials_connection_id_fkey"
FOREIGN KEY ("connection_id") REFERENCES "experian_connections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experian_authorization_attempts"
ADD CONSTRAINT "experian_authorization_attempts_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "tokmetric_workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experian_authorization_attempts"
ADD CONSTRAINT "experian_authorization_attempts_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experian_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "experian_connection_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "experian_authorization_attempts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "experian_connections" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "experian_connection_credentials" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "experian_authorization_attempts" FROM PUBLIC;

DO $gem_experian_privileges$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "experian_connections" FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE "experian_connection_credentials" FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE "experian_authorization_attempts" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "experian_connections" FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE "experian_connection_credentials" FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE "experian_authorization_attempts" FROM authenticated;
  END IF;
END
$gem_experian_privileges$;
