-- Gateway transactional adapter: Postgres RPCs for social publishing.
--
-- Purpose: the Supabase gateway has no generic SQL or transaction endpoint,
-- so the social publishing worker's multi-statement operations (the claim's
-- FOR UPDATE SKIP LOCKED, the mark operations' conditional UPDATE plus
-- attempt INSERT, the create operation's check-then-insert) run here as
-- single-transaction RPCs. A new edge function
-- (supabase/functions/gem-social-publishing-gateway) calls these RPCs; the
-- Next.js gateway-backed store calls that edge function.
--
-- PREREQUISITE (not created here): the social_* tables must already exist
-- in the target Supabase project (port the Prisma social migrations first
-- if they do not), with the provider CHECK constraints allowing TELEGRAM.
-- No Prisma migration adds TELEGRAM to social_publishing_jobs.provider, so
-- a TELEGRAM job insert fails that CHECK until the table migration fixes it.
-- These RPCs deliberately contain no table DDL.
--
-- Security: every function is SECURITY DEFINER with search_path pinned to
-- public, and EXECUTE is granted to service_role only (the edge function
-- authenticates with SUPABASE_SERVICE_ROLE_KEY). Every statement is scoped
-- by workspace_id (or by the job/connector id plus workspace_id) exactly as
-- the Prisma implementation scopes it. Business errors (claim lost,
-- idempotency conflict, connector not found) are returned as JSON envelopes
-- ({ ok: false, code, message }) instead of RAISE, so the edge function can
-- map them to the same HTTP status and TokMetricError code the Prisma path
-- produces; the row-returning RPCs (claim, list, marks, credential load)
-- return zero rows for their not-found case and the edge function maps that
-- to the matching code.
--
-- Deployment target: the LIVE gateway project slzdjoqpzbkwzuaexlkj
-- (supabase/config.toml points at a different project; deploy with
-- --project-ref slzdjoqpzbkwzuaexlkj). Apply with the Supabase dashboard
-- SQL editor or `supabase db push --project-ref slzdjoqpzbkwzuaexlkj`.
--
-- NOTE: CREATE OR REPLACE cannot change a function's return type. If a
-- future change alters a RETURNS TABLE column list, DROP the function
-- first, then CREATE it again.

-- ---------------------------------------------------------------------------
-- Shared job-row shape.
--
-- The row-returning RPCs return the same columns (with the same camelCase
-- aliases) as the Prisma store's jobSelection fragment, so the Next.js
-- gateway store can convert rows through the existing job() row mapper.
-- Timestamp columns are TIMESTAMP(3) in the table; they are declared
-- timestamptz here so PostgREST serialises them with an explicit offset
-- (the database timezone is UTC on Supabase, matching the Prisma path).
-- ---------------------------------------------------------------------------

-- OP-1 — Claim jobs (phase 1).
-- The claim statement is the Prisma claim verbatim (one statement = one
-- transaction, so FOR UPDATE SKIP LOCKED is preserved). The two CASE
-- expressions are parameters, not re-implemented policy: the Next.js caller
-- computes the resolved per-provider caps/spacing with the existing slots.ts
-- helpers (including the JSON env overrides) and passes them as JSONB.
-- Missing keys fall back to the Prisma ELSE defaults (30 minutes spacing,
-- cap 3).
CREATE OR REPLACE FUNCTION public.gem_social_claim_jobs(
  p_now timestamptz,
  p_slot_end timestamptz,
  p_claim_id text,
  p_claim_expires_at timestamptz,
  p_limit integer,
  p_spacing_minutes jsonb,
  p_slot_caps jsonb
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT j.id, j.workspace_id, j.provider, j.connector_id, j.created_at
    FROM social_publishing_jobs j
    WHERE (
      (
        j.state IN ('PENDING', 'RETRYING')
        AND j.next_attempt_at <= p_now
        AND (j.scheduled_for IS NULL OR j.scheduled_for <= p_now)
      ) OR (
        j.state = 'CLAIMED'
        AND j.claim_expires_at IS NOT NULL
        AND j.claim_expires_at <= p_now
      )
    )
    AND (
      p_slot_end IS NULL
      OR j.scheduled_for IS NULL
      OR j.scheduled_for < p_slot_end
    )
  ),
  spaced AS (
    SELECT d.*
    FROM due d
    WHERE NOT EXISTS (
      SELECT 1
      FROM social_publishing_jobs prev
      WHERE prev.workspace_id = d.workspace_id
        AND prev.connector_id = d.connector_id
        AND prev.provider = d.provider
        AND prev.state = 'PUBLISHED'
        AND prev.submitted_at IS NOT NULL
        AND prev.submitted_at > p_now - make_interval(mins => COALESCE((p_spacing_minutes ->> prev.provider)::integer, 30))
    )
  ),
  ranked AS (
    SELECT
      s.id,
      s.provider,
      s.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY s.workspace_id, s.provider
        ORDER BY s.created_at ASC
      ) AS provider_rank
    FROM spaced s
  ),
  -- Lock real base-table rows only. FOR UPDATE cannot safely sit on the
  -- window-function CTE above, so the rank filter runs as a plain
  -- subquery and the locking clause applies to social_publishing_jobs.
  candidates AS (
    SELECT jobs.id
    FROM social_publishing_jobs jobs
    WHERE jobs.id IN (
      SELECT r.id
      FROM ranked r
      WHERE r.provider_rank <= COALESCE((p_slot_caps ->> r.provider)::integer, 3)
    )
    ORDER BY jobs.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE social_publishing_jobs jobs
  SET
    state = 'CLAIMED',
    attempt_count = jobs.attempt_count + 1,
    claim_id = p_claim_id,
    claim_expires_at = p_claim_expires_at,
    claimed_at = p_now,
    updated_at = p_now
  FROM candidates
  WHERE jobs.id = candidates.id
  RETURNING
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    jobs.next_attempt_at AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    jobs.claim_expires_at AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    jobs.scheduled_for AS "scheduledFor",
    jobs.claimed_at AS "claimedAt",
    jobs.submitted_at AS "submittedAt",
    jobs.completed_at AS "completedAt",
    jobs.created_at AS "createdAt",
    jobs.updated_at AS "updatedAt";
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_claim_jobs(timestamptz, timestamptz, text, timestamptz, integer, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_claim_jobs(timestamptz, timestamptz, text, timestamptz, integer, jsonb, jsonb) TO service_role;

-- OP-2 — Emergency locks (phase 1).
-- Mirrors enforceEmergencyLocks (src/lib/tokmetric/security.ts): read the
-- workspace row, 404 when missing, 423 when an emergency flag blocks the
-- action. Returns an envelope; the Next.js caller maps it to TokMetricError.
CREATE OR REPLACE FUNCTION public.gem_social_workspace_locks(
  p_workspace_id text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_global boolean;
  v_publishing boolean;
  v_advertising boolean;
  v_shop boolean;
  v_connector boolean;
  v_blocked boolean;
BEGIN
  IF p_action NOT IN ('publish', 'advertise', 'shop_write', 'connector') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_WORKSPACE_ACTION',
      'message', 'Unknown workspace action.'
    );
  END IF;

  SELECT
    global_emergency_lock,
    publishing_disabled,
    advertising_disabled,
    shop_write_disabled,
    connector_disabled
  INTO v_global, v_publishing, v_advertising, v_shop, v_connector
  FROM tokmetric_workspaces
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'WORKSPACE_NOT_FOUND',
      'message', 'Workspace was not found.'
    );
  END IF;

  v_blocked := v_global
    OR (p_action = 'publish' AND v_publishing)
    OR (p_action = 'advertise' AND v_advertising)
    OR (p_action = 'shop_write' AND v_shop)
    OR (p_action = 'connector' AND v_connector);

  IF v_blocked THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'TOKMETRIC_LOCKED',
      'message', 'TokMetric emergency controls block this action.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_workspace_locks(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_workspace_locks(text, text) TO service_role;

-- OP-3 — Governance evidence (phase 1).
-- Returns the approval row (with its content, content version, and latest
-- decision) and the compliance row the worker derives approvalValid /
-- complianceValid from, in one call. Either side is JSON null when not
-- found; the derivation in worker.ts treats a missing row as invalid, so
-- there is no error case here. Column aliases match the Prisma row shapes.
CREATE OR REPLACE FUNCTION public.gem_social_governance_evidence(
  p_approval_id text,
  p_workspace_id text,
  p_approved_version_hash text,
  p_compliance_review_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_approval jsonb;
  v_compliance jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'workspaceId', a.workspace_id,
    'contentId', a.content_id,
    'contentVersionId', a.content_version_id,
    'requestedById', a.requested_by_id,
    'requiredRole', a.required_role,
    'action', a.action,
    'objectHash', a.object_hash,
    'state', a.state,
    'expiresAt', a.expires_at,
    'createdAt', a.created_at,
    'updatedAt', a.updated_at,
    'content', (
      SELECT row_to_json(c)
      FROM (
        SELECT
          c2.id,
          c2.workspace_id AS "workspaceId",
          c2.campaign_id AS "campaignId",
          c2.owner_id AS "ownerId",
          c2.title,
          c2.state,
          c2.current_version_id AS "currentVersionId",
          c2.created_at AS "createdAt",
          c2.updated_at AS "updatedAt"
        FROM tokmetric_contents c2
        WHERE c2.id = a.content_id
      ) c
    ),
    'contentVersion', (
      SELECT row_to_json(v)
      FROM (
        SELECT
          v2.id,
          v2.content_id AS "contentId",
          v2.version,
          v2.object_hash AS "objectHash",
          v2.script,
          v2.caption,
          v2.hashtags,
          v2.settings,
          v2.media_asset_ids AS "mediaAssetIds",
          v2.created_by_id AS "createdById",
          v2.created_at AS "createdAt"
        FROM tokmetric_content_versions v2
        WHERE v2.id = a.content_version_id
      ) v
    ),
    'decisions', (
      SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
      FROM (
        SELECT
          d2.id,
          d2.approval_request_id AS "approvalRequestId",
          d2.actor_id AS "actorId",
          d2.decision,
          d2.object_hash AS "objectHash",
          d2.reason,
          d2.created_at AS "createdAt"
        FROM tokmetric_approval_decisions d2
        WHERE d2.approval_request_id = a.id
        ORDER BY d2.created_at DESC
        LIMIT 1
      ) d
    )
  )
  INTO v_approval
  FROM tokmetric_approval_requests a
  WHERE a.id = p_approval_id
    AND a.workspace_id = p_workspace_id
    AND a.object_hash = p_approved_version_hash
    AND a.state = 'APPROVED';

  SELECT row_to_json(r)
  INTO v_compliance
  FROM (
    SELECT
      cr.id,
      cr.workspace_id AS "workspaceId",
      cr.content_id AS "contentId",
      cr.content_version_id AS "contentVersionId",
      cr.policy_version_id AS "policyVersionId",
      cr.result,
      cr.findings,
      cr.reviewer_id AS "reviewerId",
      cr.created_at AS "createdAt"
    FROM tokmetric_compliance_reviews cr
    WHERE cr.id = p_compliance_review_id
      AND cr.workspace_id = p_workspace_id
      AND cr.result IN ('PASS', 'PASS_WITH_DISCLOSURE')
  ) r;

  RETURN jsonb_build_object(
    'approval', v_approval,
    'complianceReview', v_compliance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_governance_evidence(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_governance_evidence(text, text, text, text) TO service_role;

-- OP-4 — Load connector credential (phase 1).
-- The Prisma SELECT with the credential join, verbatim. Returns the raw row
-- INCLUDING the secret_ref ciphertext; decryption stays in Next.js (the
-- encryption key is a Vercel secret and must never reach Supabase). Zero
-- rows means the edge function returns 404
-- SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND, matching the Prisma load.
CREATE OR REPLACE FUNCTION public.gem_social_load_connector_credential(
  p_workspace_id text,
  p_connector_id text
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  state text,
  "displayName" text,
  "externalAccountId" text,
  "grantedScopes" text[],
  "safeMetadata" jsonb,
  "lastHealthAt" timestamptz,
  "disabledAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "secretRef" text,
  "credentialExpiresAt" timestamptz,
  "credentialRefreshExpiresAt" timestamptz,
  "credentialRotatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    connector.id,
    connector.workspace_id AS "workspaceId",
    connector.provider,
    connector.state,
    connector.display_name AS "displayName",
    connector.external_account_id AS "externalAccountId",
    connector.granted_scopes AS "grantedScopes",
    connector.safe_metadata AS "safeMetadata",
    connector.last_health_at AS "lastHealthAt",
    connector.disabled_at AS "disabledAt",
    connector.created_at AS "createdAt",
    connector.updated_at AS "updatedAt",
    credential.secret_ref AS "secretRef",
    credential.expires_at AS "credentialExpiresAt",
    credential.refresh_expires_at AS "credentialRefreshExpiresAt",
    credential.rotated_at AS "credentialRotatedAt"
  FROM social_connectors connector
  INNER JOIN social_connector_credentials credential
    ON credential.connector_id = connector.id
   AND credential.reference_type = 'oauth:production'
  WHERE connector.id = p_connector_id
    AND connector.workspace_id = p_workspace_id
    AND connector.disabled_at IS NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_load_connector_credential(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_load_connector_credential(text, text) TO service_role;

-- OP-5 — Persistent pause state (phase 1).
-- Mirrors isSocialProviderPaused: a single existence check. The caller
-- passes the pause provider (FACEBOOK_PAGE and INSTAGRAM_PROFESSIONAL both
-- map to META; TELEGRAM maps to TELEGRAM) — the mapping stays in Next.js.
CREATE OR REPLACE FUNCTION public.gem_social_pause_state(
  p_workspace_id text,
  p_provider text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN jsonb_build_object(
    'paused',
    EXISTS (
      SELECT 1
      FROM social_provider_pauses
      WHERE workspace_id = p_workspace_id
        AND provider = p_provider
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_pause_state(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_pause_state(text, text) TO service_role;

-- OP-6 — Mark published (phase 1).
-- The conditional UPDATE (claim_id + state = 'CLAIMED' guard) plus the
-- attempt INSERT run in this function's single transaction, exactly as the
-- Prisma db.$transaction does. Zero rows updated means the claim was lost;
-- the function returns zero rows and the edge function maps that to 409
-- SOCIAL_PUBLISHING_CLAIM_LOST. The attempt's started_at is the job's
-- claimed_at, matching recordAttempt.
CREATE OR REPLACE FUNCTION public.gem_social_mark_published(
  p_job_id text,
  p_claim_id text,
  p_external_post_id text,
  p_external_post_url text,
  p_provider_status_code integer,
  p_safe_metadata jsonb,
  p_now timestamptz
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
  v_attempt_count integer;
  v_claimed_at timestamptz;
BEGIN
  WITH updated AS (
    UPDATE social_publishing_jobs
    SET
      state = 'PUBLISHED',
      external_post_id = p_external_post_id,
      external_post_url = p_external_post_url,
      provider_status_code = p_provider_status_code,
      safe_provider_metadata = p_safe_metadata,
      claim_id = NULL,
      claim_expires_at = NULL,
      submitted_at = p_now,
      completed_at = p_now,
      updated_at = p_now
    WHERE id = p_job_id
      AND claim_id = p_claim_id
      AND state = 'CLAIMED'
    RETURNING id, attempt_count, claimed_at
  )
  SELECT updated.id, updated.attempt_count, updated.claimed_at
  INTO v_id, v_attempt_count, v_claimed_at
  FROM updated;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO social_publishing_attempts (
    id, job_id, attempt_number, outcome, error_code, error_message,
    provider_status_code, safe_metadata, started_at, completed_at
  ) VALUES (
    gen_random_uuid()::text,
    v_id,
    v_attempt_count,
    'PUBLISHED',
    NULL,
    NULL,
    p_provider_status_code,
    p_safe_metadata,
    COALESCE(v_claimed_at, p_now),
    p_now
  )
  ON CONFLICT (job_id, attempt_number) DO NOTHING;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    jobs.next_attempt_at AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    jobs.claim_expires_at AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    jobs.scheduled_for AS "scheduledFor",
    jobs.claimed_at AS "claimedAt",
    jobs.submitted_at AS "submittedAt",
    jobs.completed_at AS "completedAt",
    jobs.created_at AS "createdAt",
    jobs.updated_at AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_published(text, text, text, text, integer, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_published(text, text, text, text, integer, jsonb, timestamptz) TO service_role;

-- OP-7 — Mark blocked (phase 1). Same shape as OP-6: guarded UPDATE plus
-- attempt INSERT in one transaction; zero rows means the claim was lost.
CREATE OR REPLACE FUNCTION public.gem_social_mark_blocked(
  p_job_id text,
  p_claim_id text,
  p_error_code text,
  p_error_message text,
  p_safe_metadata jsonb,
  p_now timestamptz
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
  v_attempt_count integer;
  v_claimed_at timestamptz;
BEGIN
  WITH updated AS (
    UPDATE social_publishing_jobs
    SET
      state = 'BLOCKED',
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      safe_provider_metadata = p_safe_metadata,
      claim_id = NULL,
      claim_expires_at = NULL,
      completed_at = p_now,
      updated_at = p_now
    WHERE id = p_job_id
      AND claim_id = p_claim_id
      AND state = 'CLAIMED'
    RETURNING id, attempt_count, claimed_at
  )
  SELECT updated.id, updated.attempt_count, updated.claimed_at
  INTO v_id, v_attempt_count, v_claimed_at
  FROM updated;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO social_publishing_attempts (
    id, job_id, attempt_number, outcome, error_code, error_message,
    provider_status_code, safe_metadata, started_at, completed_at
  ) VALUES (
    gen_random_uuid()::text,
    v_id,
    v_attempt_count,
    'BLOCKED',
    p_error_code,
    p_error_message,
    NULL,
    p_safe_metadata,
    COALESCE(v_claimed_at, p_now),
    p_now
  )
  ON CONFLICT (job_id, attempt_number) DO NOTHING;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    jobs.next_attempt_at AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    jobs.claim_expires_at AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    jobs.scheduled_for AS "scheduledFor",
    jobs.claimed_at AS "claimedAt",
    jobs.submitted_at AS "submittedAt",
    jobs.completed_at AS "completedAt",
    jobs.created_at AS "createdAt",
    jobs.updated_at AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_blocked(text, text, text, text, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_blocked(text, text, text, text, jsonb, timestamptz) TO service_role;

-- OP-8 — Mark failed (phase 1). Same shape as OP-6/7. The target state
-- (RETRYING / DEAD_LETTER / FAILED), the backoff next_attempt_at, and the
-- completed_at (NULL while retrying) are derived in Next.js exactly as the
-- Prisma path derives them and passed in as parameters.
CREATE OR REPLACE FUNCTION public.gem_social_mark_failed(
  p_job_id text,
  p_claim_id text,
  p_state text,
  p_next_attempt_at timestamptz,
  p_completed_at timestamptz,
  p_error_code text,
  p_error_message text,
  p_provider_status_code integer,
  p_safe_metadata jsonb,
  p_outcome text,
  p_now timestamptz
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
  v_attempt_count integer;
  v_claimed_at timestamptz;
BEGIN
  WITH updated AS (
    UPDATE social_publishing_jobs
    SET
      state = p_state,
      next_attempt_at = p_next_attempt_at,
      provider_status_code = p_provider_status_code,
      safe_provider_metadata = p_safe_metadata,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      claim_id = NULL,
      claim_expires_at = NULL,
      completed_at = p_completed_at,
      updated_at = p_now
    WHERE id = p_job_id
      AND claim_id = p_claim_id
      AND state = 'CLAIMED'
    RETURNING id, attempt_count, claimed_at
  )
  SELECT updated.id, updated.attempt_count, updated.claimed_at
  INTO v_id, v_attempt_count, v_claimed_at
  FROM updated;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO social_publishing_attempts (
    id, job_id, attempt_number, outcome, error_code, error_message,
    provider_status_code, safe_metadata, started_at, completed_at
  ) VALUES (
    gen_random_uuid()::text,
    v_id,
    v_attempt_count,
    p_outcome,
    p_error_code,
    p_error_message,
    p_provider_status_code,
    p_safe_metadata,
    COALESCE(v_claimed_at, p_now),
    p_now
  )
  ON CONFLICT (job_id, attempt_number) DO NOTHING;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    jobs.next_attempt_at AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    jobs.claim_expires_at AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    jobs.scheduled_for AS "scheduledFor",
    jobs.claimed_at AS "claimedAt",
    jobs.submitted_at AS "submittedAt",
    jobs.completed_at AS "completedAt",
    jobs.created_at AS "createdAt",
    jobs.updated_at AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_failed(text, text, text, timestamptz, timestamptz, text, text, integer, jsonb, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_failed(text, text, text, timestamptz, timestamptz, text, text, integer, jsonb, text, timestamptz) TO service_role;

-- OP-9 — Mark connector for reauthorization (phase 1). Single UPDATE, no
-- return value beyond the ok envelope. The metadata (reason + recorded
-- timestamp + externalPublishingEnabled: false) is built in Next.js.
CREATE OR REPLACE FUNCTION public.gem_social_mark_reauthorization(
  p_workspace_id text,
  p_connector_id text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  UPDATE social_connectors
  SET
    state = 'REAUTHORIZATION_REQUIRED',
    safe_metadata = safe_metadata || p_metadata,
    last_health_at = now(),
    updated_at = now()
  WHERE id = p_connector_id
    AND workspace_id = p_workspace_id
    AND disabled_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_reauthorization(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_reauthorization(text, text, jsonb) TO service_role;

-- OP-10 — Audit event (phase 1). Best-effort: the worker swallows audit
-- failures. Writes to tokmetric_audit_events, the same table the Prisma
-- path uses. The metadata is already secret-redacted in Next.js.
CREATE OR REPLACE FUNCTION public.gem_social_audit_event(
  p_workspace_id text,
  p_actor_id text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_correlation_id text,
  p_outcome text,
  p_source_channel text,
  p_safe_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
BEGIN
  v_id := gen_random_uuid()::text;
  INSERT INTO tokmetric_audit_events (
    id, workspace_id, actor_id, action, entity_type, entity_id,
    correlation_id, outcome, source_channel, safe_metadata, created_at
  ) VALUES (
    v_id,
    p_workspace_id,
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_correlation_id,
    p_outcome,
    p_source_channel,
    p_safe_metadata,
    now()
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_audit_event(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_audit_event(text, text, text, text, text, text, text, text, jsonb) TO service_role;

-- OP-11 — Create job (phase 1).
-- Connector check, idempotency check, then INSERT ... RETURNING in one
-- transaction. On a unique violation (two concurrent creates under one
-- idempotency key) the function re-reads the row and applies the same
-- same-request-or-409 rule as the Prisma path, instead of surfacing a raw
-- constraint error. Returns an envelope: { ok: true, job } on success or
-- on a safe duplicate, { ok: false, code, message } on 404/409.
CREATE OR REPLACE FUNCTION public.gem_social_create_job(
  p_workspace_id text,
  p_provider text,
  p_connector_id text,
  p_content_type text,
  p_content_version_hash text,
  p_approved_version_hash text,
  p_approval_id text,
  p_compliance_review_id text,
  p_compliance_passed boolean,
  p_idempotency_key text,
  p_payload jsonb,
  p_local_context text,
  p_max_attempts integer,
  p_next_attempt_at timestamptz,
  p_requested_by_id text,
  p_scheduled_for timestamptz,
  p_now timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_connector_id text;
  v_existing jsonb;
  v_job jsonb;
  v_id text;
BEGIN
  SELECT id
  INTO v_connector_id
  FROM social_connectors
  WHERE id = p_connector_id
    AND workspace_id = p_workspace_id
    AND disabled_at IS NULL
  LIMIT 1;

  IF v_connector_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SOCIAL_CONNECTOR_NOT_FOUND',
      'message', 'The selected social connector was not found in this workspace.'
    );
  END IF;

  SELECT row_to_json(u)
  INTO v_existing
  FROM (
    SELECT
      jobs.id,
      jobs.workspace_id AS "workspaceId",
      jobs.provider,
      jobs.connector_id AS "connectorId",
      jobs.content_type AS "contentType",
      jobs.content_version_hash AS "contentVersionHash",
      jobs.approved_version_hash AS "approvedVersionHash",
      jobs.approval_id AS "approvalId",
      jobs.compliance_review_id AS "complianceReviewId",
      jobs.compliance_passed AS "compliancePassed",
      jobs.idempotency_key AS "idempotencyKey",
      jobs.payload,
      jobs.local_context AS "localContext",
      jobs.state,
      jobs.attempt_count AS "attemptCount",
      jobs.max_attempts AS "maxAttempts",
      jobs.next_attempt_at AS "nextAttemptAt",
      jobs.claim_id AS "claimId",
      jobs.claim_expires_at AS "claimExpiresAt",
      jobs.external_post_id AS "externalPostId",
      jobs.external_post_url AS "externalPostUrl",
      jobs.safe_provider_metadata AS "safeProviderMetadata",
      jobs.last_error_code AS "lastErrorCode",
      jobs.last_error_message AS "lastErrorMessage",
      jobs.requested_by_id AS "requestedById",
      jobs.scheduled_for AS "scheduledFor",
      jobs.claimed_at AS "claimedAt",
      jobs.submitted_at AS "submittedAt",
      jobs.completed_at AS "completedAt",
      jobs.created_at AS "createdAt",
      jobs.updated_at AS "updatedAt"
    FROM social_publishing_jobs jobs
    WHERE jobs.workspace_id = p_workspace_id
      AND jobs.idempotency_key = p_idempotency_key
    LIMIT 1
  ) u;

  IF v_existing IS NOT NULL THEN
    IF v_existing ->> 'provider' = p_provider
      AND v_existing ->> 'connectorId' = p_connector_id
      AND v_existing ->> 'contentVersionHash' = p_content_version_hash
      AND v_existing ->> 'approvedVersionHash' = p_approved_version_hash THEN
      RETURN jsonb_build_object('ok', true, 'job', v_existing);
    END IF;
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT',
      'message', 'The idempotency key is already bound to a different publishing request.'
    );
  END IF;

  v_id := gen_random_uuid()::text;

  BEGIN
    WITH inserted AS (
      INSERT INTO social_publishing_jobs (
        id,
        workspace_id,
        provider,
        connector_id,
        content_type,
        content_version_hash,
        approved_version_hash,
        approval_id,
        compliance_review_id,
        compliance_passed,
        idempotency_key,
        payload,
        local_context,
        state,
        max_attempts,
        next_attempt_at,
        requested_by_id,
        scheduled_for,
        created_at,
        updated_at
      ) VALUES (
        v_id,
        p_workspace_id,
        p_provider,
        p_connector_id,
        p_content_type,
        p_content_version_hash,
        p_approved_version_hash,
        p_approval_id,
        p_compliance_review_id,
        p_compliance_passed,
        p_idempotency_key,
        p_payload,
        p_local_context,
        'PENDING',
        p_max_attempts,
        p_next_attempt_at,
        p_requested_by_id,
        p_scheduled_for,
        p_now,
        p_now
      )
      RETURNING
        id,
        workspace_id AS "workspaceId",
        provider,
        connector_id AS "connectorId",
        content_type AS "contentType",
        content_version_hash AS "contentVersionHash",
        approved_version_hash AS "approvedVersionHash",
        approval_id AS "approvalId",
        compliance_review_id AS "complianceReviewId",
        compliance_passed AS "compliancePassed",
        idempotency_key AS "idempotencyKey",
        payload,
        local_context AS "localContext",
        state,
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        next_attempt_at AS "nextAttemptAt",
        claim_id AS "claimId",
        claim_expires_at AS "claimExpiresAt",
        external_post_id AS "externalPostId",
        external_post_url AS "externalPostUrl",
        safe_provider_metadata AS "safeProviderMetadata",
        last_error_code AS "lastErrorCode",
        last_error_message AS "lastErrorMessage",
        requested_by_id AS "requestedById",
        scheduled_for AS "scheduledFor",
        claimed_at AS "claimedAt",
        submitted_at AS "submittedAt",
        completed_at AS "completedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    )
    SELECT row_to_json(inserted)
    INTO v_job
    FROM inserted;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent create won the race under the same idempotency key.
    -- Re-read and apply the same same-request-or-409 rule.
    SELECT row_to_json(u)
    INTO v_existing
    FROM (
      SELECT
        jobs.id,
        jobs.workspace_id AS "workspaceId",
        jobs.provider,
        jobs.connector_id AS "connectorId",
        jobs.content_type AS "contentType",
        jobs.content_version_hash AS "contentVersionHash",
        jobs.approved_version_hash AS "approvedVersionHash",
        jobs.approval_id AS "approvalId",
        jobs.compliance_review_id AS "complianceReviewId",
        jobs.compliance_passed AS "compliancePassed",
        jobs.idempotency_key AS "idempotencyKey",
        jobs.payload,
        jobs.local_context AS "localContext",
        jobs.state,
        jobs.attempt_count AS "attemptCount",
        jobs.max_attempts AS "maxAttempts",
        jobs.next_attempt_at AS "nextAttemptAt",
        jobs.claim_id AS "claimId",
        jobs.claim_expires_at AS "claimExpiresAt",
        jobs.external_post_id AS "externalPostId",
        jobs.external_post_url AS "externalPostUrl",
        jobs.safe_provider_metadata AS "safeProviderMetadata",
        jobs.last_error_code AS "lastErrorCode",
        jobs.last_error_message AS "lastErrorMessage",
        jobs.requested_by_id AS "requestedById",
        jobs.scheduled_for AS "scheduledFor",
        jobs.claimed_at AS "claimedAt",
        jobs.submitted_at AS "submittedAt",
        jobs.completed_at AS "completedAt",
        jobs.created_at AS "createdAt",
        jobs.updated_at AS "updatedAt"
      FROM social_publishing_jobs jobs
      WHERE jobs.workspace_id = p_workspace_id
        AND jobs.idempotency_key = p_idempotency_key
      LIMIT 1
    ) u;

    IF v_existing IS NOT NULL
      AND v_existing ->> 'provider' = p_provider
      AND v_existing ->> 'connectorId' = p_connector_id
      AND v_existing ->> 'contentVersionHash' = p_content_version_hash
      AND v_existing ->> 'approvedVersionHash' = p_approved_version_hash THEN
      RETURN jsonb_build_object('ok', true, 'job', v_existing);
    END IF;
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT',
      'message', 'The idempotency key is already bound to a different publishing request.'
    );
  END;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SOCIAL_PUBLISHING_CREATE_FAILED',
      'message', 'The publishing job was not created.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'job', v_job);
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_create_job(text, text, text, text, text, text, text, text, boolean, text, jsonb, text, integer, timestamptz, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_create_job(text, text, text, text, text, text, text, text, boolean, text, jsonb, text, integer, timestamptz, text, timestamptz, timestamptz) TO service_role;

-- OP-12 — List jobs (phase 1). Plain filtered select; the limit is clamped
-- in Next.js (1..100, default 50), matching the Prisma path.
CREATE OR REPLACE FUNCTION public.gem_social_list_jobs(
  p_workspace_id text,
  p_limit integer
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    jobs.next_attempt_at AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    jobs.claim_expires_at AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    jobs.scheduled_for AS "scheduledFor",
    jobs.claimed_at AS "claimedAt",
    jobs.submitted_at AS "submittedAt",
    jobs.completed_at AS "completedAt",
    jobs.created_at AS "createdAt",
    jobs.updated_at AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.workspace_id = p_workspace_id
  ORDER BY jobs.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_list_jobs(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_list_jobs(text, integer) TO service_role;

-- Health probe (not an operation). The Next.js gate calls this to confirm
-- the adapter is deployed: ok is true and rpc_count counts every
-- gem_social_* routine in public, so a partially applied migration fails
-- the probe. The probe expects 13 (12 phase-1 RPCs + this one).
CREATE OR REPLACE FUNCTION public.gem_social_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'rpcCount', (
      SELECT count(*)::integer
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND starts_with(routine_name, 'gem_social_')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_health() TO service_role;
